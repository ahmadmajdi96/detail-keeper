// Snapshot a test plan version capturing the current state of generated
// workbench artifacts (docs + cases + specs). Bumps test_plans.current_version.
export async function snapshotTestPlanVersion(
  admin: any,
  testPlanId: string,
  changeSummary: string,
  createdBy: string | null,
  extra: Record<string, unknown> = {},
): Promise<number | null> {
  try {
    const { data: plan } = await admin
      .from("test_plans")
      .select("id, current_version")
      .eq("id", testPlanId)
      .maybeSingle();
    if (!plan) return null;

    const [{ data: docs }, { data: caseLinks }, { data: specs }] = await Promise.all([
      admin.from("test_plan_documents_v2")
        .select("slug, title, kind, content, sort_order")
        .eq("test_plan_id", testPlanId).order("sort_order"),
      admin.from("test_plan_test_cases")
        .select("test_case:test_cases!test_plan_test_cases_test_case_id_fkey(id, title, description, expected_result, priority, coverage_tags)")
        .eq("test_plan_id", testPlanId),
      admin.from("test_plan_specs")
        .select("filename, content, language, test_case_id")
        .eq("test_plan_id", testPlanId).order("filename"),
    ]);

    const next = (plan.current_version || 0) + 1;
    const snapshot = {
      generated_at: new Date().toISOString(),
      documents: docs ?? [],
      test_cases: (caseLinks ?? []).map((r: any) => r.test_case).filter(Boolean),
      specs: specs ?? [],
      ...extra,
    };

    await admin.from("test_plan_versions").insert({
      test_plan_id: testPlanId,
      version: next,
      snapshot,
      change_summary: changeSummary,
      created_by: createdBy,
    });
    await admin.from("test_plans")
      .update({ current_version: next })
      .eq("id", testPlanId);
    return next;
  } catch (e) {
    console.error("snapshotTestPlanVersion failed", (e as Error).message);
    return null;
  }
}
