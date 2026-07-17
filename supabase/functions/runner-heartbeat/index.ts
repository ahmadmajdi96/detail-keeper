// Runner heartbeat endpoint. Authenticated with the raw runner token in
// `Authorization: Bearer <token>`. We hash it and match against runners.token_hash.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Missing runner token" }, 401);
    const hash = await sha256Hex(token);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: runner, error } = await admin
      .from("runners")
      .select("id, status")
      .eq("token_hash", hash)
      .maybeSingle();
    if (error || !runner) return json({ error: "Invalid runner token" }, 401);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const reported = String(body?.status || "").toLowerCase();
    const nextStatus =
      reported === "draining" ? "draining" :
      runner.status === "disabled" ? "disabled" :
      runner.status === "busy" ? "busy" : "idle";

    await admin.from("runners").update({
      last_seen_at: new Date().toISOString(),
      status: nextStatus,
    }).eq("id", runner.id);

    return json({ ok: true, runner_id: runner.id, status: nextStatus });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
