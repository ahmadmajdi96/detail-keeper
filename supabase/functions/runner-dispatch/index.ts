// Dispatches a runner job: creates a cycle_run + runner_job, optionally calls the runner webhook.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims, error: authError } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (authError || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub;

    const body = await req.json();
    const { runner_id, project_id, suite_id, cycle_id, environment_id, release_id } = body || {};
    if (!runner_id || !project_id || !suite_id) return json({ error: "runner_id, project_id, suite_id required" }, 400);

    // Service-role client for the rest (so triggers run consistently)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch runner + suite (also validates membership via RLS-aware call first)
    const { data: runner, error: rErr } = await supabase.from("runners").select("*").eq("id", runner_id).maybeSingle();
    if (rErr || !runner) return json({ error: "Runner not found or access denied" }, 404);

    const { data: suite } = await admin.from("test_suites").select("*").eq("id", suite_id).maybeSingle();
    if (!suite) return json({ error: "Suite not found" }, 404);

    const env = environment_id || runner.environment_id;
    const ws = runner.workspace_id;

    // Resolve / create cycle
    let resolvedCycle = cycle_id;
    if (!resolvedCycle) {
      const { data: newCycle, error: cErr } = await admin.from("test_cycles").insert({
        project_id, workspace_id: ws, name: `Runner: ${suite.name} @ ${new Date().toISOString().slice(0,16)}`,
        suite_id, environment_id: env, release_id, status: "active", created_by: userId,
      } as any).select("id").single();
      if (cErr) return json({ error: cErr.message }, 500);
      resolvedCycle = newCycle.id;
    }

    // Create cycle_run
    const { data: run, error: runErr } = await admin.from("cycle_runs").insert({
      cycle_id: resolvedCycle, project_id, workspace_id: ws,
      name: `${runner.name} #${Date.now().toString().slice(-5)}`,
      status: "queued", executor_id: userId,
    } as any).select("id").single();
    if (runErr) return json({ error: runErr.message }, 500);

    // Create runner_job
    const { data: job, error: jobErr } = await admin.from("runner_jobs").insert({
      workspace_id: ws, project_id, runner_id, cycle_run_id: run.id, cycle_id: resolvedCycle,
      suite_id, environment_id: env, release_id, status: "queued",
      payload: { suite_id, environment_id: env, cycle_run_id: run.id },
      created_by: userId,
    }).select("*").single();
    if (jobErr) return json({ error: jobErr.message }, 500);

    // If runner is a webhook, fire and forget
    if (runner.kind === "webhook" && runner.config?.webhook_url) {
      try {
        const resp = await fetch(runner.config.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runner_job_id: job.id,
            cycle_run_id: run.id,
            suite_id, environment_id: env, project_id,
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

    return json({ runner_job_id: job.id, cycle_run_id: run.id, cycle_id: resolvedCycle });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
