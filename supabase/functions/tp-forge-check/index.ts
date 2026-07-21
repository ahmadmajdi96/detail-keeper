// Poll the testcase-forge job stored on a test plan. Writes live progress
// back to test_plans (ai_progress, ai_progress_message) so any client
// subscribed to that row sees a live progress bar. When the remote job
// succeeds, fetches the UI-view test cases and persists them, then flips
// ai_status to 'ready'. On explicit failure, flips to 'failed'.
// Idempotent — safe to call every few seconds from the client.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const FORGE_BASE = "https://testgenerator.qualixa.cortanexai.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return j({ error: "Unauthorized" }, 401);

    const apiKey = Deno.env.get("TESTGEN_API_KEY");
    if (!apiKey) return j({ error: "TESTGEN_API_KEY is not configured" }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) return j({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub;

    const { test_plan_id } = await req.json();
    if (!test_plan_id) return j({ error: "test_plan_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: plan } = await admin
      .from("test_plans")
      .select("id, project_id, workspace_id, ai_status, ai_job_ref, ai_progress")
      .eq("id", test_plan_id)
      .maybeSingle();
    if (!plan) return j({ error: "Test plan not found" }, 404);
    const jobId = (plan as any).ai_job_ref;
    if (!jobId) return j({ status: (plan as any).ai_status || "unknown", note: "no job ref" });

    // Ask Forge for status.
    const s = await fetch(`${FORGE_BASE}/v1/test-generations/${jobId}`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    if (!s.ok) {
      const t = await s.text();
      return j({ status: (plan as any).ai_status, remote_http: s.status, note: t.slice(0, 200) });
    }
    const body = await s.json().catch(() => ({}));
    const rstatus = String(body?.status || body?.state || "").toLowerCase();
    // Forge returns `progress` as an object {totalUnits, completedUnits,
    // totalItems, generatedCases} — not a plain number. Normalise both shapes.
    const prog = (body?.progress && typeof body.progress === "object") ? body.progress : {};
    const totalUnits = Number(prog.totalUnits ?? body?.totalUnits ?? body?.total_units ?? 0);
    const completedUnits = Number(prog.completedUnits ?? body?.completedUnits ?? body?.completed_units ?? 0);
    const totalCases = Number(prog.totalTestCases ?? prog.totalItems ?? body?.totalTestCases ?? body?.total_test_cases ?? 0);
    const generatedCases = Number(prog.generatedCases ?? body?.generatedCases ?? 0);
    let percent: number | null = null;
    if (typeof body?.progress === "number") percent = clampPct(body.progress);
    else if (typeof body?.percent === "number") percent = clampPct(body.percent);
    else if (typeof prog.percent === "number") percent = clampPct(prog.percent);
    else if (totalUnits > 0) percent = clampPct((completedUnits / totalUnits) * 100);
    const stage = body?.stage || body?.phase || prog.stage || null;
    const message = buildMessage(rstatus, stage, completedUnits, totalUnits, generatedCases || totalCases);

    if (["failed", "error", "cancelled"].includes(rstatus)) {
      await admin.from("test_plans").update({
        ai_status: "failed",
        ai_progress: percent ?? 0,
        ai_progress_message: message,
        ai_progress_updated_at: new Date().toISOString(),
      }).eq("id", test_plan_id);
      return j({ status: "failed", remote_status: rstatus });
    }

    const isSuccess = ["succeeded", "completed", "success", "completed_with_gaps", "partial"].includes(rstatus)
      || rstatus.startsWith("completed");
    if (!isSuccess) {
      // Only write when something changed so we don't hammer the row.
      if (percent !== null && percent !== (plan as any).ai_progress) {
        await admin.from("test_plans").update({
          ai_progress: percent,
          ai_progress_message: message,
          ai_progress_updated_at: new Date().toISOString(),
        }).eq("id", test_plan_id);
      } else if (message) {
        await admin.from("test_plans").update({
          ai_progress_message: message,
          ai_progress_updated_at: new Date().toISOString(),
        }).eq("id", test_plan_id);
      }
      return j({ status: "running", remote_status: rstatus, progress: percent, message });
    }

    // Succeeded — but only persist once. If already ready, no-op.
    if ((plan as any).ai_status === "ready") {
      return j({ status: "ready", remote_status: rstatus, note: "already persisted" });
    }

    // Signal 100% while we persist so the UI reflects the transition.
    await admin.from("test_plans").update({
      ai_progress: 100,
      ai_progress_message: "Persisting generated test cases…",
      ai_progress_updated_at: new Date().toISOString(),
    }).eq("id", test_plan_id);

    // Try the UI view first, then fall back to the raw artifacts endpoint —
    // per README, both are exposed and either can serve the data.
    const items = await fetchCasesWithRetry(jobId, apiKey);
    if (!items) {
      await admin.from("test_plans").update({
        ai_status: "failed",
        ai_progress_message: "Could not fetch generated cases from Forge",
        ai_progress_updated_at: new Date().toISOString(),
      }).eq("id", test_plan_id);
      return j({ status: "failed", note: "test-cases fetch failed" });
    }

    let inserted = 0;
    for (const tc of items) {
      const title = String(tc.title || "Untitled").slice(0, 200);
      const description = String(tc.description || "");
      const expected = String(tc.expectedResult || tc.expected_result || "");
      const pr = String(tc.priority || "P2").toLowerCase();
      const priority = pr.includes("p0") || pr.includes("block") ? 1
        : pr.includes("p1") || pr.includes("high") ? 1
        : pr.includes("p3") || pr.includes("low") ? 3 : 2;
      const tags = Array.isArray(tc.coverageTags) ? tc.coverageTags.slice(0, 8)
        : Array.isArray(tc.coverage_tags) ? tc.coverage_tags.slice(0, 8) : [];
      const preconds = String(tc.preconditions || "");

      const { data: row, error } = await admin.from("test_cases").insert({
        workspace_id: plan.workspace_id,
        project_id: plan.project_id,
        title,
        description,
        expected_result: expected,
        preconditions: preconds || null,
        priority,
        status: "draft",
        ai_generated: true,
        coverage_tags: tags,
        created_by: userId,
      } as any).select("id").single();
      if (error || !row) continue;

      await admin.from("test_plan_test_cases").insert({
        test_plan_id, test_case_id: row.id, added_by: userId,
      } as any);

      const steps: any[] = Array.isArray(tc.steps) ? tc.steps : [];
      if (steps.length) {
        await admin.from("test_case_steps").insert(
          steps.map((s: any, i: number) => ({
            test_case_id: row.id,
            step_number: Number(s.index ?? i + 1),
            action: String(s.action ?? s.step ?? ""),
            expected_result: String(s.expectedResult ?? s.expected_result ?? ""),
          })),
        );
      }
      inserted++;
    }

    await admin.from("test_plans").update({
      ai_status: "ready",
      ai_progress: 100,
      ai_progress_message: `Generated ${inserted} test cases`,
      ai_progress_updated_at: new Date().toISOString(),
    }).eq("id", test_plan_id);
    return j({ status: "ready", inserted });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(99, Math.round(n)));
}

function buildMessage(status: string, stage: any, done: number, total: number, cases: number): string {
  if (stage) return `${String(stage)}${total ? ` · ${done}/${total} units` : ""}`;
  if (total > 0) return `Generating cases · ${done}/${total} units${cases ? ` · ${cases} cases so far` : ""}`;
  if (status === "queued") return "Queued at Forge";
  if (status === "running") return "Working…";
  return "";
}

async function fetchCasesWithRetry(jobId: string, apiKey: string): Promise<any[] | null> {
  const urls = [
    `${FORGE_BASE}/v1/test-generations/${jobId}/test-cases?view=ui`,
    `${FORGE_BASE}/v1/test-generations/${jobId}/artifacts`,
  ];
  for (const url of urls) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(url, { headers: { authorization: `Bearer ${apiKey}` } });
        if (!r.ok) {
          await sleep(500 * (attempt + 1));
          continue;
        }
        const body = await r.json().catch(() => ({}));
        const items = extractCases(body);
        if (items.length) return items;
        return items; // empty but valid response — treat as no cases
      } catch {
        await sleep(500 * (attempt + 1));
      }
    }
  }
  return null;
}

function extractCases(body: any): any[] {
  if (Array.isArray(body)) return body;
  const candidates = [
    body?.testCases, body?.items, body?.data, body?.cases,
    body?.artifacts?.testCases, body?.artifacts?.cases,
  ];
  for (const c of candidates) if (Array.isArray(c) && c.length) return c;
  // Some artifact payloads nest by unit.
  if (body?.artifacts && typeof body.artifacts === "object") {
    const flat: any[] = [];
    for (const v of Object.values<any>(body.artifacts)) {
      if (Array.isArray(v?.testCases)) flat.push(...v.testCases);
      else if (Array.isArray(v)) flat.push(...v);
    }
    if (flat.length) return flat;
  }
  return [];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
