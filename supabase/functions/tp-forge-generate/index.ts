// Generate test cases via testcase-forge (testgenerator.qualixa.cortanexai.com).
// Submits plan documents + variable sets as files, polls the job, then persists
// the returned UI-view test cases into public.test_cases + test_plan_test_cases.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const FORGE_BASE = "https://testgenerator.qualixa.cortanexai.com";
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 180_000; // 3 minutes soft cap

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
      .select("id, name, project_id, workspace_id, variables, plan_documents, description")
      .eq("id", test_plan_id)
      .maybeSingle();
    if (!plan) return j({ error: "Test plan not found" }, 404);

    const { data: docs } = await admin
      .from("test_plan_documents_v2")
      .select("slug, title, kind, content")
      .eq("test_plan_id", test_plan_id)
      .order("sort_order");

    const files: Array<{ filename: string; content: string; encoding?: string }> = [];

    // Plan-level documents authored inline.
    for (const d of docs ?? []) {
      const name = `${(d.slug || d.title || "doc").replace(/[^a-zA-Z0-9._-]/g, "-")}.md`;
      files.push({ filename: name, content: String(d.content ?? "") });
    }

    // Referenced plan_documents (name/url/description) -> a manifest markdown.
    const planDocs = Array.isArray((plan as any).plan_documents) ? (plan as any).plan_documents : [];
    if (planDocs.length) {
      const md = ["# Plan Documents", "", ...planDocs.map((d: any) =>
        `## ${d.name || "(untitled)"}\n${d.description || ""}\n\n${d.url ? `Source: ${d.url}` : ""}`,
      )].join("\n\n");
      files.push({ filename: "plan-documents.md", content: md });
    }

    // Variable Sets: normalise legacy flat [{key,value}] into one set.
    const rawVars = Array.isArray((plan as any).variables) ? (plan as any).variables : [];
    const varSets = normaliseVariableSets(rawVars);
    if (varSets.length) {
      files.push({
        filename: "variables.json",
        content: JSON.stringify({ plan: plan.name, sets: varSets }, null, 2),
      });
      const md = ["# Variable Sets", ""];
      for (const s of varSets) {
        md.push(`## ${s.name}`);
        if (s.description) md.push(s.description);
        md.push("");
        md.push("| Key | Value |", "|---|---|");
        for (const v of s.variables) md.push(`| \`${v.key}\` | \`${v.value ?? ""}\` |`);
        md.push("");
      }
      files.push({ filename: "variables.md", content: md.join("\n") });
    }

    if (files.length === 0) {
      return j({ error: "No plan documents or variables to send. Add at least one." }, 400);
    }

    // 1) Submit generation job.
    const submitRes = await fetch(`${FORGE_BASE}/v1/test-generations`, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        files,
        options: { maxItemsPerUnit: 12, concurrency: 4, maxRepairRounds: 2 },
      }),
    });
    if (!submitRes.ok) {
      const t = await submitRes.text();
      return j({ error: `Forge submit failed (${submitRes.status}): ${t.slice(0, 500)}` }, 502);
    }
    const submit = await submitRes.json().catch(() => ({}));
    const jobId: string | undefined = submit?.id || submit?.job?.id || submit?.jobId;
    if (!jobId) return j({ error: "Forge did not return a job id", raw: submit }, 502);

    await admin.from("test_plans").update({ ai_status: "running", ai_last_run_at: new Date().toISOString() }).eq("id", test_plan_id);

    // Run polling + persistence in the background so we don't hit the 150s
    // request idle timeout. Client polls test_plans.ai_status for completion.
    const bg = (async () => {
      try {
        const started = Date.now();
        let status = "queued";
        while (Date.now() - started < POLL_TIMEOUT_MS) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
          const s = await fetch(`${FORGE_BASE}/v1/test-generations/${jobId}`, {
            headers: { authorization: `Bearer ${apiKey}` },
          });
          if (!s.ok) continue;
          const body = await s.json().catch(() => ({}));
          status = String(body?.status || body?.state || "").toLowerCase();
          if (["succeeded", "completed", "success"].includes(status)) break;
          if (["failed", "error", "cancelled"].includes(status)) {
            await admin.from("test_plans").update({ ai_status: "failed" }).eq("id", test_plan_id);
            return;
          }
        }
        if (!["succeeded", "completed", "success"].includes(status)) {
          await admin.from("test_plans").update({ ai_status: "failed" }).eq("id", test_plan_id);
          return;
        }

        const casesRes = await fetch(`${FORGE_BASE}/v1/test-generations/${jobId}/test-cases?view=ui`, {
          headers: { authorization: `Bearer ${apiKey}` },
        });
        if (!casesRes.ok) {
          await admin.from("test_plans").update({ ai_status: "failed" }).eq("id", test_plan_id);
          return;
        }
        const casesBody = await casesRes.json().catch(() => ({}));
        const items: any[] = casesBody?.testCases || casesBody?.items || casesBody?.data || (Array.isArray(casesBody) ? casesBody : []);

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
        }

        await admin.from("test_plans").update({ ai_status: "ready" }).eq("id", test_plan_id);
      } catch (_e) {
        await admin.from("test_plans").update({ ai_status: "failed" }).eq("id", test_plan_id);
      }
    })();
    // @ts-ignore EdgeRuntime is provided by Supabase Edge Runtime
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(bg); else bg;

    return j({ status: "accepted", jobId, message: "Generation started" }, 202);
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function normaliseVariableSets(raw: any[]): Array<{ id: string; name: string; description: string; variables: Array<{ key: string; value: string }> }> {
  if (!raw?.length) return [];
  // New shape: array of sets
  if (raw.every((r) => r && Array.isArray(r.variables))) {
    return raw.map((s: any) => ({
      id: String(s.id || crypto.randomUUID()),
      name: String(s.name || "Untitled Set"),
      description: String(s.description || ""),
      variables: (s.variables || []).filter((v: any) => v?.key).map((v: any) => ({
        key: String(v.key), value: String(v.value ?? ""),
      })),
    }));
  }
  // Legacy: flat key/value list
  return [{
    id: "legacy",
    name: "Default",
    description: "Migrated from legacy variables list",
    variables: raw.filter((v: any) => v?.key).map((v: any) => ({
      key: String(v.key), value: String(v.value ?? ""),
    })),
  }];
}

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
