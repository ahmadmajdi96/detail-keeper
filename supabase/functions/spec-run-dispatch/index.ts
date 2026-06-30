// Dispatch a single Playwright spec to a registered runner.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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
    const userId = claims.claims.sub;

    const { spec_id, runner_id, suite_run_id, browser, headless, retries } = await req.json();
    if (!spec_id) return j({ error: "spec_id required" }, 400);
    const _browser = browser || "chromium";
    const _headless = headless === undefined ? true : !!headless;
    const _retries = Number.isInteger(retries) ? retries : 0;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: spec } = await admin
      .from("test_plan_specs")
      .select("id, test_plan_id, project_id, filename, content")
      .eq("id", spec_id)
      .maybeSingle();
    if (!spec) return j({ error: "Spec not found" }, 404);

    // Resolve runner: explicit, or any idle runner in the workspace
    const { data: proj } = await admin.from("projects").select("workspace_id").eq("id", spec.project_id).maybeSingle();
    if (!proj) return j({ error: "Project not found" }, 404);

    let runner = null;
    if (runner_id) {
      const { data } = await admin.from("runners").select("*").eq("id", runner_id).maybeSingle();
      runner = data;
    } else {
      const { data } = await admin.from("runners")
        .select("*").eq("workspace_id", proj.workspace_id).eq("status", "idle").limit(1).maybeSingle();
      runner = data;
    }

    // Create runner_job (runner may be null — queued for any runner to pick up)
    const { data: job, error: jErr } = await admin.from("runner_jobs").insert({
      workspace_id: proj.workspace_id,
      project_id: spec.project_id,
      runner_id: runner?.id ?? null,
      status: "queued",
      payload: {
        kind: "playwright_spec",
        spec_id: spec.id,
        filename: spec.filename,
        content: spec.content,
        test_plan_id: spec.test_plan_id,
        suite_run_id: suite_run_id ?? null,
        browser: _browser,
        headless: _headless,
        retries: _retries,
      },
      created_by: userId,
    } as any).select("*").single();
    if (jErr) return j({ error: jErr.message }, 500);

    // Snapshot artifacts (all plan docs + all plan specs) for replay/re-open.
    const { data: snapDocs } = await admin.from("test_plan_documents_v2")
      .select("id, slug, title, kind, content, sort_order")
      .eq("test_plan_id", spec.test_plan_id).order("sort_order");
    const { data: snapSpecs } = await admin.from("test_plan_specs")
      .select("id, filename, content, language, test_case_id, document_id")
      .eq("test_plan_id", spec.test_plan_id).order("filename");
    const artifacts_json = {
      captured_at: new Date().toISOString(),
      spec: { id: spec.id, filename: spec.filename, content: spec.content },
      documents: snapDocs ?? [],
      specs: snapSpecs ?? [],
    };

    // Create spec_runs row linked to job + parent suite_run
    const { data: run, error: rErr } = await admin.from("spec_runs").insert({
      spec_id: spec.id,
      test_plan_id: spec.test_plan_id,
      project_id: spec.project_id,
      runner_job_id: job.id,
      suite_run_id: suite_run_id ?? null,
      browser: _browser,
      headless: _headless,
      retries: _retries,
      status: "queued",
      artifacts_json: artifacts_json as any,
      created_by: userId,
    }).select("*").single();
    if (rErr) return j({ error: rErr.message }, 500);

    // Webhook runner: fire-and-forget
    if (runner?.kind === "webhook" && runner.config?.webhook_url) {
      try {
        const resp = await fetch(runner.config.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runner_job_id: job.id,
            spec_run_id: run.id,
            filename: spec.filename,
            content: spec.content,
            callback_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/runner-callback`,
          }),
        });
        await admin.from("runner_jobs").update({
          status: resp.ok ? "dispatched" : "failed",
          error: resp.ok ? null : { message: `Webhook ${resp.status}` },
        }).eq("id", job.id);
      } catch (e) {
        await admin.from("runner_jobs").update({
          status: "failed", error: { message: (e as Error).message },
        }).eq("id", job.id);
      }
    }

    return j({ spec_run_id: run.id, runner_job_id: job.id });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
