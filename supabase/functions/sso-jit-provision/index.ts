// deno-lint-ignore-file no-explicit-any
// JIT provisioning for SSO users: called client-side after signInWithSSO returns
// a session. Adds the user to the org that owns their email domain (if any) and
// ensures a default workspace membership.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    const jwt = auth.replace("Bearer ", "");
    if (!jwt) return new Response(JSON.stringify({ error: "missing auth" }), { status: 401, headers: cors });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const asCaller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
    const { data: ur } = await asCaller.auth.getUser();
    const user = ur?.user;
    if (!user?.email) return new Response(JSON.stringify({ error: "no email" }), { status: 400, headers: cors });

    const admin = createClient(supabaseUrl, svcKey);
    const domain = user.email.split("@")[1]?.toLowerCase();
    if (!domain) return new Response(JSON.stringify({ ok: true, joined: false }), { status: 200, headers: cors });

    const { data: orgId } = await admin.rpc("org_for_sso_domain", { _domain: domain });
    if (!orgId) return new Response(JSON.stringify({ ok: true, joined: false }), { status: 200, headers: cors });

    // Ensure profile has last_organization_id set
    await admin.from("organization_members").upsert(
      { org_id: orgId, user_id: user.id, role: "member" },
      { onConflict: "org_id,user_id", ignoreDuplicates: true },
    );
    await admin.from("profiles").update({ last_organization_id: orgId }).eq("id", user.id);

    // Optional: add to a default workspace in the org
    const { data: defaultWs } = await admin.from("workspaces").select("id").eq("organization_id", orgId).order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (defaultWs?.id) {
      await admin.from("workspace_members").upsert(
        { workspace_id: defaultWs.id, user_id: user.id, role: "member" },
        { onConflict: "workspace_id,user_id", ignoreDuplicates: true },
      );
    }

    await admin.rpc("log_audit", {
      _org_id: orgId, _workspace_id: defaultWs?.id || null,
      _action: "sso.jit_provisioned", _entity_kind: "user", _entity_id: user.id,
      _meta: { domain, at: new Date().toISOString() },
    });

    return new Response(JSON.stringify({ ok: true, joined: true, org_id: orgId }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers: cors });
  }
});
