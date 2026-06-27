// Ingest a GitHub repository into a project
// Fetches README and OpenAPI/Swagger specs (if any) and creates documents
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  project_id: string;
  url: string;
  branch?: string;
  token?: string | null;
}

function parseRepo(url: string) {
  const m = url.match(/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?\/?$/);
  if (!m) throw new Error("Invalid GitHub URL");
  return { owner: m[1], repo: m[2] };
}

async function gh<T = any>(path: string, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "qa-platform-ingest",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let projectId: string | undefined;
  try {
    const body = (await req.json()) as Body;
    projectId = body.project_id;
    const { owner, repo } = parseRepo(body.url);
    const branch = body.branch || "main";
    const token = body.token || null;

    // Get tree
    const refData = await gh<any>(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, token);
    const treeSha = refData.object.sha;
    const tree = await gh<any>(`/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`, token);

    const wanted = (tree.tree as any[]).filter((n) =>
      n.type === "blob" &&
      /^(readme|openapi|swagger|api\.|spec\.|requirements|.*\.openapi|.*\.swagger)/i.test(n.path.split("/").pop() || "") &&
      n.size < 500_000
    ).slice(0, 10);

    // Fetch project to know workspace_id + uploader
    const { data: project } = await supabase
      .from("projects").select("workspace_id, created_by").eq("id", projectId!).single();

    let created = 0;
    for (const file of wanted) {
      const raw = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );
      if (!raw.ok) continue;
      const content = await raw.text();

      const { data: doc } = await supabase.from("documents").insert({
        filename: `${repo}/${file.path}`,
        file_size: content.length,
        mime_type: file.path.endsWith(".json") ? "application/json" :
                   file.path.endsWith(".yaml") || file.path.endsWith(".yml") ? "application/yaml" :
                   "text/plain",
        status: "pending",
        uploader_id: project?.created_by,
        workspace_id: project?.workspace_id,
        project_id: projectId,
      }).select("id").single();

      if (doc) {
        created++;
        // fire-and-forget AI processing with inline content
        supabase.functions.invoke("process-document", {
          body: { document_id: doc.id, inline_content: content },
        }).catch(() => {});
      }
    }

    await supabase.from("projects").update({
      status: "ready",
      files_count: created,
      last_processed_at: new Date().toISOString(),
      process_error: null,
    }).eq("id", projectId!);

    return new Response(JSON.stringify({ ok: true, files: created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    if (projectId) {
      await supabase.from("projects").update({
        status: "failed", process_error: e.message,
      }).eq("id", projectId);
    }
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
