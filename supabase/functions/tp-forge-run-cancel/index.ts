// Cancel an in-flight plan_test_run at TestCase Forge and mark it cancelled locally.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const FORGE_BASE = "https://testgenerator.qualixa.cortanexai.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return j({ error: "Unauthorized" }, 401);
    const apiKey = Deno.env.get("TESTGEN_API_KEY");
    if (!apiKey) return j({ error: "TESTGEN_API_KEY is not configured" }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) return j({ error: "Unauthorized" }, 401);

    const { plan_test_run_id } = await req.json();
    if (!plan_test_run_id) return j({ error: "plan_test_run_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: row } = await admin.from("plan_test_runs").select("forge_run_id, status").eq("id", plan_test_run_id).maybeSingle();
    if (!row) return j({ error: "Not found" }, 404);

    if ((row as any).forge_run_id) {
      try {
        await fetch(`${FORGE_BASE}/v1/test-runs/${(row as any).forge_run_id}/cancel`, {
          method: "POST",
          headers: { authorization: `Bearer ${apiKey}` },
        });
      } catch (_) { /* best-effort */ }
    }
    const now = new Date().toISOString();
    await admin.from("plan_test_runs").update({
      status: "cancelled", finished_at: now, progress_message: "Cancelled by user",
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
