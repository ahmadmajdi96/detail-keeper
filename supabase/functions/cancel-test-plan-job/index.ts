// Cancel/terminate a local test-plan generation job AND its remote Doc Generator job.
// Body: { job_id?: string, test_plan_id?: string, reason?: string, all_active?: boolean, exclude_job_ids?: string[] }
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { terminateRemoteDocJob } from "../_shared/handlers.ts";

const BASE = Deno.env.get("DOC_GENERATOR_BASE_URL") || "https://docgenerator.qualixa.cortanexai.com";
const KEY = Deno.env.get("DOC_GENERATOR_API_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const reason: string = body.reason || "Cancelled by user";
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Collect candidate local jobs.
    let jobs: any[] = [];
    if (body.job_id) {
      const { data } = await sb.from("jobs").select("id, status, checkpoint, kind")
        .eq("id", body.job_id).limit(1);
      jobs = data || [];
    } else if (body.test_plan_id) {
      const { data } = await sb.from("jobs").select("id, status, checkpoint, kind")
        .eq("kind", "generate_test_plan_from_docs")
        .contains("payload", { test_plan_id: body.test_plan_id })
        .in("status", ["queued", "retrying", "running", "waiting"]);
      jobs = data || [];
    } else if (body.all_active) {
      const { data } = await sb.from("jobs").select("id, status, checkpoint, kind")
        .eq("kind", "generate_test_plan_from_docs")
        .in("status", ["queued", "retrying", "running", "waiting"]);
      const exclude = new Set<string>(body.exclude_job_ids || []);
      jobs = (data || []).filter((j: any) => !exclude.has(j.id));
    } else {
      return json({ error: "job_id, test_plan_id, or all_active required" }, 400);
    }

    // Bulk terminate remote if possible.
    const remoteIds = jobs.map((j) => j.checkpoint?.remote_job_id).filter(Boolean) as string[];
    const remoteResults: any[] = [];
    if (remoteIds.length && KEY) {
      try {
        const bulk = await fetch(`${BASE}/v1/jobs/terminate`, {
          method: "POST",
          headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ job_ids: remoteIds, reason }),
          signal: AbortSignal.timeout(20_000),
        });
        remoteResults.push({ bulk: bulk.status, body: (await bulk.text()).slice(0, 400) });
      } catch (e: any) {
        // Fall back to per-job termination.
        for (const rid of remoteIds) {
          remoteResults.push({ id: rid, ...(await terminateRemoteDocJob(BASE, KEY, rid, reason)) });
        }
      }
    }

    // Mark local jobs cancelled and unlock.
    const ids = jobs.map((j) => j.id);
    if (ids.length) {
      await sb.from("jobs").update({
        status: "cancelled",
        locked_at: null,
        locked_by: null,
        error: { message: reason, cancelled_by: "operator" },
      }).in("id", ids);

      // Update test plan status if applicable.
      const planIds = new Set<string>();
      for (const j of jobs) {
        const { data: full } = await sb.from("jobs").select("payload").eq("id", j.id).maybeSingle();
        const pid = (full as any)?.payload?.test_plan_id;
        if (pid) planIds.add(pid);
      }
      if (planIds.size) {
        await sb.from("test_plans").update({ ai_status: "cancelled" }).in("id", Array.from(planIds));
      }
    }

    return json({
      ok: true,
      cancelled_count: ids.length,
      job_ids: ids,
      remote_ids: remoteIds,
      remote_results: remoteResults,
    });
  } catch (e: any) {
    return json({ error: e?.message || "unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
