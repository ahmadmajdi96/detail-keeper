// Stage 3: Generate a Playwright spec file PER test case in the plan.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { callAiJson } from "../_shared/ai-gateway.ts";

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

    const { test_plan_id, test_case_id } = await req.json();
    if (!test_plan_id) return j({ error: "test_plan_id required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: plan } = await admin.from("test_plans").select("project_id").eq("id", test_plan_id).maybeSingle();
    if (!plan) return j({ error: "Test plan not found" }, 404);

    let query = admin.from("test_plan_test_cases")
      .select("test_case:test_cases!test_plan_test_cases_test_case_id_fkey(id, title, description, expected_result, priority, coverage_tags)")
      .eq("test_plan_id", test_plan_id);
    const { data: rows } = await query;
    let cases = (rows || []).map((r: any) => r.test_case).filter(Boolean);
    if (test_case_id) cases = cases.filter((c: any) => c.id === test_case_id);
    if (!cases.length) return j({ error: "No test cases — generate cases first" }, 400);

    // Fetch steps in bulk
    const ids = cases.map((c: any) => c.id);
    const { data: steps } = await admin.from("test_case_steps")
      .select("test_case_id, step_number, action").in("test_case_id", ids).order("step_number");
    const stepsByCase = new Map<string, string[]>();
    (steps || []).forEach((s: any) => {
      if (!stepsByCase.has(s.test_case_id)) stepsByCase.set(s.test_case_id, []);
      stepsByCase.get(s.test_case_id)!.push(s.action);
    });

    const created: Array<{ id: string; filename: string; test_case_id: string }> = [];

    for (const c of cases) {
      const slug = String(c.title || "case").toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || `case-${c.id.slice(0, 8)}`;
      const filename = `${slug}.spec.ts`;
      const caseSteps = stepsByCase.get(c.id) || [];

      const prompt = `Generate ONE complete Playwright TypeScript spec for this test case. Output runnable code only.

Test case: ${c.title}
Description: ${c.description ?? ""}
Expected: ${c.expected_result ?? ""}
Steps:
${caseSteps.map((s, i) => `${i + 1}. ${s}`).join("\n") || "(no explicit steps)"}

Return STRICT JSON:
{ "content": "// Full file: import { test, expect } from '@playwright/test'; BASE_URL = process.env.BASE_URL ?? 'http://localhost:8080'. One test(...) per scenario. No external network besides BASE_URL." }`;

      try {
        const out = await callAiJson<{ content: string }>(prompt, { temperature: 0.2 });
        const content = (out.content || "").trim() ||
          `import { test, expect } from '@playwright/test';\ntest('${c.title.replace(/'/g, "\\'")}', async ({ page }) => { /* TODO */ });\n`;

        // Upsert by (test_plan_id, filename)
        const { data: existing } = await admin.from("test_plan_specs")
          .select("id").eq("test_plan_id", test_plan_id).eq("filename", filename).maybeSingle();
        if (existing) {
          await admin.from("test_plan_specs").update({ content, test_case_id: c.id }).eq("id", existing.id);
          created.push({ id: existing.id, filename, test_case_id: c.id });
        } else {
          const { data: ins } = await admin.from("test_plan_specs").insert({
            test_plan_id, project_id: plan.project_id, test_case_id: c.id,
            filename, content, language: "typescript", created_by: userId,
          }).select("id, filename").single();
          if (ins) created.push({ id: ins.id, filename: ins.filename, test_case_id: c.id });
        }
      } catch (e) {
        console.error("code gen failed", c.id, (e as Error).message);
      }
    }

    return j({ specs: created.length, items: created });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
