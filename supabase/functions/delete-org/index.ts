// deno-lint-ignore-file no-explicit-any
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

    const { org_id, confirm_slug } = await req.json();
    if (!org_id || !confirm_slug) return new Response(JSON.stringify({ error: "org_id and confirm_slug required" }), { status: 400, headers: cors });

    const admin = createClient(supabaseUrl, svcKey);
    const { data: org } = await admin.from("organizations").select("*").eq("id", org_id).maybeSingle();
    if (!org) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: cors });
    if (org.owner_id !== user.id) return new Response(JSON.stringify({ error: "only org owner can delete" }), { status: 403, headers: cors });
    if (String(confirm_slug).trim().toLowerCase() !== String(org.slug || org.name).toLowerCase()) {
      return new Response(JSON.stringify({ error: "confirmation string does not match" }), { status: 400, headers: cors });
    }

    // Audit + deletion request BEFORE deletion
    await admin.rpc("log_audit", {
      _org_id: org_id, _workspace_id: null,
      _action: "org.delete", _entity_kind: "organization", _entity_id: org_id,
      _meta: { name: org.name, slug: org.slug, at: new Date().toISOString() },
    });
    await admin.from("deletion_requests").insert({
      kind: "organization", org_id, requested_by: user.id, status: "requested",
    });

    // Cancel Stripe subscription if present
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const { data: sub } = await admin.from("subscriptions").select("*").eq("org_id", org_id).maybeSingle();
    if (stripeKey && sub?.stripe_subscription_id) {
      try {
        await fetch(`https://api.stripe.com/v1/subscriptions/${sub.stripe_subscription_id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${stripeKey}` },
        });
      } catch { /* best-effort */ }
    }

    // Hard delete (CASCADE takes care of workspaces/projects/etc via FKs)
    const { error: delErr } = await admin.from("organizations").delete().eq("id", org_id);
    if (delErr) {
      await admin.from("deletion_requests").update({ status: "failed" }).eq("org_id", org_id).eq("status", "requested");
      return new Response(JSON.stringify({ error: delErr.message }), { status: 500, headers: cors });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers: cors });
  }
});
