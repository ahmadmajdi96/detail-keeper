// Dispatches / retries webhook deliveries. Called on-demand for retries, or
// on schedule to drain the queue. Accepts either a single delivery_id (retry)
// or drains pending deliveries whose next_retry_at <= now.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function deliver(admin: any, deliveryId: string) {
  const { data: d } = await admin.from("webhook_deliveries").select("*, webhook_endpoints(url,secret,enabled)").eq("id", deliveryId).maybeSingle();
  if (!d) return { ok: false, error: "not found" };
  const ep = d.webhook_endpoints;
  if (!ep?.enabled) return { ok: false, error: "endpoint disabled" };

  const ts = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    id: d.id, event: d.event_type, timestamp: ts,
    data: d.payload,
  });
  const sig = await hmacHex(ep.secret, `${ts}.${body}`);

  const attempts = (d.attempts ?? 0) + 1;
  try {
    const resp = await fetch(ep.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Qualixa-Event": d.event_type,
        "X-Qualixa-Timestamp": ts,
        "X-Qualixa-Signature": `t=${ts},v1=${sig}`,
        "X-Qualixa-Delivery": d.id,
      },
      body,
      signal: AbortSignal.timeout(8000),
    });
    const respText = (await resp.text()).slice(0, 4000);
    const ok = resp.status >= 200 && resp.status < 300;
    await admin.from("webhook_deliveries").update({
      status: ok ? "delivered" : (attempts >= 5 ? "failed" : "retrying"),
      response_code: resp.status, response_body: respText,
      attempts, last_attempt_at: new Date().toISOString(),
      next_retry_at: ok ? null : new Date(Date.now() + Math.min(60_000 * Math.pow(2, attempts), 3600_000)).toISOString(),
    }).eq("id", d.id);
    return { ok, status: resp.status };
  } catch (e) {
    await admin.from("webhook_deliveries").update({
      status: attempts >= 5 ? "failed" : "retrying",
      response_body: (e as Error).message,
      attempts, last_attempt_at: new Date().toISOString(),
      next_retry_at: new Date(Date.now() + Math.min(60_000 * Math.pow(2, attempts), 3600_000)).toISOString(),
    }).eq("id", d.id);
    return { ok: false, error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({}));

  if (body?.delivery_id) {
    const r = await deliver(admin, body.delivery_id);
    return new Response(JSON.stringify(r), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Drain: pick pending or due retries
  const { data: due } = await admin.from("webhook_deliveries").select("id")
    .in("status", ["pending", "retrying"])
    .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
    .limit(50);

  const results: any[] = [];
  for (const row of due ?? []) results.push(await deliver(admin, row.id));
  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
