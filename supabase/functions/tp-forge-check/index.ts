// Poll the testcase-forge job stored on a test plan. When the remote job
// succeeds, fetch the UI-view test cases and persist them, then flip
// ai_status to 'ready'. On explicit failure, flip to 'failed'. Idempotent —
// safe to call every few seconds from the client.
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
      .select("id, project_id, workspace_id, ai_status, ai_job_ref")
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
    const progress = body?.progress ?? body?.percent ?? null;

    if (["failed", "error", "cancelled"].includes(rstatus)) {
      await admin.from("test_plans").update({ ai_status: "failed" }).eq("id", test_plan_id);
      return j({ status: "failed", remote_status: rstatus });
    }

    if (!["succeeded", "completed", "success"].includes(rstatus)) {
      return j({ status: "running", remote_status: rstatus, progress });
    }

    // Succeeded — but only persist once. If already ready, no-op.
    if ((plan as any).ai_status === "ready") {
      return j({ status: "ready", remote_status: rstatus, note: "already persisted" });
    }

    const casesRes = await fetch(`${FORGE_BASE}/v1/test-generations/${jobId}/test-cases?view=ui`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    if (!casesRes.ok) {
      await admin.from("test_plans").update({ ai_status: "failed" }).eq("id", test_plan_id);
      return j({ status: "failed", note: "test-cases fetch failed" });
    }
    const casesBody = await casesRes.json().catch(() => ({}));
    const items: any[] = casesBody?.testCases || casesBody?.items || casesBody?.data || (Array.isArray(casesBody) ? casesBody : []);

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

    await admin.from("test_plans").update({ ai_status: "ready" }).eq("id", test_plan_id);
    return j({ status: "ready", inserted });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
