// Dispatch a Playwright suite execution to TestCase Forge (/v1/test-runs).
// Requires the plan already has a completed codegen job (codegen_job_ref).
// Env values are passed to Forge in-memory (never stored/logged here — we
// only persist NAMES via events for observability).
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
    const userId = claims.claims.sub as string;

    const { test_plan_id, base_url, env, timeout_ms } = await req.json();
    if (!test_plan_id) return j({ error: "test_plan_id required" }, 400);
    if (!base_url || typeof base_url !== "string") return j({ error: "base_url required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: plan } = await admin
      .from("test_plans")
      .select("id, project_id, workspace_id, codegen_job_ref, codegen_status, variables")
      .eq("id", test_plan_id)
      .maybeSingle();
    if (!plan) return j({ error: "Test plan not found" }, 404);
    const codegenJobId = (plan as any).codegen_job_ref as string | null;
    if (!codegenJobId) return j({ error: "Generate Playwright code first — no codegen job on this plan." }, 400);

    // Build env: merge caller-provided values with defaults from variable sets.
    const runtimeEnv: Record<string, string> = {};
    const sets = Array.isArray((plan as any).variables) ? (plan as any).variables : [];
    for (const s of sets) {
      const list = Array.isArray(s?.variables) ? s.variables : [];
      for (const v of list) {
        const k = String(v?.key ?? "").trim();
        const val = v?.value == null ? "" : String(v.value);
        if (/^[A-Z][A-Z0-9_]{0,63}$/.test(k) && val) runtimeEnv[k] = val;
      }
    }
    if (env && typeof env === "object") {
      for (const [k, v] of Object.entries(env)) {
        if (/^[A-Z][A-Z0-9_]{0,63}$/.test(k)) runtimeEnv[k] = String(v ?? "");
      }
    }

    const options: Record<string, unknown> = {
      baseUrl: base_url,
      env: runtimeEnv,
    };
    const timeoutMs = Number(timeout_ms);
    if (Number.isFinite(timeoutMs)) {
      options.timeoutMs = Math.max(30_000, Math.min(3_600_000, Math.trunc(timeoutMs)));
    }

    const forgeBody = { codegenJobId, options };
    const submit = await fetch(`${FORGE_BASE}/v1/test-runs`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(forgeBody),
    });
    if (!submit.ok) {
      const t = await submit.text();
      return j({ error: `Forge test-run submit failed (${submit.status}): ${t.slice(0, 500)}` }, 502);
    }
    const submitBody = await submit.json().catch(() => ({}));
    const forgeRunId: string | undefined = submitBody?.id || submitBody?.runId || submitBody?.jobId;
    if (!forgeRunId) return j({ error: "Forge did not return a run id", raw: submitBody }, 502);

    const now = new Date().toISOString();
    const { data: row, error: insErr } = await admin.from("plan_test_runs").insert({
      test_plan_id,
      project_id: (plan as any).project_id,
      workspace_id: (plan as any).workspace_id,
      codegen_job_ref: codegenJobId,
      forge_run_id: forgeRunId,
      base_url,
      status: "running",
      progress_message: "Queued at Forge",
      started_at: now,
      created_by: userId,
      events: [{ ts: now, type: "run_submitted", envKeys: Object.keys(runtimeEnv), baseUrl: base_url }],
    }).select("*").single();
    if (insErr) return j({ error: insErr.message }, 500);

    return j({ status: "accepted", plan_test_run_id: row.id, forge_run_id: forgeRunId }, 202);
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
