import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import type { StageId } from "@/lib/jobBusyStore";

/**
 * Per-stage artifact download. Lets a user grab exactly what a given pipeline
 * stage produced (docs / test plan / test cases / Playwright specs) straight
 * from the job tracker — including for a stage that later failed.
 */

export type StageArtifactKey = "docs" | "cases" | "codegen" | "persist";

export const STAGE_DOWNLOAD_LABEL: Record<StageArtifactKey, string> = {
  docs: "Download generated documents",
  cases: "Download test plan + test cases",
  codegen: "Download Playwright specs",
  persist: "Download everything persisted so far",
};

/** Which stages expose a download button. */
export function stageDownloadKey(stage: StageId): StageArtifactKey | null {
  if (stage === "docs" || stage === "cases" || stage === "codegen" || stage === "persist") return stage;
  if (stage === "done" || stage === "failed") return "persist";
  return null;
}

function slug(s: string) {
  return (s || "artifact").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function loadPlan(testPlanId: string) {
  const { data, error } = await supabase
    .from("test_plans").select("*").eq("id", testPlanId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Test plan not found");
  return data as any;
}

/**
 * Packages the artifacts belonging to one stage into a ZIP and downloads it.
 * Returns the number of files written (0 = nothing generated yet).
 */
export async function downloadStageArtifacts(
  testPlanId: string,
  key: StageArtifactKey,
): Promise<number> {
  const plan = await loadPlan(testPlanId);
  const uid = plan.plan_uid || testPlanId.slice(0, 8);
  const root = `${uid}-${slug(plan.name)}`;
  const zip = new JSZip();
  let files = 0;

  const wantDocs = key === "docs" || key === "persist";
  const wantCases = key === "cases" || key === "persist";
  const wantSpecs = key === "codegen" || key === "persist";

  if (wantDocs) {
    const { data } = await supabase
      .from("test_plan_documents_v2" as any)
      .select("slug, title, content, sort_order")
      .eq("test_plan_id", testPlanId)
      .order("sort_order");
    for (const d of ((data ?? []) as any[])) {
      zip.file(`${root}/documents/${d.slug || slug(d.title)}.md`, d.content ?? "");
      files++;
    }
  }

  if (wantCases) {
    zip.file(`${root}/test-plan.json`, JSON.stringify(plan, null, 2));
    files++;
    const { data } = await supabase
      .from("test_plan_test_cases")
      .select("test_case:test_cases!test_plan_test_cases_test_case_id_fkey(*)")
      .eq("test_plan_id", testPlanId);
    const cases = ((data ?? []) as any[]).map((r) => r.test_case).filter(Boolean);
    zip.file(`${root}/test-cases/test-cases.json`, JSON.stringify(cases, null, 2));
    files++;
  }

  if (wantSpecs) {
    const { data } = await supabase
      .from("test_plan_specs" as any)
      .select("filename, content")
      .eq("test_plan_id", testPlanId)
      .order("filename");
    for (const s of ((data ?? []) as any[])) {
      zip.file(`${root}/automation/${s.filename}`, s.content ?? "");
      files++;
    }
  }

  // Stage log so the download states plainly whether anything was executed.
  const { data: logs } = await supabase
    .from("generation_stage_logs" as any)
    .select("kind, stage, message, dry_run, install_skipped, execution_skipped, created_at")
    .eq("test_plan_id", testPlanId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (logs?.length) {
    zip.file(`${root}/stage-log.json`, JSON.stringify(logs, null, 2));
  }

  if (files === 0) return 0;

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  triggerDownload(blob, `${root}-${key}.zip`);
  return files;
}
