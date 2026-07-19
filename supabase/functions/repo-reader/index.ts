// Server-side proxy to the Repo Reader service. Keeps the API key off the
// client and lets the frontend act on cloned repositories with only a
// project_id. Also mirrors generated documents into project_generated_docs
// so they can be edited by users.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const BASE = Deno.env.get("REPO_READER_BASE_URL")!;
const API_KEY = Deno.env.get("REPO_READER_API_KEY") || Deno.env.get("REPO_READER_TOKEN")!;

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function rr(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "x-api-key": API_KEY,
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });
}

async function syncDocuments(admin: any, projectId: string, jobId: string) {
  try {
    const res = await rr(`/v1/jobs/${jobId}/documents`);
    if (!res.ok) return { synced: 0 };
    const data = await res.json();
    const docs: any[] = data?.documents || [];
    let synced = 0;
    for (const d of docs) {
      const filename = d.filename || d.slug + ".md";
      const slug = d.slug || filename.replace(/\.md$/, "");
      const title = d.title || slug;

      // Skip if user has edited this doc already
      const { data: existing } = await admin
        .from("project_generated_docs")
        .select("id, edited, source_hash")
        .eq("project_id", projectId).eq("slug", slug).maybeSingle();
      if (existing?.edited) continue;

      // Fetch content
      const fr = await rr(`/v1/jobs/${jobId}/documents/${encodeURIComponent(filename)}`);
      if (!fr.ok) continue;
      const ct = fr.headers.get("content-type") || "";
      let content = "";
      if (ct.includes("application/json")) {
        const jd = await fr.json();
        content = typeof jd === "string" ? jd : (jd?.content ?? JSON.stringify(jd, null, 2));
      } else {
        content = await fr.text();
      }

      await admin.from("project_generated_docs").upsert({
        project_id: projectId,
        job_id: jobId,
        slug, filename, title, content,
        source_bytes: d.bytes ?? content.length,
        edited: false,
      }, { onConflict: "project_id,slug" });
      synced++;
    }
    return { synced, total: docs.length };
  } catch (e) {
    return { synced: 0, error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!BASE || !API_KEY) return j({ error: "Repo Reader not configured" }, 500);

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
      .from("projects").select("id, repo_job_id, github_url, github_branch, github_repo_visibility").eq("id", projectId).maybeSingle();
    if (pErr || !project) return j({ error: "Project not found or forbidden" }, 403);

    // -------- CLONE --------
    if (action === "clone") {
      const repo_url = body.repo_url || project.github_url;
      const branch = body.branch || project.github_branch || "main";
      const visibility = body.visibility || project.github_repo_visibility || "public";
      const access_token = body.access_token || null;
      if (!repo_url) return j({ error: "repo_url required" }, 400);
      if (visibility === "private" && !access_token) return j({ error: "access_token required for private repositories" }, 400);

      const res = await rr(`/v1/repositories/clone`, {
        method: "POST",
        body: JSON.stringify({ repo_url, branch, access_token, metadata: { project_id: projectId } }),
      });
      const text = await res.text();
      if (!res.ok) return j({ error: `Repo Reader ${res.status}: ${text.slice(0, 400)}` }, res.status);
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

    const jobId = project.repo_job_id;
    if (!jobId) return j({ error: "Project has no repo job. Call action=clone first." }, 400);

    // -------- JOB STATUS --------
    if (action === "job") {
      const res = await rr(`/v1/jobs/${jobId}`);
      const text = await res.text();
      if (!res.ok) return j({ error: `Repo Reader ${res.status}: ${text.slice(0, 400)}` }, res.status);
      const data = JSON.parse(text);
      const status = data.status || data.state;
      const done = status === "completed" || status === "ready" || status === "succeeded" || status === "success";
      await admin.from("projects").update({
        repo_job_status: status,
        repo_job_progress: data.progress ?? null,
        repo_job_meta: data,
        ...(done ? { status: "ready", last_processed_at: new Date().toISOString() } : {}),
        ...(status === "failed" || status === "error" ? { status: "failed", process_error: data.error || "Repo clone failed" } : {}),
      }).eq("id", projectId);
      let sync;
      if (done) sync = await syncDocuments(admin, projectId, jobId);
      return j({ ...data, sync });
    }

    // -------- LIST / GET / PUT / DELETE REPO FILES --------
    if (action === "list") {
      const limit = url.searchParams.get("limit") || "500";
      const offset = url.searchParams.get("offset") || "0";
      const res = await rr(`/v1/jobs/${jobId}/repository/files?limit=${limit}&offset=${offset}`);
      const text = await res.text();
      if (!res.ok) return j({ error: `Repo Reader ${res.status}: ${text.slice(0, 400)}` }, res.status);
      return new Response(text, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "get") {
      const path = body.path;
      if (!path) return j({ error: "path required" }, 400);
      const res = await rr(`/v1/jobs/${jobId}/repository/files/${encodeURI(path)}`);
      const text = await res.text();
      if (!res.ok) return j({ error: `Repo Reader ${res.status}: ${text.slice(0, 400)}` }, res.status);
      return new Response(text, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "put") {
      const { path, content = "", message } = body;
      if (!path) return j({ error: "path required" }, 400);
      const res = await rr(`/v1/jobs/${jobId}/repository/files/${encodeURI(path)}`, {
        method: "PUT",
        body: JSON.stringify({ content, message: message || `Edit ${path}` }),
      });
      const text = await res.text();
      if (!res.ok) return j({ error: `Repo Reader ${res.status}: ${text.slice(0, 400)}` }, res.status);
      return new Response(text, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (action === "delete") {
      const path = body.path;
      if (!path) return j({ error: "path required" }, 400);
      const res = await rr(`/v1/jobs/${jobId}/repository/files/${encodeURI(path)}`, { method: "DELETE" });
      const text = await res.text();
      if (!res.ok) return j({ error: `Repo Reader ${res.status}: ${text.slice(0, 400)}` }, res.status);
      return j({ ok: true });
    }

    // -------- GENERATED DOCS --------
    if (action === "docs-sync") {
      const r = await syncDocuments(admin, projectId, jobId);
      return j(r);
    }

    return j({ error: "Unknown action" }, 400);
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});
