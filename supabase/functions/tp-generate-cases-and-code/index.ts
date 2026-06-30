// Stage 2: send the 10 docs back to the model; produce test cases + one Playwright spec per doc.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { callAiJson } from "../_shared/ai-gateway.ts";

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

    const { data: plan } = await admin.from("test_plans").select("id, name, project_id").eq("id", test_plan_id).maybeSingle();
    if (!plan) return j({ error: "Test plan not found" }, 404);

    const { data: documents } = await admin
      .from("test_plan_documents_v2")
      .select("id, slug, title, kind, content")
      .eq("test_plan_id", test_plan_id)
      .order("sort_order");
    if (!documents?.length) return j({ error: "No documents — run tp-generate-docs first" }, 400);

    // Clear previously generated specs (idempotent)
    await admin.from("test_plan_specs").delete().eq("test_plan_id", test_plan_id);

    const createdCases: Array<{ id: string; doc_slug: string }> = [];
    const createdSpecs: Array<{ id: string; filename: string; doc_slug: string }> = [];

    // Process per-doc to keep the prompts small and resilient.
    for (const doc of documents) {
      const prompt = `You are a senior automation engineer. Below is a QA document. Produce:
1. 3-6 concrete test cases derived from this document.
2. ONE complete Playwright spec file (TypeScript) that implements ALL those test cases.

QA DOCUMENT (${doc.kind} — ${doc.title}):
${doc.content}

Return STRICT JSON:
{
  "test_cases": [
    { "title": "string", "description": "string", "priority": 1|2|3, "expected_result": "string", "steps": ["step1","step2"] }
  ],
  "spec": {
    "filename": "kebab-name.spec.ts",
    "content": "// Full runnable Playwright TS test file using @playwright/test, with import { test, expect } from '@playwright/test'. Include every test case as a separate test(...) block. Use realistic but safe selectors and BASE_URL from process.env.BASE_URL ?? 'http://localhost:8080'. No external network apart from the BASE_URL."
  }
}`;

      try {
        const out = await callAiJson<{
          test_cases: Array<{ title: string; description?: string; priority?: number; expected_result?: string; steps?: string[] }>;
          spec: { filename: string; content: string };
        }>(prompt, { temperature: 0.3 });

        // Insert test cases + plan link
        for (const tc of out.test_cases ?? []) {
          const { data: caseRow } = await admin.from("test_cases").insert({
            project_id: plan.project_id,
            title: tc.title?.slice(0, 200) || "Untitled",
            description: tc.description ?? "",
            priority: Math.min(3, Math.max(1, tc.priority ?? 2)),
            expected_result: tc.expected_result ?? "",
            status: "draft",
            type: "functional",
            created_by: userId,
          } as any).select("id").single();
          if (caseRow) {
            await admin.from("test_plan_test_cases").insert({
              test_plan_id, test_case_id: caseRow.id,
            } as any);
            // Steps
            if (tc.steps?.length) {
              await admin.from("test_case_steps").insert(
                tc.steps.map((s, idx) => ({
                  test_case_id: caseRow.id,
                  step_number: idx + 1,
                  action: s,
                  expected_result: "",
                })),
              );
            }
            createdCases.push({ id: caseRow.id, doc_slug: doc.slug });
          }
        }

        // Insert spec
        const filename = (out.spec?.filename || `${doc.slug}.spec.ts`).replace(/[^a-zA-Z0-9._-]/g, "-");
        const { data: specRow, error: sErr } = await admin.from("test_plan_specs").insert({
          test_plan_id,
          project_id: plan.project_id,
          document_id: doc.id,
          filename,
          content: out.spec?.content ?? "// (empty)",
          language: "typescript",
          created_by: userId,
        }).select("id, filename").single();
        if (sErr) {
          console.error("spec insert failed", sErr);
        } else if (specRow) {
          createdSpecs.push({ id: specRow.id, filename: specRow.filename, doc_slug: doc.slug });
        }
      } catch (e) {
        console.error("doc failed", doc.slug, (e as Error).message);
      }
    }

    return j({ cases: createdCases.length, specs: createdSpecs.length, files: createdSpecs });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
