// Pulls recent Jira issues for each mapping, auto-links defects whose summary
// matches an issue (per the mapping's auto_link_rule), and logs results.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const JIRA_CLIENT_ID = Deno.env.get("JIRA_OAUTH_CLIENT_ID")!;
const JIRA_CLIENT_SECRET = Deno.env.get("JIRA_OAUTH_CLIENT_SECRET")!;

async function refreshJiraToken(refreshToken: string) {
  const r = await fetch("https://auth.atlassian.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: JIRA_CLIENT_ID,
      client_secret: JIRA_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });
  if (!r.ok) throw new Error(`jira refresh failed: ${r.status}`);
  return await r.json();
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
  const { data: conn } = await admin
    .from("integration_connections")
    .select("config, sync_enabled, status")
    .eq("workspace_id", workspace_id)
    .eq("slug", "jira")
    .maybeSingle();
  if (!conn || conn.status !== "active" || !conn.sync_enabled) {
    await admin.from("integration_activity_log").insert({ workspace_id, provider: "jira", kind: "sync", status: "error", message: "Jira not connected or sync disabled", user_id: userId });
    return new Response(JSON.stringify({ error: "not_connected" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  let cfg = conn.config as any;
  let token = cfg?.access_token as string | undefined;
  if (!token) {
    return new Response(JSON.stringify({ error: "no_token" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let q = admin.from("jira_project_mappings").select("*").eq("workspace_id", workspace_id);
  if (project_id) q = q.eq("project_id", project_id);
  const { data: mappings } = await q;
  if (!mappings || mappings.length === 0) {
    await admin.from("integration_activity_log").insert({ workspace_id, provider: "jira", kind: "sync", status: "ok", message: "No project mappings configured", counts: { issues: 0 }, user_id: userId });
    return new Response(JSON.stringify({ ok: true, issues: 0, note: "no mappings" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let totalIssues = 0;
  let totalLinked = 0;
  const errors: string[] = [];

  async function jiraFetch(url: string): Promise<Response> {
    let r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    if (r.status === 401 && cfg?.refresh_token) {
      try {
        const refreshed = await refreshJiraToken(cfg.refresh_token);
        token = refreshed.access_token;
        cfg = { ...cfg, ...refreshed };
        await admin.from("integration_connections").update({ config: cfg }).eq("workspace_id", workspace_id).eq("slug", "jira");
        r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
      } catch (e) {
        errors.push(`refresh: ${String(e)}`);
      }
    }
    return r;
  }

  try {
    for (const m of mappings) {
      const jql = encodeURIComponent(`project = "${m.jira_project_key}" AND updated >= -7d ORDER BY updated DESC`);
      const url = `https://api.atlassian.com/ex/jira/${m.jira_cloud_id}/rest/api/3/search?jql=${jql}&maxResults=50&fields=summary,status,issuetype,priority,labels,assignee,updated`;
      const r = await jiraFetch(url);
      if (!r.ok) {
        errors.push(`${m.jira_project_key}: ${r.status}`);
        continue;
      }
      const json = await r.json();
      const issues = (json.issues ?? []) as any[];
      totalIssues += issues.length;

      const siteUrl = m.jira_site_url ?? `https://${m.jira_cloud_id}.atlassian.net`;
      const rule = (m.auto_link_rule as any) ?? { match: "summary", labels: [] };

      // Pre-load defects in this project missing jira link
      const { data: defects } = await admin
        .from("defects")
        .select("id, title, jira_issue_key")
        .eq("project_id", m.project_id)
        .is("jira_issue_key", null);

      for (const issue of issues) {
        const key = issue.key as string;
        const issueUrl = `${siteUrl}/browse/${key}`;
        const summary = (issue.fields?.summary ?? "").toString().toLowerCase().trim();
        const labels: string[] = issue.fields?.labels ?? [];

        // auto-link defects
        if (defects) {
          for (const d of defects) {
            if (d.jira_issue_key) continue;
            const dTitle = (d.title ?? "").toString().toLowerCase().trim();
            let matched = false;
            if (rule.match === "summary" || rule.match === "both") {
              matched = matched || (dTitle.length > 0 && (dTitle === summary || summary.includes(dTitle) || dTitle.includes(summary)));
            }
            if ((rule.match === "labels" || rule.match === "both") && Array.isArray(rule.labels) && rule.labels.length > 0) {
              const inter = labels.filter((l) => rule.labels.includes(l));
              matched = matched || inter.length > 0;
            }
            if (matched) {
              await admin.from("defects").update({ jira_issue_key: key, jira_issue_url: issueUrl }).eq("id", d.id);
              d.jira_issue_key = key;
              totalLinked++;
            }
          }
        }
      }
    }

    await admin.from("integration_connections").update({
      last_sync_at: new Date().toISOString(),
      last_error: errors.length ? errors.slice(0, 3).join("; ") : null,
      last_error_at: errors.length ? new Date().toISOString() : null,
    }).eq("workspace_id", workspace_id).eq("slug", "jira");

    await admin.from("integration_activity_log").insert({
      workspace_id,
      provider: "jira",
      kind: "sync",
      status: errors.length ? "error" : "ok",
      message: errors.length ? errors.slice(0, 5).join("; ") : `Fetched ${totalIssues} issues, auto-linked ${totalLinked} defect(s)`,
      counts: { issues: totalIssues, linked: totalLinked, mappings: mappings.length, errors: errors.length },
      user_id: userId,
    });

    return new Response(JSON.stringify({ ok: true, issues: totalIssues, linked: totalLinked, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = String(e);
    await admin.from("integration_activity_log").insert({ workspace_id, provider: "jira", kind: "sync", status: "error", message: msg, user_id: userId });
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
