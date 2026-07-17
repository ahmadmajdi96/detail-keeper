// send-trial-reminder — no-ops without RESEND_API_KEY.
// Meant to be invoked by a scheduler with { org_ids?: string[] } or empty (finds soon-to-expire trials).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const resendKey = Deno.env.get("RESEND_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!resendKey) {
    console.log("send-trial-reminder: RESEND_API_KEY not configured — no-op");
    return new Response(JSON.stringify({ skipped: true, reason: "resend_not_configured" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Find trials expiring in the next 3 days
  const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: subs, error } = await supabase
    .from("subscriptions")
    .select("org_id, trial_ends_at, organizations!inner(id, name, owner_id)")
    .eq("status", "trialing")
    .lte("trial_ends_at", soon)
    .gt("trial_ends_at", new Date().toISOString());

  if (error) {
    console.error("send-trial-reminder query failed", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  for (const s of subs || []) {
    const ownerId = (s as any).organizations?.owner_id;
    if (!ownerId) continue;
    const { data: profile } = await supabase.from("profiles").select("email, name").eq("id", ownerId).maybeSingle();
    if (!profile?.email) continue;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Qualixa <noreply@qualixa.app>",
          to: [profile.email],
          subject: "Your Qualixa Pro trial is ending soon",
          html: `<p>Hi ${profile.name || "there"},</p>
          <p>Your 14-day Pro trial ends on <strong>${new Date(s.trial_ends_at!).toLocaleDateString()}</strong>. Add a payment method to keep Pro features active — or continue on our Free plan.</p>
          <p><a href="https://qualixa.app/billing">Manage billing</a></p>`,
        }),
      });
      if (res.ok) sent++;
    } catch (e) {
      console.error("resend send failed", e);
    }
  }

  return new Response(JSON.stringify({ sent, examined: subs?.length || 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
