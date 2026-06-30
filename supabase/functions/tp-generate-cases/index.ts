// Stage 2: Generate test cases from the 10 documents (no code yet).
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
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) return j({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub;

    const { test_plan_id } = await req.json();
    if (!test_plan_id) return j({ error: "test_plan_id required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: plan } = await admin.from("test_plans").select("id, name, project_id, workspace_id").eq("id", test_plan_id).maybeSingle();
    if (!plan) return j({ error: "Test plan not found" }, 404);

    const { data: documents } = await admin.from("test_plan_documents_v2")
      .select("id, slug, title, kind, content").eq("test_plan_id", test_plan_id).order("sort_order");
    if (!documents?.length) return j({ error: "No documents — run Generate 10 Documents first" }, 400);

    const created: Array<{ id: string; title: string; doc_slug: string }> = [];

    for (const doc of documents) {
      const prompt = `You are a senior QA engineer. Based on this QA document, derive 3-6 concrete, atomic test cases.

DOCUMENT (${doc.kind} — ${doc.title}):
${doc.content}

Return STRICT JSON:
{ "test_cases": [
  { "title": "string (<=120 chars)", "description": "what this verifies",
    "priority": 1, "expected_result": "string",
    "steps": ["step 1", "step 2"], "tags": ["${doc.slug}"]
  }
] }`;

      try {
        const out = await callAiJson<{ test_cases: any[] }>(prompt, { temperature: 0.3 });
        for (const tc of out.test_cases ?? []) {
          const { data: row } = await admin.from("test_cases").insert({
            workspace_id: plan.workspace_id,
            project_id: plan.project_id,
            title: String(tc.title || "Untitled").slice(0, 200),
            description: tc.description ?? "",
            priority: Math.min(3, Math.max(1, Number(tc.priority) || 2)),
            expected_result: tc.expected_result ?? "",
            status: "draft",
            ai_generated: true,
            coverage_tags: Array.isArray(tc.tags) ? tc.tags.slice(0, 8) : [doc.slug],
            created_by: userId,
          } as any).select("id, title").single();
          if (row) {
            await admin.from("test_plan_test_cases").insert({
              test_plan_id, test_case_id: row.id, added_by: userId,
            } as any);
            if (Array.isArray(tc.steps) && tc.steps.length) {
              await admin.from("test_case_steps").insert(
                tc.steps.map((s: string, i: number) => ({
                  test_case_id: row.id, step_number: i + 1, action: String(s), expected_result: "",
                })),
              );
            }
            created.push({ id: row.id, title: row.title, doc_slug: doc.slug });
          }
        }
      } catch (e) {
        console.error("doc->cases failed", doc.slug, (e as Error).message);
      }
    }

    return j({ cases: created.length, items: created });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
