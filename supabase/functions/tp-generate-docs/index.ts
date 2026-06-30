// Generate 10 AI-decided QA documents for a test plan.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { callAiJson } from "../_shared/ai-gateway.ts";
import { snapshotTestPlanVersion } from "../_shared/snapshot-version.ts";

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
    const userId = claims.claims.sub;

    const { test_plan_id } = await req.json();
    if (!test_plan_id) return j({ error: "test_plan_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: plan } = await admin
      .from("test_plans")
      .select("id, name, description, project_id, projects(name, description)")
      .eq("id", test_plan_id)
      .maybeSingle();
    if (!plan) return j({ error: "Test plan not found" }, 404);

    // Gather a bit of project context (best effort).
    const [{ data: docs }, { data: reqs }, { data: endpoints }] = await Promise.all([
      admin.from("documents").select("filename, doc_type").eq("project_id", plan.project_id).limit(20),
      admin.from("requirements").select("title, description").eq("project_id", plan.project_id).limit(30),
      admin.from("api_endpoints").select("method, path, summary").eq("project_id", plan.project_id).limit(30),
    ]);

    const ctx = {
      plan: { name: plan.name, description: plan.description },
      project: (plan as any).projects,
      documents: docs ?? [],
      requirements: reqs ?? [],
      endpoints: endpoints ?? [],
    };

    const prompt = `You are a senior QA architect. For the project below, decide the 10 most relevant QA artifacts to ship for this test plan, then write each as a high-quality markdown document.

PROJECT CONTEXT:
${JSON.stringify(ctx, null, 2)}

Return STRICT JSON of this shape:
{
  "documents": [
    {
      "slug": "kebab-case-id",
      "title": "Human readable title",
      "kind": "test_strategy | risk_matrix | traceability | environment_plan | data_plan | entry_exit_criteria | defect_workflow | automation_plan | performance_plan | security_plan | accessibility_plan | api_contract_plan | release_checklist | other",
      "content": "Full markdown body, 400-1200 words, with H2/H3 headings, tables where useful."
    }
  ]
}
Exactly 10 documents. Slugs unique. Choose the kinds most relevant to THIS project (drop ones that don't apply, replace with more relevant ones).`;

    const out = await callAiJson<{ documents: Array<{ slug: string; title: string; kind: string; content: string }> }>(prompt, {
      temperature: 0.4,
    });

    const docsList = (out.documents ?? []).slice(0, 10);
    if (!docsList.length) return j({ error: "Model returned no documents" }, 500);

    // Replace existing docs for this plan to keep it idempotent.
    await admin.from("test_plan_documents_v2").delete().eq("test_plan_id", test_plan_id);

    const rows = docsList.map((d, i) => ({
      test_plan_id,
      project_id: plan.project_id,
      slug: (d.slug || `doc-${i + 1}`).toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 60),
      title: d.title || `Document ${i + 1}`,
      kind: d.kind || "other",
      content: d.content || "",
      sort_order: i,
      created_by: userId,
    }));

    const { data: inserted, error } = await admin
      .from("test_plan_documents_v2")
      .insert(rows)
      .select("id, slug, title, kind, sort_order");
    if (error) return j({ error: error.message }, 500);

    const v = await snapshotTestPlanVersion(
      admin, test_plan_id,
      `AI Workbench · generated ${inserted?.length ?? 0} document(s)`,
      userId, { stage: "documents" },
    );
    return j({ documents: inserted, version: v });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
