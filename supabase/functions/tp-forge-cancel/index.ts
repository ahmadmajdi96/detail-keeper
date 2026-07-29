// Cancel an in-flight Repo Reader job for a test plan (test-case generation,
// QA document generation, or Playwright codegen) via POST /v1/jobs/{id}/cancel.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const BASE = (Deno.env.get("REPO_READER_BASE_URL_V1") || "https://reporeader.qualixa.cortanexai.com").replace(/\/+$/, "");
const API_KEY = Deno.env.get("REPO_READER_API_KEY_V1") || "qualixa-repo-reader-key";

type Kind = "cases" | "docs" | "code";

const FIELDS: Record<Kind, { ref: string; status: string; message: string; updated: string; label: string }> = {
  cases: {
    ref: "ai_job_ref", status: "ai_status",
    message: "ai_progress_message", updated: "ai_progress_updated_at",
    label: "Test-case generation",
  },
  docs: {
    ref: "docs_job_ref", status: "docs_status",
    message: "docs_progress_message", updated: "docs_progress_updated_at",
    label: "QA document generation",
  },
  code: {
    ref: "codegen_job_ref", status: "codegen_status",
    message: "codegen_progress_message", updated: "codegen_progress_updated_at",
    label: "Playwright codegen",
  },
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

    const { test_plan_id, kind: rawKind } = await req.json();
    if (!test_plan_id) return j({ error: "test_plan_id required" }, 400);
    const kind: Kind = (["cases", "docs", "code"].includes(rawKind) ? rawKind : "cases") as Kind;
    const f = FIELDS[kind];

    // RLS-scoped read first: the caller must be able to see the plan.
    const { data: visible } = await supabase
      .from("test_plans").select("id").eq("id", test_plan_id).maybeSingle();
    if (!visible) return j({ error: "Test plan not found" }, 404);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: plan } = await admin
      .from("test_plans").select(`id, ${f.ref}, ${f.status}`).eq("id", test_plan_id).maybeSingle();
    if (!plan) return j({ error: "Test plan not found" }, 404);

    const jobId = (plan as any)[f.ref];
    let remote: { ok: boolean; status: number | null; detail: string } = { ok: false, status: null, detail: "no remote job id" };
    if (jobId) {
      try {
        const res = await fetch(`${BASE}/v1/jobs/${jobId}/cancel`, {
          method: "POST",
          headers: { Authorization: `Bearer ${API_KEY}`, Accept: "application/json" },
        });
        const text = await res.text();
        remote = { ok: res.ok, status: res.status, detail: text.slice(0, 300) };
      } catch (e) {
        remote = { ok: false, status: null, detail: (e as Error).message };
      }
    }

    const now = new Date().toISOString();
    await admin.from("test_plans").update({
      [f.status]: "cancelled",
      [f.message]: "Cancelled by user",
      [f.updated]: now,
    } as any).eq("id", test_plan_id);

    await admin.from("generation_stage_logs").insert({
      test_plan_id, kind, stage: "cancelled",
      message: `${f.label} cancelled by user${jobId ? ` (job ${jobId})` : ""}`,
      meta: { job_ref: jobId ?? null, remote_http: remote.status, remote_ok: remote.ok },
    } as any);

    return j({
      status: "cancelled",
      kind,
      job_id: jobId ?? null,
      remote_acknowledged: remote.ok,
      note: remote.ok ? undefined : `Repo Reader did not confirm the cancel (${remote.detail}). The job was marked cancelled locally.`,
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
