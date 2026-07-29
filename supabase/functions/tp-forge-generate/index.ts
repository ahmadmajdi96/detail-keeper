// Submit a test-case generation job to the Repo Reader service and record the
// remote job id on the test plan. Persistence + status flip is handled by the
// client-polled `tp-forge-check` function (background waitUntil is unreliable
// for the long runtime of the generation service).
//
// Flow (per Repo Reader integration guide):
//   1. Project repo/BRD job must be `succeeded`  -> source_job_id
//   2. SQA plan job generated from it            -> sqa_job_id (optional)
//   3. POST /v1/jobs/<source_job_id>/test-cases
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const BASE = (Deno.env.get("REPO_READER_BASE_URL_V1") || "https://reporeader.qualixa.cortanexai.com").replace(/\/+$/, "");
const API_KEY = Deno.env.get("REPO_READER_API_KEY_V1") || "qualixa-repo-reader-key";

const DONE = ["succeeded", "completed", "success", "ready"];

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

    const { test_plan_id, settings: rawSettings, dry_run } = await req.json();
    if (!test_plan_id) return j({ error: "test_plan_id required" }, 400);

    const s = rawSettings ?? {};
    const cfg = {
      smoke: s.smoke !== false,
      regression: s.regression !== false,
      maxSmoke: Number.isFinite(s.maxSmoke) ? Number(s.maxSmoke) : 25,
      maxRegression: Number.isFinite(s.maxRegression) ? Number(s.maxRegression) : 100,
      prioritize: {
        businessValue: s?.prioritize?.businessValue !== false,
        criticalFlows: s?.prioritize?.criticalFlows !== false,
        highRisk: s?.prioritize?.highRisk !== false,
        frequentlyUsed: s?.prioritize?.frequentlyUsed !== false,
      },
      negativeTests: s.negativeTests !== false,
      boundaryCases: s.boundaryCases !== false,
      duplicateDetection: s.duplicateDetection !== false,
      language: typeof s.language === "string" ? s.language : "TypeScript",
      framework: typeof s.framework === "string" && s.framework.trim() ? s.framework.trim() : "Playwright",
      outputRoots: Array.isArray(s.outputRoots) && s.outputRoots.length
        ? s.outputRoots.map((r: unknown) => String(r).trim()).filter(Boolean).slice(0, 12)
        : ["pages/", "tests/", "fixtures/", "utils/"],
      // Dry run: artifacts only — the runner must never install deps or execute tests.
      dryRun: dry_run !== undefined ? dry_run !== false : s.dryRun !== false,
      skipStubs: s.skipStubs === true,
    };
    if (!cfg.smoke && !cfg.regression) {
      return j({ error: "Select at least one test type (smoke or regression)." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: plan } = await admin
      .from("test_plans")
      .select("id, name, project_id, workspace_id, docs_job_ref, docs_status, docs_source_job_ref")
      .eq("id", test_plan_id)
      .maybeSingle();
    if (!plan) return j({ error: "Test plan not found" }, 404);
    if (!plan.project_id) return j({ error: "This test plan is not linked to a project" }, 400);

    const { data: project } = await admin
      .from("projects")
      .select("id, repo_job_id, repo_job_status")
      .eq("id", plan.project_id)
      .maybeSingle();

    const sourceJobId = (plan as any).docs_source_job_ref || project?.repo_job_id;
    if (!sourceJobId) {
      return j({ error: "The project has no completed source job yet — ingest a repository or BRD first." }, 400);
    }
    if (project?.repo_job_id === sourceJobId) {
      const srcStatus = String(project?.repo_job_status || "").toLowerCase();
      if (srcStatus && !DONE.includes(srcStatus)) {
        return j({ error: `The project's source job is not completed yet (status: ${srcStatus}).` }, 409);
      }
    }

    // sqa_job_id is optional — omit it and the service falls back to the latest
    // succeeded SQA job derived from the same source job.
    const sqaJobId = String((plan as any).docs_status || "").toLowerCase() === "ready"
      ? (plan as any).docs_job_ref || null
      : null;

    const payload = {
      ...(sqaJobId ? { sqa_job_id: sqaJobId } : {}),
      metadata: {
        requested_by: userId,
        purpose: "test-case-generation",
        test_plan_id,
        project_id: plan.project_id,
      },
      settings: {
        test_types: {
          smoke: { enabled: cfg.smoke, max_tests: cfg.maxSmoke },
          regression: { enabled: cfg.regression, max_tests: cfg.maxRegression },
        },
        prioritize: {
          high_business_value: cfg.prioritize.businessValue,
          critical_user_flows: cfg.prioritize.criticalFlows,
          high_risk_areas: cfg.prioritize.highRisk,
          frequently_used_features: cfg.prioritize.frequentlyUsed,
        },
        coverage_depth: {
          generate_negative_tests: cfg.negativeTests,
          boundary_cases: cfg.boundaryCases,
          duplicate_detection: cfg.duplicateDetection,
        },
        automation: {
          language: cfg.language,
          framework: cfg.framework,
          output_roots: cfg.outputRoots,
          page_object_manager: "PageObjectManager",
          dry_run: cfg.dryRun,
          skeletons_with_skip_stubs: cfg.skipStubs || cfg.dryRun,
        },
      },
      forward_to_test_doc: false,
    };

    const res = await fetch(`${BASE}/v1/jobs/${sourceJobId}/test-cases`, {
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
      if (res.status === 409) detail = "The source or SQA job is not completed yet.";
      return j({ error: `Repo Reader ${res.status}: ${detail}` }, res.status >= 500 ? 503 : res.status);
    }
    const data = JSON.parse(text || "{}");
    const jobId: string | undefined = data?.id || data?.job_id;
    if (!jobId) return j({ error: "Repo Reader did not return a job id", raw: data }, 502);

    await admin.from("test_plans").update({
      ai_status: "running",
      ai_last_run_at: new Date().toISOString(),
      ai_job_ref: jobId,
      ai_settings: cfg,
      ai_dry_run: !!cfg.dryRun,
      ai_progress: 0,
      ai_progress_message: "Test-case job queued on Repo Reader",
      ai_progress_updated_at: new Date().toISOString(),
    }).eq("id", test_plan_id);

    await admin.from("generation_stage_logs").insert({
      test_plan_id,
      kind: "cases",
      stage: "submit",
      dry_run: !!cfg.dryRun,
      install_skipped: !!cfg.dryRun,
      execution_skipped: !!cfg.dryRun,
      message: `Test-case job ${jobId} created from source job ${sourceJobId}${sqaJobId ? ` (SQA job ${sqaJobId})` : " (latest SQA job)"}`,
      meta: { job_ref: jobId, source_job_id: sourceJobId, sqa_job_id: sqaJobId, dry_run: !!cfg.dryRun },
    });

    return j({ status: "accepted", jobId, source_job_id: sourceJobId, message: "Generation started" }, 202);
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
