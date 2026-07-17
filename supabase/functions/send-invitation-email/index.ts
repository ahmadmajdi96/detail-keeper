import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

// Sends a workspace invitation email via Resend if RESEND_API_KEY is configured.
// If not configured, this function silently no-ops (returns { ok: true, sent: false }).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { invitation_id, accept_url } = await req.json().catch(() => ({}));
    if (!invitation_id) return json({ error: "Missing invitation_id" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    const { data: inv } = await admin
      .from("workspace_invitations")
      .select("id,email,role,token,workspace_id")
      .eq("id", invitation_id)
      .maybeSingle();
    if (!inv) return json({ error: "Invitation not found" }, 404);

    const { data: ws } = await admin
      .from("workspaces").select("name").eq("id", inv.workspace_id).maybeSingle();

    const link = accept_url || `https://qualixa.app/invitations/accept?token=${inv.token}`;
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!resendKey) {
      // Graceful no-op — the copy-link UX is the primary delivery mechanism.
      return json({ ok: true, sent: false, reason: "RESEND_API_KEY not configured", link });
    }

    const wsName = ws?.name || "a workspace";
    const html = `
      <div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px;color:#0f172a">
        <h1 style="font-size:20px;margin:0 0 12px">You've been invited to ${wsName}</h1>
        <p style="color:#475569;line-height:1.5">You were invited to join <b>${wsName}</b> on Qualixa as <b>${inv.role}</b>.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#06b6d4;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Accept invitation</a>
        </p>
        <p style="color:#64748b;font-size:12px">Or copy this link: <br/><span style="word-break:break-all">${link}</span></p>
      </div>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM_EMAIL") || "Qualixa <onboarding@resend.dev>",
        to: [inv.email],
        subject: `You've been invited to ${wsName} on Qualixa`,
        html,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error("Resend send failed", resp.status, body);
      return json({ ok: true, sent: false, reason: `resend ${resp.status}`, details: body });
    }

    return json({ ok: true, sent: true });
  } catch (e) {
    console.error("send-invitation-email error", e);
    return json({ ok: true, sent: false, reason: (e as Error).message });
  }
});
