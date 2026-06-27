// Ingest a zip file uploaded to project-repos storage
// Extracts README + openapi/swagger files and creates documents
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let projectId: string | undefined;
  try {
    const { project_id } = await req.json();
    projectId = project_id;

    const { data: project } = await supabase
      .from("projects")
      .select("workspace_id, created_by, zip_storage_path")
      .eq("id", projectId!).single();

    if (!project?.zip_storage_path) throw new Error("No zip path on project");

    const { data: blob, error: dlErr } = await supabase.storage
      .from("project-repos").download(project.zip_storage_path);
    if (dlErr) throw dlErr;

    const buf = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);

    const targets = Object.keys(zip.files).filter((p) =>
      !zip.files[p].dir &&
      /^(.*\/)?(readme|openapi|swagger|api\.|spec\.|requirements|.*\.openapi|.*\.swagger)/i.test(p.split("/").pop() || "")
    ).slice(0, 10);

    let created = 0;
    for (const path of targets) {
      const content = await zip.files[path].async("string");
      if (content.length > 500_000) continue;

      const { data: doc } = await supabase.from("documents").insert({
        filename: path,
        file_size: content.length,
        mime_type: path.endsWith(".json") ? "application/json" :
                   path.endsWith(".yaml") || path.endsWith(".yml") ? "application/yaml" : "text/plain",
        status: "pending",
        uploader_id: project.created_by,
        workspace_id: project.workspace_id,
        project_id: projectId,
      }).select("id").single();

      if (doc) {
        created++;
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
