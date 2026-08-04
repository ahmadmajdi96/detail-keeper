// Start a live Playwright execution on Repo Reader.
// POST /v1/jobs/<playwright_code_job_id>/playwright-execution
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const BASE = (Deno.env.get("REPO_READER_BASE_URL_V1") || "https://reporeader.qualixa.cortanexai.com").replace(/\/+$/, "");
const API_KEY = Deno.env.get("REPO_READER_API_KEY_V1") || "qualixa-repo-reader-key";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return j({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) return j({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const body = await req.json();
    const {
      test_plan_id, suite_id, base_url, env, timeout_seconds,
      environment, browser, device, build_version, tags, retries,
      locator_analysis_id, test_case_ids,
    } = body ?? {};
    if (!test_plan_id) return j({ error: "test_plan_id required" }, 400);
    const suiteId = typeof suite_id === "string" && suite_id.trim() ? suite_id.trim() : null;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: plan } = await admin
      .from("test_plans")
      .select("id, project_id, workspace_id, codegen_job_ref, codegen_status, codegen_suite_id, variables")
      .eq("id", test_plan_id)
      .maybeSingle();
    if (!plan) return j({ error: "Test plan not found" }, 404);

    const codegenJobId = (plan as any).codegen_job_ref as string | null;
    if (!codegenJobId) {
      return j({ error: "Generate Playwright code first — no code-generation job on this plan." }, 400);
    }
    const codegenSuiteId = (plan as any).codegen_suite_id as string | null;
    if (suiteId && codegenSuiteId !== suiteId) {
      const { data: suite } = await admin.from("test_suites").select("name").eq("id", suiteId).maybeSingle();
      return j({
        error: `The latest Playwright code was not generated for "${(suite as any)?.name ?? "this suite"}". Generate Playwright code for that suite first, then run it.`,
      }, 409);
    }

    // Merge env values coming from the plan's variable sets with caller overrides.
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
        if (/^[A-Z][A-Z0-9_]{0,63}$/.test(k) && v) runtimeEnv[k] = String(v);
      }
    }

    const baseUrl = String(base_url || runtimeEnv.PLAYWRIGHT_BASE_URL || "").trim();
    if (!baseUrl) return j({ error: "base_url required (set PLAYWRIGHT_BASE_URL in the plan variables)" }, 400);
    const apiBaseUrl = runtimeEnv.API_BASE_URL || "";
    const authToken = runtimeEnv.E2E_AUTH_TOKEN || "";

    const settings: Record<string, unknown> = {
      live_view: body?.live_view !== false,
      base_url: baseUrl,
      install_dependencies: body?.install_dependencies !== false,
      install_browsers: body?.install_browsers === true,
      headed: body?.headed !== false,
      use_live_api: body?.use_live_api !== false,
      workers: Number.isFinite(Number(body?.workers)) ? Math.max(1, Math.min(8, Number(body.workers))) : 1,
      trace: typeof body?.trace === "string" ? body.trace : "retain-on-failure",
      timeout_seconds: Number.isFinite(Number(timeout_seconds))
        ? Math.max(60, Math.min(7200, Math.trunc(Number(timeout_seconds))))
        : 900,
    };
    if (Number.isFinite(Number(retries))) settings.retries = Math.max(0, Math.min(5, Math.trunc(Number(retries))));
    if (typeof browser === "string" && browser) settings.browser = browser;
    if (typeof device === "string" && device && device !== "desktop") settings.device = device;
    if (Array.isArray(test_case_ids) && test_case_ids.length) settings.test_case_ids = test_case_ids.slice(0, 500);
    if (Array.isArray(tags) && tags.length) settings.grep = tags.join("|");
    if (apiBaseUrl) settings.api_base_url = apiBaseUrl;
    if (authToken) settings.auth_token = authToken;

    const submit = await fetch(`${BASE}/v1/jobs/${encodeURIComponent(codegenJobId)}/playwright-execution`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        metadata: { requested_by: "qualixa-frontend", purpose: "live-playwright-execution", test_plan_id },
        settings,
      }),
    });
    if (!submit.ok) {
      const t = await submit.text();
      return j({ error: `Repo Reader execution submit failed (${submit.status}): ${t.slice(0, 500)}` }, 502);
    }
    const submitBody = await submit.json().catch(() => ({} as any));
    const execJobId: string | undefined = submitBody?.id || submitBody?.job_id;
    if (!execJobId) return j({ error: "Repo Reader did not return an execution job id", raw: submitBody }, 502);

    const now = new Date().toISOString();
    const { data: row, error: insErr } = await admin.from("plan_test_runs").insert({
      test_plan_id,
      project_id: (plan as any).project_id,
      workspace_id: (plan as any).workspace_id,
      codegen_job_ref: codegenJobId,
      suite_id: suiteId ?? codegenSuiteId,
      forge_run_id: execJobId,
      base_url: baseUrl,
      status: "queued",
      execution_phase: "queued",
      progress_message: "Queued at Repo Reader",
      started_at: now,
      created_by: userId,
      settings,
      environment: typeof environment === "string" ? environment : null,
      browser: typeof browser === "string" ? browser : "chromium",
      device: typeof device === "string" ? device : "desktop",
      build_version: typeof build_version === "string" ? build_version : null,
      tags: Array.isArray(tags) ? tags.filter((t: unknown) => typeof t === "string").slice(0, 20) : [],
      locator_analysis_id: typeof locator_analysis_id === "string" ? locator_analysis_id : null,
      events: [{ ts: now, type: "execution_submitted", envKeys: Object.keys(runtimeEnv), baseUrl }],
    }).select("id").single();
    if (insErr) return j({ error: insErr.message }, 500);

    return j({ status: "accepted", plan_test_run_id: row.id, execution_job_id: execJobId }, 202);
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
