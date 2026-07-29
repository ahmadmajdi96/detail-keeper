// Poll a Repo Reader SQA testing-plan job and persist its markdown documents
// into test_plan_documents_v2. Safe to call repeatedly (idempotent).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { snapshotTestPlanVersion } from "../_shared/snapshot-version.ts";

const BASE = (Deno.env.get("REPO_READER_BASE_URL_V1") || "https://reporeader.qualixa.cortanexai.com").replace(/\/+$/, "");
const API_KEY = Deno.env.get("REPO_READER_API_KEY_V1") || "qualixa-repo-reader-key";

const DONE = ["succeeded", "completed", "success", "ready"];
const FAILED = ["failed", "error", "canceled", "cancelled"];

const KIND_BY_SLUG: Record<string, string> = {
  "00_sqa_master_test_strategy": "test_strategy",
  "01_sqa_testing_types_matrix": "other",
  "02_sqa_quality_scorecard": "other",
  "03_sqa_test_boundaries": "risk_regression",
  "04_sqa_manual_test_plan": "functional_test_plan",
  "05_sqa_automation_test_plan": "ui_automation_strategy",
  "06_sqa_execution_governance": "environment_plan",
};

function rr(path: string, init: RequestInit = {}) {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${API_KEY}`, Accept: "application/json", ...(init.headers || {}) },
  });
}

function stripMarkdownMetadata(md: string): string {
  return md.replace(/^##\s+Metadata\s*\n(?:(?!^##\s)[\s\S])*/im, "").replace(/\n{3,}/g, "\n\n");
}

function titleFromFilename(filename: string) {
  return filename
    .replace(/\.(md|json|txt|ya?ml)$/i, "")
    .replace(/^\d+[_-]/, "")
    .replace(/^sqa[_-]/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function stageLabel(status: string, progress: number | null) {
  if (DONE.includes(status)) return "Documents generated";
  if (FAILED.includes(status)) return "Failed";
  if (status === "queued") return "Queued on Repo Reader";
  const p = progress ?? 0;
  if (p < 40) return "Reading existing project documents";
  if (p < 85) return "Writing SQA testing plan documents";
  return "Finalising output";
}

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
    const userId = claims.claims.sub as string;

    const { test_plan_id } = await req.json();
    if (!test_plan_id) return j({ error: "test_plan_id required" }, 400);

    const { data: plan } = await supabase
      .from("test_plans")
      .select("id, project_id, docs_job_ref, docs_status")
      .eq("id", test_plan_id)
      .maybeSingle();
    if (!plan) return j({ error: "Test plan not found" }, 404);
    if (!plan.docs_job_ref) return j({ status: plan.docs_status || "idle", no_job: true });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const jobId = plan.docs_job_ref as string;

    const res = await rr(`/v1/jobs/${jobId}`);
    const text = await res.text();
    if (!res.ok) {
      return j({ error: `Repo Reader ${res.status}: ${text.slice(0, 200)}` }, res.status >= 500 ? 503 : res.status);
    }
    const data = JSON.parse(text || "{}");
    const status = String(data.status || data.state || "").toLowerCase();
    const progress = typeof data.progress === "number" ? data.progress : null;
    const done = DONE.includes(status);
    const failed = FAILED.includes(status);
    const label = stageLabel(status, progress);

    if (!done && !failed) {
      await admin.from("test_plans").update({
        docs_status: "running",
        docs_progress: progress ?? 0,
        docs_progress_message: label,
        docs_progress_updated_at: new Date().toISOString(),
      }).eq("id", test_plan_id);
      return j({ status: "running", progress, message: label });
    }

    if (failed) {
      const msg = data.error || `SQA plan job ${status}`;
      await admin.from("test_plans").update({
        docs_status: "failed",
        docs_progress_message: msg,
        docs_progress_updated_at: new Date().toISOString(),
      }).eq("id", test_plan_id);
      await admin.from("generation_stage_logs").insert({
        test_plan_id, kind: "docs", stage: "failed", message: msg,
      });
      return j({ status: "failed", error: msg });
    }

    // ---- completed: list + download all generated documents ----
    const listRes = await rr(`/v1/jobs/${jobId}/documents`);
    if (!listRes.ok) {
      const t = await listRes.text().catch(() => "");
      return j({ error: `Could not list SQA documents (HTTP ${listRes.status}) ${t.slice(0, 200)}` }, 502);
    }
    const listJson = await listRes.json().catch(() => ({}));
    const raw = Array.isArray(listJson) ? listJson : (listJson.documents || listJson.files || listJson.items || []);
    const files: { filename: string; bytes?: number }[] = (Array.isArray(raw) ? raw : [])
      .map((d: any) => (typeof d === "string" ? { filename: d } : { filename: d.filename || d.name || d.path || d.file, bytes: d.bytes ?? d.size }))
      .filter((d: any) => !!d.filename)
      .sort((a: any, b: any) => String(a.filename).localeCompare(String(b.filename)));

    let saved = 0;
    const errors: { filename: string; error: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const filename = files[i].filename;
      const slug = filename.replace(/\.(md|json|txt|ya?ml)$/i, "").toLowerCase();
      try {
        const fr = await rr(`/v1/jobs/${jobId}/documents/${encodeURIComponent(filename)}`);
        if (!fr.ok) { errors.push({ filename, error: `HTTP ${fr.status}` }); continue; }
        const body = await fr.text();
        const content = /\.md$/i.test(filename) ? stripMarkdownMetadata(body) : body;

        const { error } = await admin.from("test_plan_documents_v2").upsert({
          test_plan_id,
          project_id: plan.project_id,
          slug,
          title: titleFromFilename(filename),
          kind: KIND_BY_SLUG[slug] || "other",
          content,
          sort_order: i,
          created_by: userId,
        }, { onConflict: "test_plan_id,slug" });
        if (error) { errors.push({ filename, error: error.message }); continue; }
        saved++;
      } catch (e) {
        errors.push({ filename, error: (e as Error).message });
      }
    }

    const message = saved > 0
      ? `Persisted ${saved} SQA document${saved === 1 ? "" : "s"} from Repo Reader`
      : "SQA job completed but no documents could be read";

    await admin.from("test_plans").update({
      docs_status: saved > 0 ? "ready" : "failed",
      docs_progress: 100,
      docs_progress_message: message,
      docs_progress_updated_at: new Date().toISOString(),
    }).eq("id", test_plan_id);

    await admin.from("generation_stage_logs").insert({
      test_plan_id, kind: "docs", stage: saved > 0 ? "persist" : "failed",
      message, meta: { files: files.map((f) => f.filename), errors },
    });

    if (saved > 0) {
      await snapshotTestPlanVersion(
        admin, test_plan_id,
        `Repo Reader · generated ${saved} SQA document(s)`,
        userId, { stage: "documents", job_id: jobId },
      );
    }

    return j({ status: saved > 0 ? "ready" : "failed", documents: files, saved, errors });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
