// GitHub OAuth callback: exchanges code -> token, stores in integration_connections,
// then closes the popup via postMessage.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyState, popupResponseHtml } from "../_shared/oauth-state.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("GITHUB_OAUTH_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GITHUB_OAUTH_CLIENT_SECRET")!;

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return popupResponseHtml({ ok: false, origin: "*", provider: "github", message: errorParam });
  }
  if (!code || !stateRaw) {
    return popupResponseHtml({ ok: false, origin: "*", provider: "github", message: "missing code/state" });
  }

  let state;
  try {
    state = await verifyState(stateRaw);
  } catch (e) {
    return popupResponseHtml({ ok: false, origin: "*", provider: "github", message: String(e) });
  }

  try {
    const redirectUri = `${SUPABASE_URL}/functions/v1/oauth-github-callback`;
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenJson.access_token) {
      return popupResponseHtml({ ok: false, origin: state.origin, provider: "github", message: tokenJson.error_description ?? "no token" });
    }

    // Fetch user info for display
    const meRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}`, Accept: "application/vnd.github+json" },
    });
    const me = await meRes.json();

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    await admin.from("integration_connections").upsert(
      {
        workspace_id: state.workspace_id,
        project_id: state.project_id,
        slug: "github",
        name: `GitHub: ${me?.login ?? "user"}`,
        status: "active",
        last_sync_at: new Date().toISOString(),
        created_by: state.userId,
        config: {
          access_token: tokenJson.access_token,
          token_type: tokenJson.token_type ?? "bearer",
          scope: tokenJson.scope ?? "",
          account: { login: me?.login, id: me?.id, avatar_url: me?.avatar_url, name: me?.name },
        },
      },
      { onConflict: "workspace_id,slug" },
    );

    return popupResponseHtml({ ok: true, origin: state.origin, provider: "github", message: `Linked @${me?.login ?? ""}` });
  } catch (e) {
    return popupResponseHtml({ ok: false, origin: state?.origin ?? "*", provider: "github", message: String(e) });
  }
});
