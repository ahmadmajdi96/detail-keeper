// Server-side proxy to the Repo Reader service. Keeps the bearer token
// off the client and lets the frontend act on cloned repositories with
// only a project_id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const BASE = Deno.env.get("REPO_READER_BASE_URL")!;
const TOKEN = Deno.env.get("REPO_READER_TOKEN")!;

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
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!BASE || !TOKEN) return j({ error: "Repo Reader not configured" }, 500);

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
    const action = url.searchParams.get("action") || "";
    const body = req.method === "GET" ? {} : await req.json().catch(() => ({}));
    const projectId = body.project_id || url.searchParams.get("project_id");

    if (!projectId) return j({ error: "project_id required" }, 400);

    // Read project via user client (respects RLS -> membership check)
    const { data: project, error: pErr } = await supabase
      .from("projects").select("id, repo_job_id, github_url, github_branch").eq("id", projectId).maybeSingle();
    if (pErr || !project) return j({ error: "Project not found or forbidden" }, 403);

    // -------- CLONE --------
    if (action === "clone") {
      const repo_url = body.repo_url || project.github_url;
      const branch = body.branch || project.github_branch || "main";
      const access_token = body.access_token || null;
      if (!repo_url) return j({ error: "repo_url required" }, 400);

      const res = await rr(`/v1/repositories/clone`, {
        method: "POST",
        body: JSON.stringify({ repo_url, branch, access_token }),
      });
      const text = await res.text();
      if (!res.ok) return j({ error: `Repo Reader ${res.status}: ${text.slice(0, 400)}` }, res.status);
      const data = JSON.parse(text);
      const jobId = data.job_id || data.id;
      await admin.from("projects").update({
        repo_job_id: jobId,
        repo_job_status: data.status || "queued",
        repo_job_progress: data.progress ?? 0,
        repo_job_meta: data,
        status: "processing",
        github_url: repo_url,
        github_branch: branch,
      }).eq("id", projectId);
      return j({ job_id: jobId, status: data.status || "queued", raw: data });
    }

    // From here on we need a job id
    const jobId = project.repo_job_id;
    if (!jobId) return j({ error: "Project has no repo job. Call action=clone first." }, 400);

    // -------- JOB STATUS --------
    if (action === "job") {
      const res = await rr(`/v1/jobs/${jobId}`);
      const text = await res.text();
      if (!res.ok) return j({ error: `Repo Reader ${res.status}: ${text.slice(0, 400)}` }, res.status);
      const data = JSON.parse(text);
      const status = data.status || data.state;
      await admin.from("projects").update({
        repo_job_status: status,
        repo_job_progress: data.progress ?? null,
        repo_job_meta: data,
        ...(status === "completed" || status === "ready" ? { status: "ready", last_processed_at: new Date().toISOString() } : {}),
        ...(status === "failed" || status === "error" ? { status: "failed", process_error: data.error || "Repo clone failed" } : {}),
      }).eq("id", projectId);
      return j(data);
    }

    // -------- LIST FILES --------
    if (action === "list") {
      const limit = url.searchParams.get("limit") || "500";
      const offset = url.searchParams.get("offset") || "0";
      const res = await rr(`/v1/jobs/${jobId}/repository/files?limit=${limit}&offset=${offset}`);
      const text = await res.text();
      if (!res.ok) return j({ error: `Repo Reader ${res.status}: ${text.slice(0, 400)}` }, res.status);
      return new Response(text, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // -------- GET FILE --------
    if (action === "get") {
      const path = body.path || url.searchParams.get("path");
      if (!path) return j({ error: "path required" }, 400);
      const res = await rr(`/v1/jobs/${jobId}/repository/files/${encodeURI(path)}`);
      const text = await res.text();
      if (!res.ok) return j({ error: `Repo Reader ${res.status}: ${text.slice(0, 400)}` }, res.status);
      return new Response(text, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // -------- PUT FILE --------
    if (action === "put") {
      const path = body.path;
      const content = body.content ?? "";
      const message = body.message || `Edit ${path}`;
      if (!path) return j({ error: "path required" }, 400);
      const res = await rr(`/v1/jobs/${jobId}/repository/files/${encodeURI(path)}`, {
        method: "PUT",
        body: JSON.stringify({ content, message }),
      });
      const text = await res.text();
      if (!res.ok) return j({ error: `Repo Reader ${res.status}: ${text.slice(0, 400)}` }, res.status);
      return new Response(text, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // -------- DELETE FILE --------
    if (action === "delete") {
      const path = body.path;
      if (!path) return j({ error: "path required" }, 400);
      const res = await rr(`/v1/jobs/${jobId}/repository/files/${encodeURI(path)}`, {
        method: "DELETE",
      });
      const text = await res.text();
      if (!res.ok) return j({ error: `Repo Reader ${res.status}: ${text.slice(0, 400)}` }, res.status);
      return j({ ok: true });
    }

    return j({ error: "Unknown action" }, 400);
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});
