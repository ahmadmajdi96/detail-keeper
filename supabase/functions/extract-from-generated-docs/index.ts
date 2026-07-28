import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Extracts endpoints, test cases, and requirements from the 4 latest generated
// technical documents (slugs 10-13) for a project.
const TARGET_SLUGS = [
  // current Repo Reader companion documents (now emitted as .md)
  "00_brd",
  "01_ui_pages",
  "02_api_endpoints",
  "03_testing_data",
  "04_full_mock_data",
  // legacy slugs (older jobs)
  "01_validated_api_surface",
  "02_validated_ui_route_map",
  "08_pages",
  "09_testing_data_catalog",
  "10_system_testing_requirements",
];

async function callAI(system: string, user: string, toolName: string, schema: any) {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      tools: [{
        type: "function",
        function: { name: toolName, description: "Extract structured items", parameters: schema },
      }],
      tool_choice: { type: "function", function: { name: toolName } },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json();
  const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  return args ? JSON.parse(args) : {};
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { project_id } = await req.json();
    if (!project_id) throw new Error("project_id required");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: project } = await sb.from("projects")
      .select("id, workspace_id, created_by")
      .eq("id", project_id).single();
    if (!project) throw new Error("Project not found");

    const { data: matched, error: docsErr } = await sb.from("project_generated_docs")
      .select("id, slug, filename, title, content")
      .eq("project_id", project_id)
      .in("slug", TARGET_SLUGS);
    if (docsErr) throw docsErr;
    let docs = matched || [];
    if (docs.length === 0) {
      // Filenames/slugs evolve upstream — fall back to every generated doc.
      const { data: all } = await sb.from("project_generated_docs")
        .select("id, slug, filename, title, content")
        .eq("project_id", project_id);
      docs = all || [];
    }
    if (docs.length === 0) throw new Error("No matching generated docs found");

    const combined = docs
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map((d) => `# ${d.title} (${d.filename})\n\n${d.content}`)
      .join("\n\n---\n\n");

    // 1) Endpoints
    const epRes = await callAI(
      "You extract API endpoints from technical testing documents. Return every endpoint mentioned.",
      `Extract all API endpoints from the following documents:\n\n${combined}`,
      "extract_endpoints",
      {
        type: "object",
        properties: {
          endpoints: {
            type: "array",
            items: {
              type: "object",
              properties: {
                method: { type: "string" },
                path: { type: "string" },
                summary: { type: "string" },
                description: { type: "string" },
                parameters: { type: "array" },
                authentication: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
              },
              required: ["method", "path"],
            },
          },
        },
        required: ["endpoints"],
      },
    );

    // 2) Test cases
    const tcRes = await callAI(
      "You extract concrete QA test cases from technical testing documents. Cover endpoints, UI pages, system-level, and data catalog usage.",
      `Extract test cases from the following documents:\n\n${combined}`,
      "extract_test_cases",
      {
        type: "object",
        properties: {
          test_cases: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                preconditions: { type: "string" },
                expected_result: { type: "string" },
                priority: { type: "integer" },
                coverage_tags: { type: "array", items: { type: "string" } },
              },
              required: ["title"],
            },
          },
        },
        required: ["test_cases"],
      },
    );

    // 3) Requirements
    const reqRes = await callAI(
      "You extract explicit product/system requirements from technical documents. Focus on testable, atomic statements.",
      `Extract requirements from the following documents:\n\n${combined}`,
      "extract_requirements",
      {
        type: "object",
        properties: {
          requirements: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                priority: { type: "integer" },
                tags: { type: "array", items: { type: "string" } },
              },
              required: ["title"],
            },
          },
        },
        required: ["requirements"],
      },
    );

    // Ensure a documents row exists per generated doc so endpoints can link.
    const docIdBySlug: Record<string, string> = {};
    for (const d of docs) {
      const { data: existing } = await sb.from("documents")
        .select("id")
        .eq("project_id", project_id)
        .eq("filename", d.filename)
        .maybeSingle();
      if (existing?.id) {
        docIdBySlug[d.slug] = existing.id;
      } else {
        const { data: created, error: cErr } = await sb.from("documents").insert({
          filename: d.filename,
          file_size: (d.content || "").length,
          mime_type: "text/markdown",
          status: "processed",
          uploader_id: project.created_by,
          workspace_id: project.workspace_id,
          project_id,
          processed_at: new Date().toISOString(),
        }).select("id").single();
        if (cErr) throw cErr;
        docIdBySlug[d.slug] = created.id;
      }
    }
    const anyDocId = Object.values(docIdBySlug)[0];

    const endpoints = (epRes.endpoints || []).slice(0, 200);
    const testCases = (tcRes.test_cases || []).slice(0, 200);
    const requirements = (reqRes.requirements || []).slice(0, 200);

    let epInserted = 0;
    for (const e of endpoints) {
      const { error } = await sb.from("api_endpoints").insert({
        document_id: anyDocId,
        project_id,
        workspace_id: project.workspace_id,
        method: String(e.method || "GET").toUpperCase(),
        path: e.path,
        summary: e.summary ?? null,
        description: e.description ?? null,
        parameters: e.parameters || [],
        headers: [],
        authentication: e.authentication ?? null,
        tags: e.tags || [],
      });
      if (!error) epInserted++;
    }

    let tcInserted = 0;
    const tcIds: string[] = [];
    for (const t of testCases) {
      const { data, error } = await sb.from("test_cases").insert({
        title: t.title,
        description: t.description ?? null,
        preconditions: t.preconditions ?? null,
        expected_result: t.expected_result ?? null,
        status: "draft",
        priority: t.priority ?? 3,
        ai_generated: true,
        coverage_tags: t.coverage_tags || [],
        workspace_id: project.workspace_id,
        project_id,
        created_by: project.created_by,
        source: "generated-docs",
      }).select("id").single();
      if (!error && data) { tcInserted++; tcIds.push(data.id); }
    }

    let reqInserted = 0;
    for (const r of requirements) {
      const { error } = await sb.from("requirements").insert({
        project_id,
        title: r.title,
        description: r.description ?? null,
        status: "draft",
        priority: r.priority ?? 3,
        tags: r.tags || [],
        source_document_id: anyDocId,
        created_by: project.created_by,
      });
      if (!error) reqInserted++;
    }

    return new Response(JSON.stringify({
      success: true,
      endpoints_inserted: epInserted,
      test_cases_inserted: tcInserted,
      requirements_inserted: reqInserted,
      documents_processed: docs.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
