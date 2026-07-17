// Fans out an in-app notification to email (Resend) and Slack (incoming webhooks).
// Called by the DB trigger on notifications insert. No-ops gracefully when
// RESEND_API_KEY or a Slack webhook URL is missing — the in-app notification
// row is the source of truth.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Map notification.type -> pref category key
function categoryOf(type: string): string {
  if (type.startsWith("defect_assign")) return "defect_assigned";
  if (type.startsWith("defect")) return "defect_created";
  if (type.startsWith("run") || type.includes("runner_job")) return "run_finished";
  if (type.startsWith("gate")) return "gate_blocked";
  if (type.startsWith("release")) return "release_verdict";
  if (type.startsWith("test_plan") || type.startsWith("testplan")) return "testplan_generated";
  return "generic";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { notification_id } = await req.json();
    if (!notification_id) return json({ error: "notification_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: n, error: nErr } = await admin.from("notifications")
      .select("*").eq("id", notification_id).maybeSingle();
    if (nErr || !n) return json({ error: "notification not found" }, 404);

    const { data: profile } = await admin.from("profiles")
      .select("email, name, notification_prefs, slack_webhook_url, last_workspace_id")
      .eq("id", n.user_id).maybeSingle();

    const prefs = (profile?.notification_prefs || {}) as any;
    const cat = categoryOf(n.type);
    const categoryOn = prefs?.categories?.[cat] !== false;

    // Always considered in-app on. Bail on email/slack per prefs.
    const wantEmail = prefs?.email !== false && categoryOn;
    const wantSlack = prefs?.slack !== false && categoryOn;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const results: Record<string, unknown> = { email: "skipped", slack: "skipped" };

    // ---- Email via Resend ----
    if (wantEmail && RESEND_API_KEY && profile?.email) {
      try {
        const html = `
          <div style="font-family:Inter,system-ui,sans-serif;background:#0b0f1a;color:#e6edf3;padding:24px">
            <div style="max-width:520px;margin:auto;background:#0f1524;border:1px solid rgba(103,232,249,.2);border-radius:14px;padding:24px">
              <h2 style="margin:0 0 8px 0;color:#67e8f9">${escapeHtml(n.title || "Qualixa")}</h2>
              <p style="margin:0 0 16px 0;color:#c9d1d9">${escapeHtml(n.message || "")}</p>
              <p style="margin:0;font-size:12px;color:#8b949e">You're receiving this because notifications are enabled in your Qualixa preferences.</p>
            </div>
          </div>`;
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Qualixa <notifications@qualixa.app>",
            to: [profile.email],
            subject: n.title || "Qualixa notification",
            html,
          }),
        });
        results.email = r.ok ? "sent" : `failed:${r.status}`;
      } catch (e) {
        results.email = `error:${(e as Error).message}`;
      }
    }

    // ---- Slack via incoming webhook ----
    if (wantSlack) {
      let webhookUrl = profile?.slack_webhook_url as string | undefined;
      if (!webhookUrl && profile?.last_workspace_id) {
        const { data: ws } = await admin.from("workspaces")
          .select("slack_webhook_url").eq("id", profile.last_workspace_id).maybeSingle();
        webhookUrl = ws?.slack_webhook_url ?? undefined;
      }
      if (webhookUrl) {
        try {
          const r = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: `*${n.title || "Qualixa"}*\n${n.message || ""}`,
            }),
          });
          results.slack = r.ok ? "sent" : `failed:${r.status}`;
        } catch (e) {
          results.slack = `error:${(e as Error).message}`;
        }
      }
    }

    return json({ ok: true, results });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
