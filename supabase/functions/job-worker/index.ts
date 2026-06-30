import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { HANDLERS } from "../_shared/handlers.ts";

const BATCH = 5;
const VISIBILITY_SEC = 300; // a job is considered stuck after 5 minutes

async function claimJobs(sb: any, workerId: string) {
  // FOR UPDATE SKIP LOCKED via RPC-ish raw SQL using rpc isn't available;
  // use an UPDATE … RETURNING with a CTE for atomic claim.
  const { data, error } = await sb.rpc("claim_jobs", { _worker: workerId, _limit: BATCH }).then((r: any) => r, () => ({ data: null, error: { message: "no rpc" } }));
  if (data) return data;

  // Fallback: best-effort claim. Race-safe enough because we filter on locked_at expiry.
  const cutoff = new Date(Date.now() - VISIBILITY_SEC * 1000).toISOString();
  const { data: candidates } = await sb.from("jobs")
    .select("id")
    .in("status", ["queued", "retrying"])
    .lte("run_after", new Date().toISOString())
    .or(`locked_at.is.null,locked_at.lt.${cutoff}`)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(BATCH);

  const claimed: any[] = [];
  for (const c of candidates || []) {
    const { data: locked } = await sb.from("jobs").update({
      status: "running",
      locked_at: new Date().toISOString(),
      locked_by: workerId,
      attempt_count: (await sb.from("jobs").select("attempt_count").eq("id", c.id).single()).data?.attempt_count + 1 || 1,
    })
      .eq("id", c.id)
      .in("status", ["queued", "retrying"])
      .select("*")
      .single();
    if (locked) claimed.push(locked);
  }
  return claimed;
}

async function runJob(sb: any, job: any) {
  const attemptNo = job.attempt_count;
  const { data: attempt } = await sb.from("job_attempts").insert({
    job_id: job.id, attempt_no: attemptNo, status: "running",
  }).select("id").single();

  try {
    const handler = HANDLERS[job.kind];
    if (!handler) throw new Error(`No handler for kind: ${job.kind}`);
    const result = await handler(sb, job);
    await sb.from("jobs").update({
      status: "completed", result, error: null, progress: 100, locked_at: null, locked_by: null,
    }).eq("id", job.id);
    if (attempt) await sb.from("job_attempts").update({
      status: "completed", finished_at: new Date().toISOString(),
    }).eq("id", attempt.id);
  } catch (e: any) {
    const msg = e?.message || String(e);
    const errPayload = { message: msg, stack: e?.stack };
    const isDead = job.attempt_count >= job.max_attempts;
    const backoffSec = Math.min(900, 2 ** job.attempt_count * 15); // exp backoff capped 15 min
    await sb.from("jobs").update({
      status: isDead ? "dead_letter" : "retrying",
      error: errPayload,
      run_after: new Date(Date.now() + backoffSec * 1000).toISOString(),
      locked_at: null, locked_by: null,
    }).eq("id", job.id);
    if (attempt) await sb.from("job_attempts").update({
      status: isDead ? "dead_letter" : "failed",
      finished_at: new Date().toISOString(), error: errPayload,
    }).eq("id", attempt.id);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const workerId = crypto.randomUUID();

  try {
    const claimed = await claimJobs(sb, workerId);
    if (!claimed?.length) {
      return new Response(JSON.stringify({ claimed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Run in parallel but bounded by BATCH already
    await Promise.allSettled(claimed.map((j: any) => runJob(sb, j)));
    return new Response(JSON.stringify({ claimed: claimed.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("job-worker error", e);
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
