// stripe-webhook: single source of truth that flips org subscription state.
// Public endpoint — verify_jwt=false; validated by Stripe signature.
// Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// Plan mapping: reads plan_key from subscription/session metadata or the
// Stripe product's metadata (product.metadata.plan_key).
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";
import { corsHeaders } from "../_shared/cors.ts";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), {
  status: s, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

type Status = "trialing" | "active" | "past_due" | "canceled";
function mapStatus(s: string): Status {
  if (s === "trialing") return "trialing";
  if (["active", "past_due", "unpaid", "incomplete", "incomplete_expired", "canceled"].includes(s)) {
    if (s === "past_due" || s === "unpaid") return "past_due";
    if (s === "canceled" || s === "incomplete_expired") return "canceled";
    return "active";
  }
  return "active";
}

async function resolvePlanKey(stripe: Stripe, subscription: Stripe.Subscription): Promise<string> {
  const metaKey = subscription.metadata?.plan_key;
  if (metaKey) return metaKey;
  const item = subscription.items.data[0];
  if (!item) return "free";
  const priceId = typeof item.price === "string" ? item.price : item.price.id;
  const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
  const product = price.product as Stripe.Product;
  if (product?.metadata?.plan_key) return product.metadata.plan_key;
  // Fallback: match against env price IDs
  const map: Record<string, string> = {
    STRIPE_PRICE_PRO_MONTHLY: "pro",
    STRIPE_PRICE_PRO_YEARLY: "pro",
    STRIPE_PRICE_ENTERPRISE_MONTHLY: "enterprise",
    STRIPE_PRICE_ENTERPRISE_YEARLY: "enterprise",
  };
  for (const [envName, key] of Object.entries(map)) {
    if (Deno.env.get(envName) === priceId) return key;
  }
  return "pro";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const whSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !whSecret) {
    console.warn("[stripe-webhook] Stripe not configured; ignoring event");
    return json({ ok: true, skipped: "billing_not_configured" });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-11-20.acacia" });
  const sig = req.headers.get("stripe-signature");
  const bodyText = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(bodyText, sig!, whSecret);
  } catch (e) {
    console.error("[stripe-webhook] signature verification failed", (e as Error).message);
    return json({ error: "invalid_signature" }, 400);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  async function upsertFromSub(sub: Stripe.Subscription, orgIdHint?: string) {
    const orgId = orgIdHint || sub.metadata?.org_id;
    if (!orgId) { console.warn("no org_id on subscription", sub.id); return; }
    const planKey = await resolvePlanKey(stripe, sub);
    const patch = {
      plan_key: planKey,
      status: mapStatus(sub.status),
      current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end,
      stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
    };
    // Idempotent upsert on unique org_id
    const { error } = await admin.from("subscriptions").upsert({ org_id: orgId, ...patch }, { onConflict: "org_id" });
    if (error) console.error("upsert subscription error", error);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = (session.metadata?.org_id) || (session.client_reference_id || undefined);
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          await upsertFromSub(sub, orgId || undefined);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        // Mark canceled explicitly on deletion
        if (event.type === "customer.subscription.deleted") {
          const orgId = sub.metadata?.org_id;
          if (orgId) {
            await admin.from("subscriptions").update({
              status: "canceled", plan_key: "free",
              cancel_at_period_end: false, stripe_subscription_id: null,
            }).eq("org_id", orgId);
            break;
          }
        }
        await upsertFromSub(sub);
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        if (inv.subscription) {
          const sub = await stripe.subscriptions.retrieve(inv.subscription as string);
          await upsertFromSub(sub);
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("[stripe-webhook] handler error", e);
    return json({ error: (e as Error).message }, 500);
  }

  return json({ received: true });
});
