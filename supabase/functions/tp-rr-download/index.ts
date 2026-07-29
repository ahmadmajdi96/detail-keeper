// Proxy the Repo Reader download.zip bundle for the latest job on a test plan.
// Returns the ZIP bytes directly so the browser can save them in one click.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const BASE = (Deno.env.get("REPO_READER_BASE_URL_V1") || "https://reporeader.qualixa.cortanexai.com").replace(/\/+$/, "");
const API_KEY = Deno.env.get("REPO_READER_API_KEY_V1") || "qualixa-repo-reader-key";

const REF: Record<string, string> = {
  cases: "ai_job_ref",
  docs: "docs_job_ref",
  code: "codegen_job_ref",
};

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

    const { test_plan_id, kind = "cases" } = await req.json();
    if (!test_plan_id) return j({ error: "test_plan_id required" }, 400);
    const refCol = REF[kind] ?? REF.cases;

    // RLS-scoped: caller must be able to see the plan.
    const { data: visible } = await supabase
      .from("test_plans").select("id, plan_uid").eq("id", test_plan_id).maybeSingle();
    if (!visible) return j({ error: "Test plan not found" }, 404);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: plan } = await admin
      .from("test_plans").select(`id, ${refCol}`).eq("id", test_plan_id).maybeSingle();
    const jobId = (plan as any)?.[refCol];
    if (!jobId) {
      return j({ error: "No generation job has run for this plan yet — start a generation first." }, 409);
    }

    const res = await fetch(`${BASE}/v1/jobs/${jobId}/download.zip`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      redirect: "follow",
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      if (res.status === 404) {
        return j({ error: "Repo Reader has no downloadable bundle for this job yet — wait for the job to finish and try again." }, 404);
      }
      return j({ error: `Repo Reader ${res.status}: ${detail || "download failed"}` }, res.status >= 500 ? 503 : res.status);
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0) {
      return j({ error: "Repo Reader returned an empty archive for this job." }, 502);
    }
    const name = `${(visible as any).plan_uid || "test-plan"}-${kind}-${jobId}.zip`;
    return new Response(buf, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${name}"`,
        "X-Filename": name,
      },
    });
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
