// Client-triggered Playwright codegen via testcase-forge.
// Submits a codegen job to Forge and immediately returns. The job is
// then tracked via `tp-forge-codegen-check` (polled by the global
// GenerationJobTracker), which writes live progress into
// test_plans.codegen_* and — on success — fetches the file bundle and
// persists every file into `test_plan_specs`.
//
// The remote endpoint requires `sourceJobId` (a UUID from a completed
// /v1/test-generations job) and UPPER_SNAKE_CASE env-var NAMES — values
// are never sent.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const FORGE_BASE = "https://testgenerator.qualixa.cortanexai.com";
const ENV_NAME = /^[A-Z][A-Z0-9_]{0,63}$/;

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

    const { test_plan_id, base_url, language } = await req.json();
    const lang = ["typescript", "javascript", "java"].includes(String(language)) ? String(language) : "typescript";
    if (!test_plan_id) return j({ error: "test_plan_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: plan } = await admin
      .from("test_plans")
      .select("id, project_id, workspace_id, ai_job_ref, ai_status, variables")
      .eq("id", test_plan_id)
      .maybeSingle();
    if (!plan) return j({ error: "Test plan not found" }, 404);

    const sourceJobId = (plan as any).ai_job_ref as string | null;
    if (!sourceJobId) return j({ error: "Generate test cases first — no Forge sourceJobId on this plan." }, 400);
    if ((plan as any).ai_status !== "ready") return j({ error: "Test case generation must finish before codegen." }, 400);

    // Extract env-var NAMES (values are never sent) from all variable sets.
    const rawSets = Array.isArray((plan as any).variables) ? (plan as any).variables : [];
    const names = new Set<string>();
    for (const s of rawSets) {
      const vars = Array.isArray(s?.variables) ? s.variables : Array.isArray(s) ? [] : [];
      const list = vars.length ? vars : (s?.key ? [s] : []);
      for (const v of list) {
        const k = String(v?.key ?? "").trim();
        if (ENV_NAME.test(k)) names.add(k);
      }
    }
    const envVars = Array.from(names).slice(0, 50);

    const body: any = {
      sourceJobId,
      options: {
        ...(envVars.length ? { envVars } : {}),
        ...(base_url ? { baseUrl: String(base_url) } : {}),
        concurrency: 4,
        maxCasesPerFile: 10,
        language: lang,
      },
    };

    const submit = await fetch(`${FORGE_BASE}/v1/codegen`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!submit.ok) {
      const t = await submit.text();
      await admin.from("test_plans").update({
        codegen_status: "failed",
        codegen_progress_message: `Submit failed (${submit.status})`,
        codegen_progress_updated_at: new Date().toISOString(),
      }).eq("id", test_plan_id);
      return j({ error: `Forge codegen submit failed (${submit.status}): ${t.slice(0, 500)}` }, 502);
    }
    const submitBody = await submit.json().catch(() => ({}));
    const codegenJobId: string | undefined = submitBody?.id || submitBody?.jobId;
    if (!codegenJobId) return j({ error: "Forge did not return a codegen job id", raw: submitBody }, 502);

    const now = new Date().toISOString();
    await admin.from("test_plans").update({
      codegen_status: "running",
      codegen_job_ref: codegenJobId,
      codegen_progress: 0,
      codegen_progress_message: "Queued at Forge",
      codegen_progress_updated_at: now,
      codegen_last_run_at: now,
    }).eq("id", test_plan_id);

    return j({ status: "accepted", codegenJobId, envVarsSent: envVars.length }, 202);
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
