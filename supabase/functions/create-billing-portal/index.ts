// create-billing-portal: return a Stripe Billing Portal URL for the caller's org.
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";
import { corsHeaders } from "../_shared/cors.ts";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), {
  status: s, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.warn("[create-billing-portal] STRIPE_SECRET_KEY not configured");
      return json({ error: "billing_not_configured" });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await sb.auth.getClaims(token);
    if (!claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({} as any));
    const origin = body.origin || req.headers.get("origin") || "";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: prof } = await admin.from("profiles").select("last_organization_id").eq("id", userId).maybeSingle();
    let orgId: string | null = prof?.last_organization_id || null;
    if (!orgId) {
      const { data: owned } = await admin.from("organizations").select("id").eq("owner_id", userId).limit(1).maybeSingle();
      orgId = owned?.id || null;
    }
    if (!orgId) return json({ error: "no organization" }, 400);

    const { data: roleData } = await admin.rpc("org_role_of", { _org_id: orgId });
    if (!["owner", "billing_admin"].includes(String(roleData || ""))) return json({ error: "forbidden" }, 403);

    const { data: sub } = await admin.from("subscriptions").select("stripe_customer_id").eq("org_id", orgId).maybeSingle();
    if (!sub?.stripe_customer_id) return json({ error: "no_customer" }, 400);

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-11-20.acacia" });
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/billing`,
    });
    return json({ url: portal.url });
  } catch (e) {
    console.error("[create-billing-portal] error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
