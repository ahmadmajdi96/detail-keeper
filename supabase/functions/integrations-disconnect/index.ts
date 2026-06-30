// Disconnect a provider connection. Optionally reconnect (returns fresh authorize URL).
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const user = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: claims } = await user.auth.getClaims(auth.replace("Bearer ", ""));
  const userId = claims?.claims?.sub;
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { provider, workspace_id } = await req.json();
  if (!provider || !workspace_id) {
    return new Response(JSON.stringify({ error: "missing_params" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // verify membership
  const { data: m } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!m) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error } = await admin
    .from("integration_connections")
    .update({
      status: "disconnected",
      sync_enabled: false,
      config: { revoked_at: new Date().toISOString() },
    })
    .eq("workspace_id", workspace_id)
    .eq("slug", provider);

  await admin.from("integration_activity_log").insert({
    workspace_id,
    provider,
    kind: "disconnect",
    status: error ? "error" : "ok",
    message: error?.message ?? "Disconnected by user",
    user_id: userId,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
