import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";

export type BundleProgress = (message: string) => void;

function slug(s: string) {
  return (s || "test-plan").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

/**
 * Packages every generated artifact of a test plan — QA documents, the plan
 * itself, its test cases (with steps) and the Playwright specs — into one ZIP
 * and triggers a browser download. Purely a read + client-side archive; it
 * never touches the Forge runner.
 */
export async function exportWorkflowBundle(testPlanId: string, onProgress?: BundleProgress) {
  const zip = new JSZip();

  onProgress?.("Loading test plan…");
  const { data: plan, error: planErr } = await supabase
    .from("test_plans")
    .select("*")
    .eq("id", testPlanId)
    .maybeSingle();
  if (planErr) throw planErr;
  if (!plan) throw new Error("Test plan not found");

  const planAny = plan as any;
  const uid = planAny.plan_uid || testPlanId.slice(0, 8);
  const root = `${uid}-${slug(planAny.name)}`;

  zip.file(`${root}/test-plan.json`, JSON.stringify(plan, null, 2));
  zip.file(
    `${root}/README.md`,
    [
      `# ${planAny.name}`,
      "",
      `**Plan ID:** \`${uid}\``,
      `**Exported:** ${new Date().toISOString()}`,
      planAny.description ? `\n${planAny.description}` : "",
      "",
      "## Contents",
      "- `documents/` — generated QA documentation (Markdown)",
      "- `test-cases/` — one Markdown file per test case + `test-cases.json`",
      "- `automation/` — generated Playwright specs (original folder structure)",
      "- `test-plan.json` — raw plan record",
    ].join("\n"),
  );

  onProgress?.("Packaging documents…");
  const { data: docs } = await supabase
    .from("test_plan_documents_v2" as any)
    .select("slug, title, kind, content, sort_order")
    .eq("test_plan_id", testPlanId)
    .order("sort_order");
  for (const d of (docs ?? []) as any[]) {
    zip.file(`${root}/documents/${d.slug || slug(d.title)}.md`, d.content ?? "");
  }

  onProgress?.("Packaging test cases…");
  const { data: caseRows } = await supabase
    .from("test_plan_test_cases")
    .select("test_case:test_cases!test_plan_test_cases_test_case_id_fkey(*)")
    .eq("test_plan_id", testPlanId);
  const cases = ((caseRows ?? []) as any[]).map((r) => r.test_case).filter(Boolean);
  zip.file(`${root}/test-cases/test-cases.json`, JSON.stringify(cases, null, 2));

  if (cases.length) {
    const { data: steps } = await supabase
      .from("test_case_steps")
      .select("*")
      .in("test_case_id", cases.map((c: any) => c.id));
    const stepsBy = new Map<string, any[]>();
    for (const s of (steps ?? []) as any[]) {
      if (!stepsBy.has(s.test_case_id)) stepsBy.set(s.test_case_id, []);
      stepsBy.get(s.test_case_id)!.push(s);
    }
    for (const c of cases as any[]) {
      const list = (stepsBy.get(c.id) ?? []).sort(
        (a, b) => (a.step_number ?? a.order_index ?? 0) - (b.step_number ?? b.order_index ?? 0),
      );
      const md = [
        `# ${c.title}`,
        "",
        `- **Type:** ${c.test_type ?? "regression"}`,
        `- **Priority:** P${c.priority ?? "-"}${c.priority_score != null ? ` (score ${c.priority_score})` : ""}`,
        `- **Status:** ${c.status ?? "-"}`,
        c.preconditions ? `\n## Preconditions\n${c.preconditions}` : "",
        c.description ? `\n## Description\n${c.description}` : "",
        list.length ? "\n## Steps\n" : "",
        ...list.map(
          (s, i) =>
            `${i + 1}. ${s.action ?? s.step_description ?? ""}\n   - **Expected:** ${s.expected_result ?? "-"}`,
        ),
        c.expected_result ? `\n## Expected result\n${c.expected_result}` : "",
      ].join("\n");
      zip.file(`${root}/test-cases/${slug(c.title)}-${String(c.id).slice(0, 6)}.md`, md);
    }
  }

  onProgress?.("Packaging Playwright specs…");
  const { data: specs } = await supabase
    .from("test_plan_specs" as any)
    .select("filename, content")
    .eq("test_plan_id", testPlanId)
    .order("filename");
  for (const s of (specs ?? []) as any[]) {
    zip.file(`${root}/automation/${s.filename}`, s.content ?? "");
  }

  onProgress?.("Compressing…");
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${root}-bundle.zip`;
  a.click();
  URL.revokeObjectURL(url);

  return {
    documents: (docs ?? []).length,
    cases: cases.length,
    specs: (specs ?? []).length,
  };
}
