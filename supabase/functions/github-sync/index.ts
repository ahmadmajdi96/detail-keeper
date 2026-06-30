// Pulls recent GitHub Actions workflow runs for each mapped repo,
// upserts them into `builds`, and logs the result.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function mapStatus(s: string, c: string | null): string {
  if (s === "completed") return c === "success" ? "success" : c === "cancelled" ? "cancelled" : "failed";
  if (s === "in_progress" || s === "queued" || s === "waiting") return "running";
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const user = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: claims } = await user.auth.getClaims(auth.replace("Bearer ", ""));
  const userId = claims?.claims?.sub;
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { workspace_id, project_id } = await req.json();
  if (!workspace_id) {
    return new Response(JSON.stringify({ error: "missing workspace_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Connection
  const { data: conn } = await admin
    .from("integration_connections")
    .select("config, sync_enabled, status")
    .eq("workspace_id", workspace_id)
    .eq("slug", "github")
    .maybeSingle();
  if (!conn || conn.status !== "active" || !conn.sync_enabled) {
    await admin.from("integration_activity_log").insert({ workspace_id, provider: "github", kind: "sync", status: "error", message: "GitHub not connected or sync disabled", user_id: userId });
    return new Response(JSON.stringify({ error: "not_connected" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const token = (conn.config as any)?.access_token;
  if (!token) {
    return new Response(JSON.stringify({ error: "no_token" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Mappings
  let q = admin.from("github_repo_mappings").select("*").eq("workspace_id", workspace_id);
  if (project_id) q = q.eq("project_id", project_id);
  const { data: mappings } = await q;
  if (!mappings || mappings.length === 0) {
    await admin.from("integration_activity_log").insert({ workspace_id, provider: "github", kind: "sync", status: "ok", message: "No repo mappings configured", counts: { builds: 0 }, user_id: userId });
    return new Response(JSON.stringify({ ok: true, builds: 0, note: "no mappings" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let total = 0;
  const errors: string[] = [];
  try {
    for (const m of mappings) {
      const res = await fetch(`https://api.github.com/repos/${m.owner}/${m.repo}/actions/runs?per_page=20`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      });
      if (!res.ok) {
        errors.push(`${m.owner}/${m.repo}: ${res.status}`);
        continue;
      }
      const json = await res.json();
      const runs = (json.workflow_runs ?? []) as any[];
      for (const r of runs) {
        const payload: Record<string, unknown> = {
          project_id: m.project_id,
          gh_run_id: r.id,
          gh_workflow: r.name,
          gh_html_url: r.html_url,
          name: `${r.name} #${r.run_number}`,
          branch: r.head_branch,
          commit_sha: r.head_sha,
          commit_message: r.head_commit?.message ?? null,
          ci_provider: "github_actions",
          ci_run_url: r.html_url,
          status: mapStatus(r.status, r.conclusion),
          built_at: r.run_started_at ?? r.created_at,
          test_plan_id: m.test_plan_id,
          metadata: { actor: r.actor?.login, event: r.event },
        };
        const { error } = await admin
          .from("builds")
          .upsert(payload, { onConflict: "project_id,gh_run_id" });
        if (error) errors.push(`${m.owner}/${m.repo}#${r.id}: ${error.message}`);
        else total++;
      }
    }

    await admin.from("integration_connections").update({
      last_sync_at: new Date().toISOString(),
      last_error: errors.length ? errors.slice(0, 3).join("; ") : null,
      last_error_at: errors.length ? new Date().toISOString() : null,
    }).eq("workspace_id", workspace_id).eq("slug", "github");

    await admin.from("integration_activity_log").insert({
      workspace_id,
      provider: "github",
      kind: "sync",
      status: errors.length ? "error" : "ok",
      message: errors.length ? errors.slice(0, 5).join("; ") : `Synced ${total} workflow runs`,
      counts: { builds: total, mappings: mappings.length, errors: errors.length },
      user_id: userId,
    });

    return new Response(JSON.stringify({ ok: true, builds: total, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = String(e);
    await admin.from("integration_activity_log").insert({ workspace_id, provider: "github", kind: "sync", status: "error", message: msg, user_id: userId });
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
