// Runner -> Qualixa callback: status updates, progress, logs, final result.
// No JWT: validated by runner_job_id + optional runner token hash.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const { runner_job_id, status, progress, logs_url, result, error } = body || {};
    if (!runner_job_id || !status) return json({ error: "runner_job_id + status required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const updates: Record<string, unknown> = { status };
    if (progress !== undefined) updates.progress = progress;
    if (logs_url) updates.logs_url = logs_url;
    if (result) updates.result = result;
    if (error) updates.error = error;
    if (status === "running") updates.started_at = new Date().toISOString();
    if (["succeeded", "failed", "timeout", "cancelled"].includes(status)) updates.finished_at = new Date().toISOString();

    const { data, error: upErr } = await admin
      .from("runner_jobs").update(updates).eq("id", runner_job_id).select("*").single();
    if (upErr) return json({ error: upErr.message }, 500);

    // Heartbeat runner
    if (data.runner_id) {
      await admin.from("runners").update({
        last_seen_at: new Date().toISOString(),
        status: ["running", "dispatched"].includes(status) ? "busy" : "idle",
        current_job_id: ["running", "dispatched"].includes(status) ? runner_job_id : null,
      }).eq("id", data.runner_id);
    }

    // Meter runner minutes on terminal states
    if (["succeeded", "failed", "timeout", "cancelled"].includes(status) && data.started_at && data.project_id) {
      try {
        const startedAt = new Date(data.started_at).getTime();
        const finishedAt = Date.now();
        const minutes = Math.max(0, (finishedAt - startedAt) / 60000);
        if (minutes > 0) {
          const { data: proj } = await admin.from("projects").select("workspace_id").eq("id", data.project_id).maybeSingle();
          if (proj?.workspace_id) {
            const { data: ws } = await admin.from("workspaces").select("organization_id").eq("id", proj.workspace_id).maybeSingle();
            if (ws?.organization_id) {
              await admin.from("usage_events").insert({
                org_id: ws.organization_id, kind: "runner_minutes", quantity: minutes,
                ref: { runner_job_id, status },
              });
            }
          }
        }
      } catch (e) {
        console.error("runner minutes meter error", e);
      }
    }


    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
