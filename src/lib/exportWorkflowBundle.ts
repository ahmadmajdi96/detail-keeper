import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";

export type BundleProgress = (message: string) => void;

export interface BundleOptions {
  /** Only package artifacts whose review_state is "accepted". */
  approvedOnly?: boolean;
}

/** Canonical UID-based deep link for a plan — the same URL the detail page copies. */
export function planUidLink(uid: string, origin?: string) {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/test-plans/${uid}`;
}

export interface ManifestValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  checkedAt: string;
}

/**
 * Cross-checks a bundle manifest against the plan record it was built from:
 * the unique ID must be present, must match the plan, and the embedded deep
 * link must be the same UID-based link the UI exposes.
 */
export function validateBundleManifest(
  manifest: any,
  plan: { id: string; plan_uid?: string | null },
  uiLink?: string,
): ManifestValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const tp = manifest?.testPlan ?? {};

  if (!manifest?.planUid) errors.push("manifest.planUid is missing");
  if (!tp.uid) errors.push("manifest.testPlan.uid is missing");
  if (manifest?.planUid && tp.uid && manifest.planUid !== tp.uid) {
    errors.push(`manifest.planUid (${manifest.planUid}) does not match manifest.testPlan.uid (${tp.uid})`);
  }
  if (tp.id !== plan.id) errors.push(`manifest.testPlan.id (${tp.id}) does not match the exported plan (${plan.id})`);

  if (plan.plan_uid) {
    if (tp.uid !== plan.plan_uid) {
      errors.push(`manifest UID (${tp.uid}) does not match the plan's unique ID (${plan.plan_uid})`);
    }
    const expected = uiLink ?? planUidLink(plan.plan_uid);
    if (!tp.link) errors.push("manifest.testPlan.link is missing");
    else if (tp.link !== expected) {
      errors.push(`manifest link (${tp.link}) does not match the UI plan link (${expected})`);
    }
    if (tp.link && !String(tp.link).endsWith(`/test-plans/${plan.plan_uid}`)) {
      errors.push("manifest link is not a UID-based /test-plans/<uid> link");
    }
  } else {
    warnings.push("Plan has no generated unique ID — the manifest falls back to a truncated database id");
  }

  return { ok: errors.length === 0, errors, warnings, checkedAt: new Date().toISOString() };
}

function slug(s: string) {
  return (s || "test-plan").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

/**
 * Packages every generated artifact of a test plan — QA documents, the plan
 * itself, its test cases (grouped by suite and type) and the Playwright specs —
 * into one ZIP with a manifest, then triggers a browser download. Purely a
 * read + client-side archive; it never touches the Forge runner.
 */
export async function exportWorkflowBundle(
  testPlanId: string,
  onProgress?: BundleProgress,
  options: BundleOptions = {},
) {
  const approvedOnly = !!options.approvedOnly;
  const isApproved = (r: any) => !approvedOnly || (r?.review_state ?? "pending") === "accepted";
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

  onProgress?.("Packaging documents…");
  const { data: docRows } = await supabase
    .from("test_plan_documents_v2" as any)
    .select("id, slug, title, kind, content, sort_order, review_state, reviewed_at")
    .eq("test_plan_id", testPlanId)
    .order("sort_order");
  const docs = ((docRows ?? []) as any[]).filter(isApproved);
  for (const d of docs) {
    zip.file(`${root}/documents/${d.slug || slug(d.title)}.md`, d.content ?? "");
  }

  onProgress?.("Packaging test cases…");
  const { data: caseRows } = await supabase
    .from("test_plan_test_cases")
    .select("test_case:test_cases!test_plan_test_cases_test_case_id_fkey(*)")
    .eq("test_plan_id", testPlanId);
  const cases = ((caseRows ?? []) as any[]).map((r) => r.test_case).filter(Boolean).filter(isApproved);

  // Resolve suite names so cases can be foldered by suite.
  const suiteIds = Array.from(new Set(cases.map((c: any) => c.suite_id).filter(Boolean)));
  const suiteNames = new Map<string, string>();
  if (suiteIds.length) {
    const { data: suites } = await supabase
      .from("test_suites").select("id, name").in("id", suiteIds as string[]);
    for (const s of (suites ?? []) as any[]) suiteNames.set(s.id, s.name);
  }
  const suiteDir = (c: any) => slug(suiteNames.get(c.suite_id) ?? "unassigned");
  const typeDir = (c: any) => slug(c.test_type ?? "regression");

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
        `- **Suite:** ${suiteNames.get(c.suite_id) ?? "Unassigned"}`,
        `- **Type:** ${c.test_type ?? "regression"}`,
        `- **Priority:** P${c.priority ?? "-"}${c.priority_score != null ? ` (score ${c.priority_score})` : ""}`,
        `- **Status:** ${c.status ?? "-"}`,
        `- **Review:** ${c.review_state ?? "pending"}`,
        c.preconditions ? `\n## Preconditions\n${c.preconditions}` : "",
        c.description ? `\n## Description\n${c.description}` : "",
        list.length ? "\n## Steps\n" : "",
        ...list.map(
          (s, i) =>
            `${i + 1}. ${s.action ?? s.step_description ?? ""}\n   - **Expected:** ${s.expected_result ?? "-"}`,
        ),
        c.expected_result ? `\n## Expected result\n${c.expected_result}` : "",
      ].join("\n");
      zip.file(
        `${root}/test-cases/${suiteDir(c)}/${typeDir(c)}/${slug(c.title)}-${String(c.id).slice(0, 6)}.md`,
        md,
      );
    }
  }

  onProgress?.("Packaging Playwright specs…");
  const { data: specRows } = await supabase
    .from("test_plan_specs" as any)
    .select("id, filename, content, review_state")
    .eq("test_plan_id", testPlanId)
    .order("filename");
  const specs = ((specRows ?? []) as any[]).filter(isApproved);
  for (const s of specs) {
    zip.file(`${root}/automation/${s.filename}`, s.content ?? "");
  }

  // Manifest — machine readable inventory of everything in the archive.
  const uiLink = planAny.plan_uid ? planUidLink(planAny.plan_uid) : null;
  const manifest: any = {
    bundleVersion: 1,
    exportedAt: new Date().toISOString(),
    approvedOnly,
    /** Top-level unique ID so tooling can identify the plan without parsing testPlan. */
    planUid: uid,
    testPlan: {
      id: testPlanId,
      uid,
      link: uiLink,
      name: planAny.name,
      projectId: planAny.project_id,
      workspaceId: planAny.workspace_id,
      language: planAny.codegen_language ?? null,
      skipStubs: planAny.codegen_skip_stubs ?? false,
    },
    counts: {
      documents: docs.length,
      testCases: cases.length,
      suites: suiteIds.length,
      specs: specs.length,
    },
    documents: docs.map((d: any) => ({
      path: `documents/${d.slug || slug(d.title)}.md`,
      title: d.title, kind: d.kind, reviewState: d.review_state ?? "pending",
    })),
    suites: Array.from(suiteNames.entries()).map(([id, name]) => ({
      id, name, cases: cases.filter((c: any) => c.suite_id === id).length,
    })),
    testCases: cases.map((c: any) => ({
      path: `test-cases/${suiteDir(c)}/${typeDir(c)}/${slug(c.title)}-${String(c.id).slice(0, 6)}.md`,
      id: c.id, title: c.title, suite: suiteNames.get(c.suite_id) ?? "Unassigned",
      type: c.test_type ?? "regression", priority: c.priority ?? null,
      reviewState: c.review_state ?? "pending",
    })),
    specs: specs.map((s: any) => ({
      path: `automation/${s.filename}`, reviewState: s.review_state ?? "pending",
    })),
  };
  // Cross-check the manifest against the plan record and the UI deep link
  // before the archive is handed to the user.
  onProgress?.("Validating manifest…");
  const validation = validateBundleManifest(
    manifest,
    { id: testPlanId, plan_uid: planAny.plan_uid ?? null },
    uiLink ?? undefined,
  );
  manifest.validation = validation;
  if (!validation.ok) {
    throw new Error(`Bundle manifest validation failed: ${validation.errors.join("; ")}`);
  }
  zip.file(`${root}/manifest.json`, JSON.stringify(manifest, null, 2));

  zip.file(
    `${root}/README.md`,
    [
      `# ${planAny.name}`,
      "",
      `**Plan ID:** \`${uid}\``,
      uiLink ? `**Plan link:** ${uiLink}` : "",
      `**Exported:** ${manifest.exportedAt}`,
      `**Scope:** ${approvedOnly ? "approved artifacts only" : "all generated artifacts"}`,
      planAny.description ? `\n${planAny.description}` : "",
      "",
      "## Contents",
      "- `manifest.json` — inventory of every file in this bundle",
      "- `documents/` — generated QA documentation (Markdown)",
      "- `test-cases/<suite>/<type>/` — one Markdown file per test case + `test-cases.json`",
      "- `automation/` — generated Playwright specs (original folder structure)",
      "- `test-plan.json` — raw plan record",
      "",
      "## Summary",
      `- Documents: ${docs.length}`,
      `- Suites: ${suiteIds.length}`,
      `- Test cases: ${cases.length}`,
      `- Playwright specs: ${specs.length}`,
    ].join("\n"),
  );

  onProgress?.("Compressing…");
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${root}${approvedOnly ? "-approved" : ""}-bundle.zip`;
  a.click();
  URL.revokeObjectURL(url);

  return { documents: docs.length, cases: cases.length, specs: specs.length, uid, validation };
}
