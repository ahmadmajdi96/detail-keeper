// Server-side proxy to the Repo Reader service (v1).
// Base: https://reporeader.qualixa.cortanexai.com
// Keeps the API key off the client and lets the frontend act on cloned
// repositories with only a project_id. Also mirrors generated documents into
// project_generated_docs so they can be edited by users.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const DEFAULT_BASE = "https://reporeader.qualixa.cortanexai.com";
const DEFAULT_KEY = "qualixa-repo-reader-key";

// Env overrides are honoured only when they point at a v1-compatible deployment.
const BASE = (Deno.env.get("REPO_READER_BASE_URL_V1") || DEFAULT_BASE).replace(/\/+$/, "");
const API_KEY = Deno.env.get("REPO_READER_API_KEY_V1") || DEFAULT_KEY;

const DONE = ["succeeded", "completed", "success", "ready"];
const FAILED = ["failed", "error", "canceled", "cancelled"];

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

class UpstreamUnreachable extends Error {}

async function rr(path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = () =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Accept: "application/json",
        ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(init.headers || {}),
      },
    });

  try {
    let res = await doFetch();
    // Transient gateway errors: retry once after a short delay (not for uploads).
    if ([502, 503, 504].includes(res.status) && !(init.body instanceof FormData)) {
      await new Promise((r) => setTimeout(r, 1200));
      res = await doFetch();
    }
    return res;
  } catch (e) {
    throw new UpstreamUnreachable(
      `Repo Reader service unreachable at ${BASE}. (${(e as Error).message})`,
    );
  }
}

/** Turn an upstream failure (often raw nginx HTML) into a clean, actionable message. */
function upstreamError(status: number, text: string) {
  const isHtml = /^\s*<(!doctype|html)/i.test(text);
  if ([502, 503, 504].includes(status) || isHtml) {
    return j(
      {
        error:
          "The Repo Reader service is temporarily unavailable (gateway error). It may be restarting — please retry in a minute.",
        code: "upstream_unavailable",
        upstream_status: status,
      },
      503,
    );
  }
  let detail = text.slice(0, 400);
  try {
    const parsed = JSON.parse(text);
    detail = parsed?.error || parsed?.detail || parsed?.message || detail;
  } catch { /* keep raw text */ }
  return j({ error: `Repo Reader ${status}: ${detail}`, code: "upstream_error", upstream_status: status }, status);
}

async function passthrough(res: Response) {
  const text = await res.text();
  if (!res.ok) return upstreamError(res.status, text);
  return new Response(text || "{}", {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}


function normalizeDocs(payload: any): any[] {
  const raw = Array.isArray(payload)
    ? payload
    : payload?.documents || payload?.files || payload?.items || [];
  return (Array.isArray(raw) ? raw : []).map((d: any) => {
    if (typeof d === "string") return { filename: d, bytes: undefined };
    return {
      filename: d.filename || d.name || d.path || d.file,
      bytes: d.bytes ?? d.size,
      title: d.title,
      slug: d.slug,
    };
  }).filter((d: any) => !!d.filename);
}

/** Drop the generator's "## Metadata" envelope from markdown documents. */
function stripMarkdownMetadata(md: string): string {
  return md.replace(/^##\s+Metadata\s*\n(?:(?!^##\s)[\s\S])*/im, "").replace(/\n{3,}/g, "\n\n");
}

async function fetchDocContent(jobId: string, filename: string): Promise<string | null> {
  const fr = await rr(`/v1/jobs/${jobId}/documents/${encodeURIComponent(filename)}`);
  if (!fr.ok) return null;
  const isMarkdown = /\.md$/i.test(filename);
  const ct = fr.headers.get("content-type") || "";
  if (ct.includes("application/json") && !isMarkdown) {
    const jd = await fr.json().catch(() => null);
    if (jd == null) return "";
    if (typeof jd === "string") return jd;
    if (typeof jd?.content === "string") return jd.content;
    return JSON.stringify(jd, null, 2);
  }
  const text = await fr.text();
  return isMarkdown ? stripMarkdownMetadata(text) : text;
}

function titleFromFilename(filename: string) {
  return filename
    .replace(/\.(md|json|txt|ya?ml)$/i, "")
    .replace(/^\d+[_-]/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function syncDocuments(admin: any, projectId: string, jobId: string) {
  const fileErrors: { filename: string; error: string }[] = [];
  try {
    const res = await rr(`/v1/jobs/${jobId}/documents`);
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { synced: 0, error: `Could not list documents (HTTP ${res.status}) ${t.slice(0, 200)}`, file_errors: fileErrors, files: [] };
    }
    const docs = normalizeDocs(await res.json().catch(() => ({})));
    let synced = 0;
    for (const d of docs) {
      const filename: string = d.filename;
      const slug = d.slug || filename.replace(/\.(md|json|txt|ya?ml)$/i, "");
      const title = d.title || titleFromFilename(filename);

      // Skip if the user has edited this doc already
      const { data: existing } = await admin
        .from("project_generated_docs")
        .select("id, edited")
        .eq("project_id", projectId).eq("slug", slug).maybeSingle();
      if (existing?.edited) continue;

      let content: string | null = null;
      try {
        content = await fetchDocContent(jobId, filename);
      } catch (e) {
        fileErrors.push({ filename, error: (e as Error).message });
        continue;
      }
      if (content == null) {
        fileErrors.push({ filename, error: "Upstream returned no content for this file (download failed)." });
        continue;
      }

      const { error: upErr } = await admin.from("project_generated_docs").upsert({
        project_id: projectId,
        job_id: jobId,
        slug, filename, title, content,
        source_bytes: d.bytes ?? content.length,
        edited: false,
      }, { onConflict: "project_id,slug" });
      if (upErr) {
        fileErrors.push({ filename, error: `Could not save document: ${upErr.message}` });
        continue;
      }
      synced++;
    }
    return {
      synced,
      total: docs.length,
      files: docs.map((d: any) => ({ filename: d.filename, bytes: d.bytes ?? null, title: d.title ?? null })),
      file_errors: fileErrors,
    };
  } catch (e) {
    return { synced: 0, error: (e as Error).message, file_errors: fileErrors, files: [] };
  }
}

/** Create an ingest-job history row (and a matching Documents entry for uploads). */
async function recordIngest(
  admin: any,
  opts: {
    projectId: string;
    workspaceId: string | null;
    ingestType: string;
    sourceName: string;
    jobRef: string | null;
    status: string;
    userId: string | null;
    payload?: Record<string, unknown>;
    fileSize?: number;
    mimeType?: string;
  },
) {
  let documentId: string | null = null;
  try {
    const { data: doc } = await admin.from("documents").insert({
      project_id: opts.projectId,
      workspace_id: opts.workspaceId,
      filename: opts.sourceName,
      file_size: opts.fileSize ?? 0,
      mime_type: opts.mimeType || "application/octet-stream",
      status: "processing",
      uploader_id: opts.userId,
    }).select("id").maybeSingle();
    documentId = doc?.id ?? null;
  } catch { /* documents mirror is best-effort */ }

  await admin.from("ingest_jobs").insert({
    project_id: opts.projectId,
    workspace_id: opts.workspaceId,
    job_ref: opts.jobRef,
    ingest_type: opts.ingestType,
    source_name: opts.sourceName,
    status: opts.status || "queued",
    stage: "Submitted to Repo Reader",
    progress: 0,
    payload: opts.payload || {},
    document_id: documentId,
    created_by: opts.userId,
    stages: [{ stage: "queued", at: new Date().toISOString() }],
  });
  return documentId;
}

function stageLabel(status: string, progress: number | null) {
  if (DONE.includes(status)) return "Documents generated";
  if (FAILED.includes(status)) return "Failed";
  if (status === "queued") return "Queued";
  const p = progress ?? 0;
  if (p < 25) return "Cloning / unpacking source";
  if (p < 55) return "Scanning files";
  if (p < 85) return "Generating documents with AI";
  return "Finalising output";
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return j({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
    const action = body.action || url.searchParams.get("action") || "";
    const projectId = body.project_id || url.searchParams.get("project_id");
    if (!projectId) return j({ error: "project_id required" }, 400);

    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("id, repo_job_id, github_url, github_branch, github_repo_visibility")
      .eq("id", projectId).maybeSingle();
    if (pErr || !project) return j({ error: "Project not found or forbidden" }, 403);

    // -------- BRANCHES (no job required) --------
    if (action === "branches") {
      const repo_url = body.repo_url || project.github_url;
      if (!repo_url) return j({ error: "repo_url required" }, 400);
      const res = await rr(`/v1/repositories/branches`, {
        method: "POST",
        body: JSON.stringify({ repo_url, access_token: body.access_token || null }),
      });
      return passthrough(res);
    }

    // -------- CLONE --------
    if (action === "clone") {
      const repo_url = body.repo_url || project.github_url;
      const branch = body.branch || project.github_branch || "main";
      const visibility = body.visibility || project.github_repo_visibility || "public";
      const access_token = body.access_token || null;
      if (!repo_url) return j({ error: "repo_url required" }, 400);
      if (visibility === "private" && !access_token) {
        return j({ error: "access_token required for private repositories" }, 400);
      }

      const res = await rr(`/v1/repositories/clone`, {
        method: "POST",
        body: JSON.stringify({
          repo_url,
          branch,
          ...(access_token ? { access_token } : {}),
          forward_to_test_doc: body.forward_to_test_doc ?? false,
          metadata: { project_id: projectId, ...(body.metadata || {}) },
        }),
      });
      const text = await res.text();
      if (!res.ok) return upstreamError(res.status, text);
      const data = JSON.parse(text);
      const jobId = data.id || data.job_id;
      await admin.from("projects").update({
        repo_job_id: jobId,
        repo_job_status: data.status || "queued",
        repo_job_progress: data.progress ?? 0,
        repo_job_meta: data,
        status: "processing",
        github_url: repo_url,
        github_branch: branch,
        github_repo_visibility: visibility,
      }).eq("id", projectId);
      return j({ job_id: jobId, status: data.status || "queued", raw: data });
    }

    // -------- ZIP UPLOAD (base64 payload from the client) --------
    if (action === "upload") {
      const { filename = "repository.zip", file_base64 } = body;
      if (!file_base64) return j({ error: "file_base64 required" }, 400);
      const bytes = Uint8Array.from(atob(file_base64), (c) => c.charCodeAt(0));
      const fd = new FormData();
      fd.append("file", new Blob([bytes], { type: "application/zip" }), filename);
      fd.append("forward_to_test_doc", String(body.forward_to_test_doc ?? false));
      fd.append("metadata", JSON.stringify({ project_id: projectId, ...(body.metadata || {}) }));

      const res = await rr(`/v1/repositories/upload`, { method: "POST", body: fd });
      const text = await res.text();
      if (!res.ok) return upstreamError(res.status, text);
      const data = JSON.parse(text);
      const jobId = data.id || data.job_id;
      await admin.from("projects").update({
        repo_job_id: jobId,
        repo_job_status: data.status || "queued",
        repo_job_progress: data.progress ?? 0,
        repo_job_meta: data,
        status: "processing",
      }).eq("id", projectId);
      return j({ job_id: jobId, status: data.status || "queued", raw: data });
    }

    // -------- BRD TEXT --------
    if (action === "brd-generate") {
      const { filename = "system-brd.md", content } = body;
      if (!content) return j({ error: "content required" }, 400);
      const res = await rr(`/v1/brd/generate`, {
        method: "POST",
        body: JSON.stringify({
          filename,
          content,
          forward_to_test_doc: body.forward_to_test_doc ?? false,
          metadata: { project_id: projectId, ...(body.metadata || {}) },
        }),
      });
      const text = await res.text();
      if (!res.ok) return upstreamError(res.status, text);
      const data = JSON.parse(text);
      const newJobId = data.id || data.job_id;
      await admin.from("projects").update({
        repo_job_id: newJobId,
        repo_job_status: data.status || "queued",
        repo_job_progress: data.progress ?? 0,
        repo_job_meta: data,
        status: "processing",
      }).eq("id", projectId);
      return j({ job_id: newJobId, status: data.status || "queued", raw: data });
    }

    // -------- BRD FILE / BRD ZIP UPLOAD --------
    if (action === "brd-upload") {
      const { filename = "brd-input.zip", file_base64, content_type } = body;
      if (!file_base64) return j({ error: "file_base64 required" }, 400);
      const bytes = Uint8Array.from(atob(file_base64), (c) => c.charCodeAt(0));
      const fd = new FormData();
      fd.append(
        "file",
        new Blob([bytes], { type: content_type || "application/octet-stream" }),
        filename,
      );
      fd.append("forward_to_test_doc", String(body.forward_to_test_doc ?? false));
      fd.append("metadata", JSON.stringify({ project_id: projectId, ...(body.metadata || {}) }));

      const res = await rr(`/v1/brd/upload`, { method: "POST", body: fd });
      const text = await res.text();
      if (!res.ok) return upstreamError(res.status, text);
      const data = JSON.parse(text);
      const newJobId = data.id || data.job_id;
      await admin.from("projects").update({
        repo_job_id: newJobId,
        repo_job_status: data.status || "queued",
        repo_job_progress: data.progress ?? 0,
        repo_job_meta: data,
        status: "processing",
      }).eq("id", projectId);
      return j({ job_id: newJobId, status: data.status || "queued", raw: data });
    }

    const jobId = project.repo_job_id;
    if (!jobId) return j({ status: "none", no_job: true, message: "Project has no repo job yet." }, 200);

    // -------- JOB STATUS --------
    if (action === "job") {
      const res = await rr(`/v1/jobs/${jobId}`);
      const text = await res.text();
      if (!res.ok) return upstreamError(res.status, text);
      const data = JSON.parse(text);
      const status = String(data.status || data.state || "").toLowerCase();
      const done = DONE.includes(status);
      const failed = FAILED.includes(status);
      await admin.from("projects").update({
        repo_job_status: status,
        repo_job_progress: data.progress ?? null,
        repo_job_meta: data,
        ...(done ? { status: "ready", last_processed_at: new Date().toISOString() } : {}),
        ...(failed ? { status: "failed", process_error: data.error || `Repo job ${status}` } : {}),
      }).eq("id", projectId);
      let sync;
      if (done) sync = await syncDocuments(admin, projectId, jobId);
      return j({ ...data, status, sync });
    }

    // -------- SYNC STATUS --------
    if (action === "sync-status") {
      const res = await rr(`/v1/jobs/${jobId}/repository/sync-status`, {
        method: "POST",
        body: JSON.stringify({
          branch: body.branch || project.github_branch || "main",
          access_token: body.access_token || null,
          fetch: body.fetch ?? true,
        }),
      });
      return passthrough(res);
    }

    // -------- FORWARD TO TEST-DOC SERVICE --------
    if (action === "forward") {
      const res = await rr(`/v1/jobs/${jobId}/forward`, { method: "POST" });
      return passthrough(res);
    }

    // -------- DOWNLOAD ZIP (returns a base64 payload) --------
    if (action === "download-zip") {
      const res = await rr(`/v1/jobs/${jobId}/download.zip`, { headers: { Accept: "application/zip" } });
      if (!res.ok) {
        const t = await res.text();
        return upstreamError(res.status, t);
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      return j({ filename: "repository-documentation.zip", base64: btoa(bin), bytes: buf.length });
    }

    // -------- GENERATED DOCUMENTS --------
    if (action === "list") {
      const res = await rr(`/v1/jobs/${jobId}/documents`);
      const text = await res.text();
      if (!res.ok) return upstreamError(res.status, text);
      const docs = normalizeDocs(JSON.parse(text || "{}"));
      return j({ files: docs.map((d) => ({ path: d.filename, size: d.bytes })), documents: docs });
    }

    if (action === "get") {
      const path = body.path || body.filename;
      if (!path) return j({ error: "path required" }, 400);
      const slug = String(path).replace(/\.(md|json|txt|ya?ml)$/i, "");
      // Prefer the user-editable mirror when it exists
      const { data: local } = await admin
        .from("project_generated_docs")
        .select("content, edited")
        .eq("project_id", projectId).eq("slug", slug).maybeSingle();
      if (local?.edited) return j({ content: local.content, source: "local" });
      const content = await fetchDocContent(jobId, String(path));
      if (content == null) return j({ error: `Document not found: ${path}` }, 404);
      return j({ content, source: "upstream" });
    }

    if (action === "put") {
      const path = body.path || body.filename;
      if (!path) return j({ error: "path required" }, 400);
      const slug = String(path).replace(/\.(md|json|txt|ya?ml)$/i, "");
      const content = body.content ?? "";
      const { error } = await admin.from("project_generated_docs").upsert({
        project_id: projectId,
        job_id: jobId,
        slug,
        filename: String(path),
        title: titleFromFilename(String(path)),
        content,
        source_bytes: content.length,
        edited: true,
      }, { onConflict: "project_id,slug" });
      if (error) return j({ error: error.message }, 400);
      return j({ ok: true, slug });
    }

    if (action === "delete") {
      const path = body.path || body.filename;
      if (!path) return j({ error: "path required" }, 400);
      const slug = String(path).replace(/\.(md|json|txt|ya?ml)$/i, "");
      const { error } = await admin.from("project_generated_docs")
        .delete().eq("project_id", projectId).eq("slug", slug);
      if (error) return j({ error: error.message }, 400);
      return j({ ok: true });
    }

    if (action === "docs-sync") {
      return j(await syncDocuments(admin, projectId, jobId));
    }

    return j({ error: "Unknown action" }, 400);
  } catch (e) {
    if (e instanceof UpstreamUnreachable) {
      return j({ error: e.message, code: "upstream_unreachable" }, 502);
    }
    return j({ error: (e as Error).message }, 500);
  }
});
