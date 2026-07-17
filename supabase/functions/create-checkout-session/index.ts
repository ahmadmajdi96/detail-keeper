// create-checkout-session: create a Stripe subscription checkout for the caller's org.
// Env vars used (all optional at runtime — the function degrades gracefully):
//   STRIPE_SECRET_KEY
//   STRIPE_PRICE_PRO_MONTHLY
//   STRIPE_PRICE_PRO_YEARLY
//   STRIPE_PRICE_ENTERPRISE_MONTHLY
//   STRIPE_PRICE_ENTERPRISE_YEARLY
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";
import { corsHeaders } from "../_shared/cors.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.warn("[create-checkout-session] STRIPE_SECRET_KEY not configured");
      return json({ error: "billing_not_configured" });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({} as any));
    const planKey = body.plan_key as string;
    const interval = (body.interval as string) || "monthly";
    const origin = body.origin || req.headers.get("origin") || "";
    if (!["pro", "enterprise"].includes(planKey)) return json({ error: "invalid plan_key" }, 400);
    if (!["monthly", "yearly"].includes(interval)) return json({ error: "invalid interval" }, 400);

    const priceEnv = `STRIPE_PRICE_${planKey.toUpperCase()}_${interval.toUpperCase()}`;
    const priceId = Deno.env.get(priceEnv);
    if (!priceId) {
      console.warn(`[create-checkout-session] Missing ${priceEnv}`);
      return json({ error: "price_not_configured", missing: priceEnv });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: prof } = await admin
      .from("profiles").select("id,email,name,last_organization_id").eq("id", userId).maybeSingle();
    if (!prof) return json({ error: "profile not found" }, 404);

    // Resolve caller's org: prefer last_organization_id, else the first they own/are member of
    let orgId: string | null = prof.last_organization_id;
    if (!orgId) {
      const { data: owned } = await admin.from("organizations").select("id").eq("owner_id", userId).limit(1).maybeSingle();
      orgId = owned?.id || null;
      if (!orgId) {
        const { data: mem } = await admin.from("organization_members").select("org_id").eq("user_id", userId).limit(1).maybeSingle();
        orgId = mem?.org_id || null;
      }
    }
    if (!orgId) return json({ error: "no organization" }, 400);

    // Only owner or billing_admin may checkout
    const { data: roleData } = await admin.rpc("org_role_of", { _org_id: orgId });
    if (!["owner", "billing_admin"].includes(String(roleData || ""))) {
      return json({ error: "forbidden" }, 403);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-11-20.acacia" });

    // Ensure stripe customer
    const { data: sub } = await admin.from("subscriptions").select("*").eq("org_id", orgId).maybeSingle();
    let customerId = sub?.stripe_customer_id || null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: prof.email,
        name: prof.name || undefined,
        metadata: { org_id: orgId, user_id: userId },
      });
      customerId = customer.id;
      await admin.from("subscriptions").update({ stripe_customer_id: customerId }).eq("org_id", orgId);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing?success=1`,
      cancel_url: `${origin}/billing?canceled=1`,
      subscription_data: { metadata: { org_id: orgId, plan_key: planKey } },
      client_reference_id: orgId,
      metadata: { org_id: orgId, plan_key: planKey },
    });

    return json({ url: session.url });
  } catch (e) {
    console.error("[create-checkout-session] error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
