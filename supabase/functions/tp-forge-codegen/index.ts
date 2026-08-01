// Submit a Playwright code-generation job to the Repo Reader service.
//
//   POST /v1/jobs/<test_case_job_id>/playwright-code
//
// The test-case job (test_plans.ai_job_ref) is the source. Progress and
// persistence are handled by `tp-forge-codegen-check`, polled by the global
// GenerationJobTracker.
//
// Three environment variable NAMES are mandatory and must be defined (with a
// value) in the plan's Variable Sets before codegen can start.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const BASE = (Deno.env.get("REPO_READER_BASE_URL_V1") || "https://reporeader.qualixa.cortanexai.com").replace(/\/+$/, "");
const API_KEY = Deno.env.get("REPO_READER_API_KEY_V1") || "qualixa-repo-reader-key";

export const REQUIRED_ENV = ["PLAYWRIGHT_BASE_URL", "API_BASE_URL", "E2E_AUTH_TOKEN"];

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

    const { test_plan_id, suite_id, language, dry_run, skip_stubs, settings: rawSettings } = await req.json();
    const s = rawSettings ?? {};
    const skipStubs = skip_stubs === true || s.skipStubs === true;
    const lang = typeof (language ?? s.language) === "string" && String(language ?? s.language).trim()
      ? String(language ?? s.language).trim() : "TypeScript";
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

    const suiteId = typeof suite_id === "string" && suite_id.trim() ? suite_id.trim() : null;
    const sourceJobId = (plan as any).ai_job_ref as string | null;
    if (!suiteId) {
      if (!sourceJobId) return j({ error: "Generate test cases first — this plan has no test-case job." }, 400);
      if ((plan as any).ai_status !== "ready") return j({ error: "Test case generation must finish before codegen." }, 400);
    }

    // ---- Mandatory environment variables ------------------------------
    const env = flattenVars((plan as any).variables);
    const missing = REQUIRED_ENV.filter((k) => !String(env[k] ?? "").trim());
    if (missing.length) {
      return j({
        error: `Missing required environment variables: ${missing.join(", ")}. Add them under Overview → Variable Sets → Required Environment before generating Playwright code.`,
        missing_env: missing,
      }, 400);
    }

    const commonSettings = {
      language: lang,
      framework: "Playwright",
      base_url_env: "PLAYWRIGHT_BASE_URL",
      api_base_url_env: "API_BASE_URL",
      auth_token_env: "E2E_AUTH_TOKEN",
      test_dir: str(s.testDir, "tests"),
      pages_dir: str(s.pagesDir, "pages"),
      fixtures_dir: str(s.fixturesDir, "fixtures"),
      utils_dir: str(s.utilsDir, "utils"),
      use_skip_stubs: skipStubs || dry_run !== false,
      include_api_mocks: s.includeApiMocks !== false,
    };

    let endpoint: string;
    let payload: Record<string, unknown>;
    let suiteName: string | null = null;

    if (suiteId) {
      // ---- Suite-scoped codegen: send only this suite's test cases -----
      const { data: suite } = await admin
        .from("test_suites")
        .select("id, name, project_id")
        .eq("id", suiteId)
        .maybeSingle();
      if (!suite) return j({ error: "Test suite not found" }, 404);
      suiteName = (suite as any).name as string;

      const { data: planCaseRows } = await admin
        .from("test_plan_test_cases")
        .select("test_case_id")
        .eq("test_plan_id", test_plan_id);
      const planCaseIds = new Set((planCaseRows ?? []).map((r: any) => r.test_case_id));

      const { data: caseRows } = await admin
        .from("test_cases")
        .select("id, title, priority, test_type, coverage_tags, source, automation_path, suite_order")
        .eq("suite_id", suiteId)
        .order("suite_order", { ascending: true });

      const suiteCases = (caseRows ?? []).filter((c: any) => planCaseIds.size === 0 || planCaseIds.has(c.id));
      if (!suiteCases.length) {
        return j({ error: `The suite "${suiteName}" has no test cases in this plan.` }, 400);
      }

      const { data: stepRows } = await admin
        .from("test_case_steps")
        .select("test_case_id, step_number, action, expected_result")
        .in("test_case_id", suiteCases.map((c: any) => c.id))
        .order("step_number", { ascending: true });
      const stepsByCase = new Map<string, any[]>();
      for (const st of stepRows ?? []) {
        const list = stepsByCase.get((st as any).test_case_id) ?? [];
        list.push({ action: (st as any).action ?? "", expected_result: (st as any).expected_result ?? "" });
        stepsByCase.set((st as any).test_case_id, list);
      }

      const { data: project } = await admin
        .from("projects").select("id, name").eq("id", (plan as any).project_id).maybeSingle();

      payload = {
        suite_id: suiteId,
        suite_name: suiteName,
        repo_name: (project as any)?.name || "project",
        test_cases: suiteCases.map((c: any) => ({
          id: `TC-${String(c.id).slice(0, 8).toUpperCase()}`,
          test_type: c.test_type || "Regression Testing",
          title: c.title,
          priority: `P${Math.max(1, Math.min(4, Number(c.priority) || 3))}`,
          coverage_tags: Array.isArray(c.coverage_tags) ? c.coverage_tags : [],
          steps: stepsByCase.get(c.id) ?? [],
          source: {
            surface_type: c.source || "ui",
            route: c.automation_path || "/",
          },
        })),
        settings: {
          ...commonSettings,
          use_skip_stubs: commonSettings.use_skip_stubs,
        },
        metadata: {
          requested_by: "test-management-ui",
          user_id: userId,
          test_plan_id,
          project_id: (plan as any).project_id,
        },
      };
      endpoint = `${BASE}/v1/test-suites/playwright-code`;
    } else {
      payload = {
        model: null,
        metadata: {
          requested_by: "test-management-ui",
          user_id: userId,
          test_plan_id,
          project_id: (plan as any).project_id,
        },
        settings: commonSettings,
        forward_to_test_doc: false,
      };
      endpoint = `${BASE}/v1/jobs/${sourceJobId}/playwright-code`;
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) {
      let detail = text.slice(0, 400);
      try { const p = JSON.parse(text); detail = p?.error || p?.detail || p?.message || detail; } catch { /* raw */ }
      await admin.from("test_plans").update({
        codegen_status: "failed",
        codegen_progress_message: `Submit failed (${res.status}): ${detail}`,
        codegen_progress_updated_at: new Date().toISOString(),
      }).eq("id", test_plan_id);
      return j({ error: `Repo Reader ${res.status}: ${detail}` }, res.status >= 500 ? 503 : res.status);
    }
    const data = JSON.parse(text || "{}");
    const codegenJobId: string | undefined = data?.id || data?.job_id;
    if (!codegenJobId) return j({ error: "Repo Reader did not return a job id", raw: data }, 502);

    const now = new Date().toISOString();
    await admin.from("test_plans").update({
      codegen_status: "running",
      codegen_skip_stubs: skipStubs,
      codegen_dry_run: dry_run !== false,
      codegen_job_ref: codegenJobId,
      codegen_suite_id: suiteId,
      codegen_progress: 0,
      codegen_progress_message: suiteId
        ? `Playwright code job queued for suite "${suiteName}"`
        : "Playwright code job queued on Repo Reader",
      codegen_progress_updated_at: now,
      codegen_last_run_at: now,
    }).eq("id", test_plan_id);

    await admin.from("generation_stage_logs").insert({
      test_plan_id,
      kind: "code",
      stage: "submit",
      dry_run: dry_run !== false,
      install_skipped: dry_run !== false,
      execution_skipped: dry_run !== false,
      message: suiteId
        ? `Playwright code job ${codegenJobId} created for suite "${suiteName}" (${(payload as any).test_cases?.length ?? 0} test cases)`
        : `Playwright code job ${codegenJobId} created from test-case job ${sourceJobId}`,
      meta: {
        job_ref: codegenJobId,
        source_job_id: sourceJobId,
        suite_id: suiteId,
        suite_name: suiteName,
        skip_stubs: skipStubs,
        env: { base_url_env: "PLAYWRIGHT_BASE_URL", api_base_url_env: "API_BASE_URL", auth_token_env: "E2E_AUTH_TOKEN" },
      },
    });

    return j({ status: "accepted", codegenJobId, source_job_id: sourceJobId, suite_id: suiteId }, 202);
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function str(v: unknown, fallback: string) {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

/** Flatten variable sets (new shape) or a legacy flat list into KEY -> value. */
function flattenVars(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const arr = Array.isArray(raw) ? raw : [];
  for (const entry of arr) {
    const list = Array.isArray((entry as any)?.variables) ? (entry as any).variables : [entry];
    for (const v of list) {
      const k = String((v as any)?.key ?? "").trim();
      if (k) out[k] = String((v as any)?.value ?? "");
    }
  }
  return out;
}

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
