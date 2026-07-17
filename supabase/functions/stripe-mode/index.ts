// stripe-mode: reports whether Stripe is configured and whether it's in test or live mode.
// Public read; no secrets returned.
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const key = Deno.env.get("STRIPE_SECRET_KEY") || "";
  const configured = !!key;
  const mode = key.startsWith("sk_live_") ? "live" : key.startsWith("sk_test_") ? "test" : "unknown";
  const prices = {
    pro_monthly: !!Deno.env.get("STRIPE_PRICE_PRO_MONTHLY"),
    pro_yearly: !!Deno.env.get("STRIPE_PRICE_PRO_YEARLY"),
    enterprise_monthly: !!Deno.env.get("STRIPE_PRICE_ENTERPRISE_MONTHLY"),
    enterprise_yearly: !!Deno.env.get("STRIPE_PRICE_ENTERPRISE_YEARLY"),
  };
  const webhook_configured = !!Deno.env.get("STRIPE_WEBHOOK_SECRET");
  return new Response(
    JSON.stringify({ configured, mode, prices, webhook_configured }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
