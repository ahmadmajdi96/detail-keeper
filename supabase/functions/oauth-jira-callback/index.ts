// Jira (Atlassian 3LO) OAuth callback.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyState, popupResponseHtml } from "../_shared/oauth-state.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("JIRA_OAUTH_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("JIRA_OAUTH_CLIENT_SECRET")!;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return popupResponseHtml({ ok: false, origin: "*", provider: "jira", message: errorParam });
  }
  if (!code || !stateRaw) {
    return popupResponseHtml({ ok: false, origin: "*", provider: "jira", message: "missing code/state" });
  }

  let state;
  try {
    state = await verifyState(stateRaw);
  } catch (e) {
    return popupResponseHtml({ ok: false, origin: "*", provider: "jira", message: String(e) });
  }

  try {
    const redirectUri = `${SUPABASE_URL}/functions/v1/oauth-jira-callback`;
    const tokenRes = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenJson.access_token) {
      return popupResponseHtml({ ok: false, origin: state.origin, provider: "jira", message: tokenJson.error_description ?? "no token" });
    }

    // Fetch accessible resources (cloud sites)
    const resRes = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}`, Accept: "application/json" },
    });
    const sites = await resRes.json();
    const primary = Array.isArray(sites) && sites.length > 0 ? sites[0] : null;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    await admin.from("integration_connections").upsert(
      {
        workspace_id: state.workspace_id,
        project_id: state.project_id,
        slug: "jira",
        name: primary ? `Jira: ${primary.name}` : "Jira",
        status: "active",
        last_sync_at: new Date().toISOString(),
        created_by: state.userId,
        config: {
          access_token: tokenJson.access_token,
          refresh_token: tokenJson.refresh_token ?? null,
          expires_in: tokenJson.expires_in ?? null,
          scope: tokenJson.scope ?? "",
          sites,
          cloud_id: primary?.id ?? null,
          site_url: primary?.url ?? null,
        },
      },
      { onConflict: "workspace_id,slug" },
    );

    await admin.from("integration_activity_log").insert({
      workspace_id: state.workspace_id,
      provider: "jira",
      kind: "oauth_callback",
      status: "ok",
      message: primary ? `Linked ${primary.name}` : "Linked",
      user_id: state.userId,
    });

    return popupResponseHtml({ ok: true, origin: state.origin, provider: "jira", message: primary ? `Linked ${primary.name}` : "Linked" });
  } catch (e) {
    try {
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
      await admin.from("integration_activity_log").insert({
        workspace_id: state?.workspace_id,
        provider: "jira",
        kind: "oauth_callback",
        status: "error",
        message: String(e),
        user_id: state?.userId,
      });
    } catch (_) { /* swallow */ }
    return popupResponseHtml({ ok: false, origin: state?.origin ?? "*", provider: "jira", message: String(e) });
  }
});

