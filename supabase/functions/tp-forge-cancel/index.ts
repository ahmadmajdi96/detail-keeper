// Cancel an in-flight test-case generation for a plan. Best-effort:
// asks the Repo Reader service to cancel, then flips the plan status locally.
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

    const { test_plan_id } = await req.json();
    if (!test_plan_id) return j({ error: "test_plan_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: plan } = await admin
      .from("test_plans").select("id, ai_job_ref").eq("id", test_plan_id).maybeSingle();
    if (!plan) return j({ error: "Test plan not found" }, 404);

    const jobId = (plan as any).ai_job_ref;
    if (jobId) {
      // Try both common cancel routes; ignore failures — local flip still runs.
      for (const url of [
        `${FORGE_BASE}/v1/test-generations/${jobId}/cancel`,
        `${FORGE_BASE}/v1/test-generations/${jobId}`,
      ]) {
        try {
          await fetch(url, {
            method: url.endsWith("/cancel") ? "POST" : "DELETE",
            headers: { authorization: `Bearer ${apiKey}` },
          });
        } catch { /* ignore */ }
      }
    }

    await admin.from("test_plans").update({
      ai_status: "failed",
      ai_progress_message: "Cancelled by user",
      ai_progress_updated_at: new Date().toISOString(),
    }).eq("id", test_plan_id);

    return j({ status: "cancelled" });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
