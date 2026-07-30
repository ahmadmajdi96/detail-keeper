// Cancel an in-flight live Playwright execution at Repo Reader.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const BASE = (Deno.env.get("REPO_READER_BASE_URL_V1") || "https://reporeader.qualixa.cortanexai.com").replace(/\/+$/, "");
const API_KEY = Deno.env.get("REPO_READER_API_KEY_V1") || "qualixa-repo-reader-key";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return j({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) return j({ error: "Unauthorized" }, 401);

    const { plan_test_run_id, reason } = await req.json();
    if (!plan_test_run_id) return j({ error: "plan_test_run_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: row } = await admin.from("plan_test_runs")
      .select("forge_run_id, status").eq("id", plan_test_run_id).maybeSingle();
    if (!row) return j({ error: "Not found" }, 404);

    if ((row as any).forge_run_id) {
      try {
        await fetch(`${BASE}/v1/jobs/${encodeURIComponent((row as any).forge_run_id)}/cancel`, {
          method: "POST",
          headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason || "User canceled live execution" }),
        });
      } catch (_) { /* best-effort */ }
    }

    const now = new Date().toISOString();
    await admin.from("plan_test_runs").update({
      status: "cancelled",
      finished_at: now,
      live_view_url: null,
      live_view_status: "unavailable",
      execution_phase: "canceled",
      progress_message: "Cancelled by user",
    }).eq("id", plan_test_run_id);

    return j({ status: "cancelled" });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
