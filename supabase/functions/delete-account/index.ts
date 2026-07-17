// deno-lint-ignore-file no-explicit-any
// Deletes the caller's auth user + their personal data.
// Guard: if the user is the sole owner of any organization that still has other members
// or resources, they must transfer or delete those orgs first.
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
    const { data: userRes } = await asCaller.auth.getUser();
    const user = userRes?.user;
    if (!user) return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: cors });

    const { confirm } = await req.json().catch(() => ({}));
    if (String(confirm || "").trim().toLowerCase() !== "delete my account") {
      return new Response(JSON.stringify({ error: 'confirm must be "delete my account"' }), { status: 400, headers: cors });
    }

    const admin = createClient(supabaseUrl, svcKey);

    // Find orgs owned by this user that still have blocking resources
    const { data: ownedOrgs } = await admin.from("organizations").select("id,name").eq("owner_id", user.id);
    const blockers: any[] = [];
    for (const o of ownedOrgs || []) {
      const [{ count: memberCount }, { count: wsCount }] = await Promise.all([
        admin.from("organization_members").select("*", { count: "exact", head: true }).eq("org_id", o.id).neq("user_id", user.id),
        admin.from("workspaces").select("*", { count: "exact", head: true }).eq("organization_id", o.id),
      ]);
      if ((memberCount || 0) > 0 || (wsCount || 0) > 0) blockers.push({ id: o.id, name: o.name, members: memberCount, workspaces: wsCount });
    }
    if (blockers.length) {
      return new Response(JSON.stringify({
        error: "You are the sole owner of organizations that still contain other members or workspaces. Transfer ownership or delete those organizations first.",
        blockers,
      }), { status: 409, headers: cors });
    }

    // Audit + request row
    for (const o of ownedOrgs || []) {
      await admin.rpc("log_audit", {
        _org_id: o.id, _workspace_id: null,
        _action: "account.delete", _entity_kind: "user", _entity_id: user.id,
        _meta: { email: user.email, at: new Date().toISOString() },
      });
    }
    await admin.from("deletion_requests").insert({ kind: "account", user_id: user.id, requested_by: user.id, status: "requested" });

    // Delete personal orgs (they have no other members/workspaces at this point)
    for (const o of ownedOrgs || []) {
      await admin.from("organizations").delete().eq("id", o.id);
    }

    // Delete auth user (cascades to profile via FK)
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) {
      return new Response(JSON.stringify({ error: delErr.message }), { status: 500, headers: cors });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers: cors });
  }
});
