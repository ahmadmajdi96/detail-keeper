import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Thin producer: enqueues a durable job and returns immediately. Worker runs
// the actual AI generation. Navigation in the client never cancels generation.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { test_plan_id } = await req.json();
    if (!test_plan_id) {
      return new Response(JSON.stringify({ error: "test_plan_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: plan } = await sb.from("test_plans").select("workspace_id, project_id, created_by").eq("id", test_plan_id).single();

    await sb.from("test_plans").update({ ai_status: "queued" }).eq("id", test_plan_id);

    const { data: existingJob } = await sb.from("jobs")
      .select("id, status, progress, progress_message, run_after")
      .eq("kind", "generate_test_plan_from_docs")
      .contains("payload", { test_plan_id })
      .in("status", ["queued", "retrying", "running", "waiting"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingJob?.id) {
      return new Response(JSON.stringify({
        success: true,
        job_id: existingJob.id,
        status: existingJob.status,
        progress: existingJob.progress,
        progress_message: existingJob.progress_message,
        run_after: existingJob.run_after,
      }), {
        status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const idempotencyKey = `gen-plan:${test_plan_id}:${Date.now()}`;
    const { data: job, error } = await sb.from("jobs").insert({
      workspace_id: plan?.workspace_id || null,
      project_id: plan?.project_id || null,
      kind: "generate_test_plan_from_docs",
      payload: { test_plan_id },
      idempotency_key: idempotencyKey,
      created_by: plan?.created_by || null,
      max_attempts: 20,
      priority: 50,
    }).select("id").single();

    if (error) throw error;

    // Best-effort: kick the worker immediately so the user doesn't wait for cron.
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/job-worker`;
    fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    }).catch(() => {});

    return new Response(JSON.stringify({ success: true, job_id: job.id, status: "queued" }), {
      status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
