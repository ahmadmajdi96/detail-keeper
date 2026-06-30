// Initiates a 3rd-party OAuth flow (GitHub / Jira) by returning a signed state
// and a fully-formed authorize URL the frontend opens in a popup.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SIGNING_SECRET = Deno.env.get("JOB_WORKER_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: claims } = await supa.auth.getClaims(auth.replace("Bearer ", ""));
    const userId = claims?.claims?.sub;
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const provider = body.provider as "github" | "jira";
    const workspace_id = body.workspace_id as string;
    const project_id = (body.project_id ?? null) as string | null;
    const origin = body.origin as string; // window.location.origin (for postMessage validation)

    if (!provider || !workspace_id || !origin) {
      return new Response(JSON.stringify({ error: "missing_params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nonce = crypto.randomUUID();
    const payload = JSON.stringify({ userId, workspace_id, project_id, provider, origin, nonce, exp: Date.now() + 10 * 60_000 });
    const payloadB64 = btoa(payload).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    const sig = await sign(payloadB64);
    const state = `${payloadB64}.${sig}`;

    const redirectUri = `${SUPABASE_URL}/functions/v1/oauth-${provider}-callback`;

    let authorizeUrl = "";
    if (provider === "github") {
      const clientId = Deno.env.get("GITHUB_OAUTH_CLIENT_ID")!;
      const scope = "repo read:org workflow read:user";
      authorizeUrl =
        `https://github.com/login/oauth/authorize?client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scope)}` +
        `&state=${encodeURIComponent(state)}`;
    } else if (provider === "jira") {
      const clientId = Deno.env.get("JIRA_OAUTH_CLIENT_ID")!;
      const scope =
        "read:jira-user read:jira-work write:jira-work offline_access";
      authorizeUrl =
        `https://auth.atlassian.com/authorize?audience=api.atlassian.com` +
        `&client_id=${clientId}` +
        `&scope=${encodeURIComponent(scope)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&state=${encodeURIComponent(state)}` +
        `&response_type=code&prompt=consent`;
    } else {
      return new Response(JSON.stringify({ error: "unknown_provider" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ authorizeUrl, state }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
