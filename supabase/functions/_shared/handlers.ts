// Job handlers invoked by the durable job worker. Each handler receives the
// SupabaseClient (service role) plus the job row and returns a result (or throws).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { detectAndParse, NormalizedTest } from "./parsers.ts";

type Sb = ReturnType<typeof createClient>;

function safeParseJson(input: string): any {
  let s = String(input ?? "").trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = s.search(/[\{\[]/);
  if (start > 0) s = s.slice(start);
  const open = s[0];
  const close = open === "[" ? "]" : "}";
  const end = s.lastIndexOf(close);
  if (end !== -1) s = s.slice(0, end + 1);
  try { return JSON.parse(s); } catch (_) {}
  let c = s.replace(/[\u0000-\u001F\u007F]/g, (ch) =>
    ch === "\n" ? "\\n" : ch === "\r" ? "\\r" : ch === "\t" ? "\\t" : "");
  c = c.replace(/\\(?!["\\/bfnrtu])/g, "\\\\").replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(c);
}

async function setProgress(sb: Sb, jobId: string, progress: number, message?: string, checkpoint?: any) {
  const patch: Record<string, any> = { progress, progress_message: message ?? null };
  if (checkpoint !== undefined) patch.checkpoint = checkpoint;
  await sb.from("jobs").update(patch).eq("id", jobId);
}

function waitForJob(progress: number, message: string, checkpoint: any, delayMs = 60_000) {
  return {
    __job_control: "waiting",
    progress,
    progress_message: message,
    checkpoint,
    run_after: new Date(Date.now() + delayMs).toISOString(),
  };
}

function nonRetryableError(message: string) {
  const err = new Error(message) as Error & { nonRetryable?: boolean };
  err.nonRetryable = true;
  return err;
}

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Best-effort terminate a remote Doc Generator job. Never throws — used from
// failure paths where we must not mask the original error.
export async function terminateRemoteDocJob(
  base: string,
  key: string,
  remoteJobId: string,
  reason: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const res = await fetchWithTimeout(
      `${base}/v1/jobs/${remoteJobId}/terminate`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      },
      15_000,
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: t.slice(0, 200) };
    }
    return { ok: true, status: res.status };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

// ---------------- generate_test_plan_from_docs ----------------
// New flow: send all AI-generated project docs (project_generated_docs) to the
// external Doc Generator service, wait for it to produce the 10 test-plan docs,
// and persist them as test_plan_documents_v2 rows so the workbench renders them.
export async function handleGenerateTestPlanFromDocs(sb: Sb, job: any) {
  const test_plan_id = job.payload?.test_plan_id;
  if (!test_plan_id) throw new Error("payload.test_plan_id required");

  await sb.from("test_plans").update({
    ai_status: "running",
    ai_last_run_at: new Date().toISOString(),
  }).eq("id", test_plan_id);

  await setProgress(sb, job.id, 5, "Loading plan & AI project docs");

  const { data: plan } = await sb.from("test_plans").select("*").eq("id", test_plan_id).single();
  if (!plan) throw new Error("Test plan not found");

  const { data: aiDocs } = await sb
    .from("project_generated_docs")
    .select("slug, filename, title, content")
    .eq("project_id", plan.project_id)
    .order("slug", { ascending: true });

  const docs = aiDocs || [];
  if (!docs.length) {
    throw new Error("Project has no AI-generated documents yet. Generate them from the project's AI Docs tab first.");
  }

  const BASE = Deno.env.get("DOC_GENERATOR_BASE_URL") || "https://docgenerator.qualixa.cortanexai.com";
  const KEY = Deno.env.get("DOC_GENERATOR_API_KEY");
  if (!KEY) throw new Error("DOC_GENERATOR_API_KEY not configured");

  const EXPECTED_FILES = [
    "00_master_test_plan.md",
    "01_unit_test_plan.md",
    "02_integration_api_test_plan.md",
    "03_stress_load_test_plan.md",
    "04_penetration_security_test_plan.md",
    "05_benchmark_performance_test_plan.md",
    "06_edge_case_catalog.md",
    "07_automation_backlog.md",
    "08_traceability_matrix.md",
    "09_execution_runbook.md",
  ];

  const checkpoint = job.checkpoint || {};
  const startedAt = checkpoint.started_at || new Date().toISOString();
  const overallStarted = new Date(startedAt).getTime();
  const MAX_TOTAL_MS = 60 * 60 * 1000;
  const POLL_DELAY_MS = 2 * 60 * 1000;
  const STUCK_WITHOUT_CHANGE_MS = 35 * 60 * 1000;
  let remoteJobId = checkpoint.remote_job_id as string | undefined;
  let remoteStatus = checkpoint.remote_status || "queued";
  let remoteProgress = typeof checkpoint.remote_progress === "number" ? checkpoint.remote_progress : 0;
  let lastRemoteChangeAt = checkpoint.last_remote_change_at || startedAt;

  if (Date.now() - overallStarted > MAX_TOTAL_MS) {
    if (remoteJobId) {
      await terminateRemoteDocJob(BASE, KEY, remoteJobId, `Qualixa safe-runtime limit exceeded (${Math.round(MAX_TOTAL_MS / 60000)}m)`);
    }
    throw nonRetryableError(`Doc Generator exceeded the safe runtime limit (${Math.round(MAX_TOTAL_MS / 60000)} minutes). Last status: ${remoteStatus}${remoteProgress ? ` · ${remoteProgress}%` : ""}`);
  }

  // 1. Build multipart with each project doc as a file, unless this job already
  // has a checkpointed remote job to resume.
  if (!remoteJobId) {
    await setProgress(sb, job.id, 15, `Uploading ${docs.length} docs to Doc Generator`);
    const form = new FormData();
    for (const d of docs) {
      const name = (d.filename || `${d.slug}.md`).endsWith(".md")
        ? (d.filename || `${d.slug}.md`)
        : `${d.filename || d.slug}.md`;
      form.append("files", new Blob([d.content || ""], { type: "text/markdown" }), name);
    }
    form.append("metadata", JSON.stringify({
      source: "qualixa",
      test_plan_id,
      project_id: plan.project_id,
      plan_name: plan.name,
      plan_description: plan.description,
      expected_files: EXPECTED_FILES,
    }));

    const createRes = await fetchWithTimeout(`${BASE}/v1/jobs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}` },
      body: form,
    }, 30_000);
    if (!createRes.ok) {
      const t = await createRes.text();
      throw new Error(`Doc Generator create job failed (${createRes.status}): ${t.slice(0, 300)}`);
    }
    const createJson = await createRes.json();
    remoteJobId = createJson.id || createJson.job_id;
    if (!remoteJobId) throw new Error("Doc Generator did not return a job id");
    const nextCheckpoint = {
      started_at: startedAt,
      remote_job_id: remoteJobId,
      remote_status: "queued",
      remote_progress: 0,
      last_remote_change_at: new Date().toISOString(),
      expected_files: EXPECTED_FILES,
    };
    lastRemoteChangeAt = nextCheckpoint.last_remote_change_at;
    await setProgress(sb, job.id, 25, "Doc Generator queued — waiting for documents", nextCheckpoint);
    return waitForJob(
      25,
      "Doc Generator queued — waiting for documents",
      nextCheckpoint,
      POLL_DELAY_MS,
    );
  }

  // 2. Poll once per worker invocation, then release the worker. The external
  // service keeps running with the checkpointed remote_job_id, so platform
  // request timeouts cannot restart generation or create duplicate remote jobs.
  let lastErr: string | null = null;
  const pollRes = await fetchWithTimeout(`${BASE}/v1/jobs/${remoteJobId}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  }, 20_000);
  let pj: any = {};

  if (!pollRes.ok) {
    lastErr = `poll ${pollRes.status}`;
  } else {
    pj = await pollRes.json();
    const nextStatus = (pj.status || remoteStatus || "running").toLowerCase();
    const nextProgress = typeof pj.progress === "number" ? pj.progress : remoteProgress;
    if (nextStatus !== remoteStatus || nextProgress !== remoteProgress) {
      lastRemoteChangeAt = new Date().toISOString();
    }
    remoteStatus = nextStatus;
    remoteProgress = nextProgress;
  }

  const mapped = 25 + Math.min(60, Math.round(remoteProgress * 0.6));
  const nextCheckpoint = {
    started_at: startedAt,
    remote_job_id: remoteJobId,
    remote_status: remoteStatus,
    remote_progress: remoteProgress,
    last_remote_change_at: lastRemoteChangeAt,
    expected_files: EXPECTED_FILES,
    last_poll_at: new Date().toISOString(),
    last_poll_error: lastErr,
  };
  await setProgress(sb, job.id, mapped, `Doc Generator: ${remoteStatus || "running"}${remoteProgress ? ` · ${remoteProgress}%` : ""}${lastErr ? ` · ${lastErr}` : ""}`, nextCheckpoint);

  if (["failed", "error", "cancelled", "canceled"].includes(remoteStatus)) {
    // Remote already terminal — no terminate call needed.
    throw nonRetryableError(`Doc Generator failed: ${pj.error || remoteStatus}`);
  }
  if (!["succeeded", "success", "completed", "ready"].includes(remoteStatus)) {
    if (Date.now() - new Date(lastRemoteChangeAt).getTime() > STUCK_WITHOUT_CHANGE_MS) {
      await terminateRemoteDocJob(BASE, KEY, remoteJobId, `Qualixa detected stuck job — no change in ${Math.round(STUCK_WITHOUT_CHANGE_MS / 60000)}m`);
      throw nonRetryableError(`Doc Generator appears stuck: no status/progress change for ${Math.round(STUCK_WITHOUT_CHANGE_MS / 60000)} minutes (last: ${remoteStatus}${remoteProgress ? ` · ${remoteProgress}%` : ""})`);
    }
    if (Date.now() - overallStarted > MAX_TOTAL_MS) {
      await terminateRemoteDocJob(BASE, KEY, remoteJobId, `Qualixa safe-runtime limit exceeded (${Math.round(MAX_TOTAL_MS / 60000)}m)`);
      throw nonRetryableError(`Doc Generator exceeded the safe runtime limit (${Math.round(MAX_TOTAL_MS / 60000)} minutes). Last status: ${remoteStatus}${remoteProgress ? ` · ${remoteProgress}%` : ""}`);
    }
    return waitForJob(
      mapped,
      `Doc Generator: ${remoteStatus || "running"}${remoteProgress ? ` · ${remoteProgress}%` : ""}${lastErr ? ` · ${lastErr}` : ""}`,
      nextCheckpoint,
      POLL_DELAY_MS,
    );
  }
  if (!["succeeded", "success", "completed", "ready"].includes(remoteStatus)) {
    return waitForJob(
      mapped,
      `Doc Generator: ${remoteStatus || "running"}${remoteProgress ? ` · ${remoteProgress}%` : ""}${lastErr ? ` · ${lastErr}` : ""}`,
      nextCheckpoint,
      POLL_DELAY_MS,
    );
  }

  // 3. List generated documents.
  await setProgress(sb, job.id, 88, "Downloading generated documents");
  const listRes = await fetchWithTimeout(`${BASE}/v1/jobs/${remoteJobId}/documents`, {
    headers: { Authorization: `Bearer ${KEY}` },
  }, 20_000);
  if (!listRes.ok) throw new Error(`Doc Generator list failed: ${listRes.status}`);
  const listJson = await listRes.json();
  const documents: Array<{ filename: string; title?: string; slug?: string; bytes?: number }> =
    listJson.documents || [];

  if (!documents.length) throw new Error("Doc Generator returned no documents");
  const docsByFilename = new Map(documents.map((d: any) => [d.filename || d.name, d]));
  const orderedDocuments = EXPECTED_FILES.map((filename) => docsByFilename.get(filename)).filter(Boolean) as Array<{ filename: string; title?: string; slug?: string; bytes?: number }>;
  if (!orderedDocuments.length) throw new Error("Doc Generator did not return the expected test plan files");

  // 4. Download each doc and persist to test_plan_documents_v2 (replace).
  await sb.from("test_plan_documents_v2").delete().eq("test_plan_id", test_plan_id);

  const rows: any[] = [];
  for (let i = 0; i < orderedDocuments.length; i++) {
    const d = orderedDocuments[i];
    const dlRes = await fetchWithTimeout(
      `${BASE}/v1/jobs/${remoteJobId}/documents/${encodeURIComponent(d.filename)}`,
      { headers: { Authorization: `Bearer ${KEY}` } },
      20_000,
    );
    if (!dlRes.ok) continue;
    const content = await dlRes.text();
    const baseName = (d.filename || `doc-${i + 1}`).replace(/\.md$/i, "");
    const slug = (d.slug || baseName).toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 60);
    rows.push({
      test_plan_id,
      project_id: plan.project_id,
      slug,
      title: d.title || baseName.replace(/^\d+_?/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      kind: inferPlanDocKind(baseName),
      content,
      sort_order: i,
      created_by: plan.created_by,
    });
  }

  if (!rows.length) throw new Error("No documents downloaded from Doc Generator");

  const { error: insErr } = await sb.from("test_plan_documents_v2").insert(rows);
  if (insErr) throw new Error(`Persist docs failed: ${insErr.message}`);

  const nextVersion = (plan.current_version || 1) + 1;
  await sb.from("test_plan_versions").insert({
    test_plan_id, version: nextVersion,
    snapshot: { source: "doc-generator", remote_job_id: remoteJobId, document_count: rows.length },
    change_summary: `Doc Generator produced ${rows.length} document(s)`,
    created_by: plan.created_by,
  });

  await sb.from("test_plans").update({
    ai_status: "ready",
    ai_suggested: true,
    current_version: nextVersion,
  }).eq("id", test_plan_id);

  await setProgress(sb, job.id, 100, `Generated ${rows.length} test-plan document(s)`);
  return { document_count: rows.length, test_plan_id, remote_job_id: remoteJobId };
}

function inferPlanDocKind(baseName: string): string {
  const n = baseName.toLowerCase();
  if (n.includes("master")) return "test_strategy";
  if (n.includes("unit")) return "unit_plan";
  if (n.includes("integration") || n.includes("api")) return "api_contract_plan";
  if (n.includes("stress") || n.includes("load")) return "performance_plan";
  if (n.includes("penetration") || n.includes("security")) return "security_plan";
  if (n.includes("benchmark") || n.includes("performance")) return "performance_plan";
  if (n.includes("edge")) return "risk_matrix";
  if (n.includes("automation")) return "automation_plan";
  if (n.includes("traceability")) return "traceability";
  if (n.includes("runbook") || n.includes("execution")) return "release_checklist";
  return "other";
}


// ---------------- ingest_ci_results ----------------
export async function handleIngestCiResults(sb: Sb, job: any) {
  const { project_id, build_id, release_id, environment_id, artifact_url, artifact_content, framework_hint } = job.payload || {};
  if (!project_id) throw new Error("payload.project_id required");

  await setProgress(sb, job.id, 10, "Fetching artifact");
  let content: string = artifact_content || "";
  if (!content && artifact_url) {
    const r = await fetch(artifact_url);
    if (!r.ok) throw new Error(`Artifact fetch ${r.status}`);
    content = await r.text();
  }
  if (!content) throw new Error("No artifact content");

  await setProgress(sb, job.id, 25, "Parsing results");
  const { framework, tests } = detectAndParse(content);
  const fw = framework_hint || framework;

  await setProgress(sb, job.id, 40, `Parsed ${tests.length} tests (${fw})`);

  // Resolve cycle: pick (or create) one for release+env+build
  let cycleId: string | undefined;
  const { data: existingCycle } = await sb.from("test_cycles").select("id")
    .eq("project_id", project_id)
    .eq("release_id", release_id || null)
    .eq("environment_id", environment_id || null)
    .eq("build_id", build_id || null)
    .limit(1).maybeSingle();
  if (existingCycle) cycleId = existingCycle.id;
  if (!cycleId) {
    const shortSha = job.payload?.commit_sha ? String(job.payload.commit_sha).slice(0, 7) : "ci";
    const { data: newCycle, error: cErr } = await sb.from("test_cycles").insert({
      project_id, release_id, environment_id, build_id,
      name: `CI ${shortSha}`, status: "in_progress",
    }).select("id").single();
    if (cErr) throw cErr;
    cycleId = newCycle.id;
  }

  // Create run
  const { data: run, error: rErr } = await sb.from("cycle_runs").insert({
    cycle_id: cycleId, project_id, name: `CI ${fw}`, status: "in_progress",
    started_at: new Date().toISOString(),
  }).select("id").single();
  if (rErr) throw rErr;

  await setProgress(sb, job.id, 55, "Mapping tests to cases");

  // Load mappings + cases
  const { data: mappings } = await sb.from("automation_mappings").select("*").eq("project_id", project_id);
  const { data: existingCases } = await sb.from("test_cases").select("id,title").eq("project_id", project_id);

  let pass = 0, fail = 0, skip = 0;
  let idx = 0;
  for (const t of tests as NormalizedTest[]) {
    idx++;
    if (idx % 25 === 0) await setProgress(sb, job.id, 55 + Math.floor((idx / tests.length) * 35), `Ingested ${idx}/${tests.length}`);

    // Resolve test_case_id
    let caseId: string | undefined;
    for (const m of mappings || []) {
      if (m.framework && m.framework !== fw) continue;
      try {
        const re = new RegExp(m.test_id_pattern);
        if (re.test(t.full_name) || re.test(t.name)) { caseId = m.test_case_id; break; }
      } catch (_) {}
    }
    if (!caseId) {
      const match = existingCases?.find((c: any) =>
        c.title.toLowerCase() === t.name.toLowerCase() ||
        c.title.toLowerCase() === t.full_name.toLowerCase());
      caseId = match?.id;
    }
    if (!caseId) {
      const { data: ghost } = await sb.from("test_cases").insert({
        title: t.name || t.full_name, description: `Auto-imported from ${fw}`,
        priority: 2, status: "draft", project_id,
        automation_status: "automated", automation_path: t.full_name,
        source: "ci", ai_generated: false,
      }).select("id").single();
      caseId = ghost?.id;
    }
    if (!caseId) continue;

    const itemStatus = t.status === "passed" ? "passed"
      : t.status === "skipped" ? "skipped"
      : t.status === "failed" ? "failed" : "blocked";

    const { data: item } = await sb.from("cycle_run_items").upsert({
      run_id: run.id, cycle_id: cycleId, test_case_id: caseId,
      status: itemStatus, attempt_count: 1,
      duration_ms: t.duration_ms || null,
      last_executed_at: new Date().toISOString(),
    }, { onConflict: "run_id,test_case_id" }).select("id").single();

    if (item) {
      await sb.from("cycle_attempts").insert({
        run_item_id: item.id, attempt_no: 1, status: itemStatus,
        started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
        duration_ms: t.duration_ms || null,
        error_signature: t.error?.signature || null,
        notes: t.error?.message || null,
        logs_ref: t.error?.stack ? t.error.stack.slice(0, 4000) : null,
      });
    }

    if (itemStatus === "passed") pass++;
    else if (itemStatus === "failed") fail++;
    else skip++;
  }

  await sb.from("cycle_runs").update({
    status: "completed", finished_at: new Date().toISOString(),
    notes: `${pass} passed, ${fail} failed, ${skip} skipped`,
  }).eq("id", run.id);

  if (build_id) {
    await sb.from("builds").update({
      status: fail > 0 ? "failed" : "success",
    }).eq("id", build_id);
  }

  await setProgress(sb, job.id, 100, `Ingested ${tests.length} tests`);
  return { framework: fw, total: tests.length, pass, fail, skip, run_id: run.id, cycle_id: cycleId };
}

// ---------------- evaluate_quality_gates ----------------
export async function handleEvaluateQualityGates(sb: Sb, job: any) {
  const { cycle_run_id, project_id } = job.payload || {};
  if (!cycle_run_id || !project_id) throw new Error("cycle_run_id + project_id required");
  await setProgress(sb, job.id, 10, "Loading run + gates");

  const { data: run } = await sb.from("cycle_runs").select("*, test_cycles!inner(release_id, environment_id, build_id)").eq("id", cycle_run_id).single();
  if (!run) throw new Error("cycle_run not found");
  const releaseId = (run as any).test_cycles?.release_id;
  const buildId = (run as any).test_cycles?.build_id;

  const { data: items } = await sb.from("cycle_run_items").select("status,attempt_count").eq("run_id", cycle_run_id);
  const total = items?.length || 0;
  const passed = items?.filter((i: any) => i.status === "passed").length || 0;
  const failed = items?.filter((i: any) => i.status === "failed").length || 0;
  const flaky = items?.filter((i: any) => i.status === "passed" && (i.attempt_count || 1) > 1).length || 0;
  const passRate = total ? passed / total : 0;
  const flakyRate = total ? flaky / total : 0;

  const { data: defectsList } = await sb.from("defects").select("severity,status").eq("cycle_run_id", cycle_run_id);
  const critical = defectsList?.filter((d: any) => d.severity === "critical" && d.status !== "closed").length || 0;
  const major = defectsList?.filter((d: any) => d.severity === "major" && d.status !== "closed").length || 0;

  const metrics = { total, passed, failed, pass_rate: passRate, flaky_rate: flakyRate, critical_defects: critical, major_defects: major };

  await setProgress(sb, job.id, 40, "Evaluating gates");
  const { data: gates } = await sb.from("quality_gates").select("*").eq("project_id", project_id).eq("enabled", true);

  let anyBlock = false;
  for (const g of gates || []) {
    const r = g.rules || {};
    const results: any[] = [];
    let status: "passed" | "failed" | "warning" = "passed";

    const check = (name: string, ok: boolean, actual: any, expected: any) => {
      results.push({ name, ok, actual, expected });
      if (!ok) status = "failed";
    };

    if (typeof r.min_pass_rate === "number") check("min_pass_rate", passRate >= r.min_pass_rate, passRate, r.min_pass_rate);
    if (typeof r.max_failed === "number") check("max_failed", failed <= r.max_failed, failed, r.max_failed);
    if (typeof r.max_flaky_rate === "number") check("max_flaky_rate", flakyRate <= r.max_flaky_rate, flakyRate, r.max_flaky_rate);
    if (typeof r.max_critical_defects === "number") check("max_critical_defects", critical <= r.max_critical_defects, critical, r.max_critical_defects);
    if (typeof r.max_major_defects === "number") check("max_major_defects", major <= r.max_major_defects, major, r.max_major_defects);

    const blocks = status === "failed" && g.blocks_release;
    if (blocks) anyBlock = true;

    await sb.from("gate_evaluations").insert({
      gate_id: g.id, project_id, workspace_id: g.workspace_id,
      release_id: releaseId || null, cycle_run_id, build_id: buildId || null,
      status, blocks_release: blocks, metrics, rule_results: results,
    });
  }

  // Auto block/approve release
  if (releaseId) {
    const newStatus = anyBlock ? "blocked" : "in_qa";
    await sb.from("releases").update({ status: newStatus }).eq("id", releaseId);
  }

  await setProgress(sb, job.id, 100, `Evaluated ${gates?.length || 0} gates`);
  return { gates: gates?.length || 0, blocks: anyBlock, metrics };
}

// ---------------- ai_release_judge ----------------
export async function handleAiReleaseJudge(sb: Sb, job: any) {
  const { cycle_run_id, project_id, release_id, deployment_id } = job.payload || {};
  if (!cycle_run_id || !project_id) throw new Error("cycle_run_id + project_id required");
  await setProgress(sb, job.id, 10, "Loading run context");

  const { data: run } = await sb.from("cycle_runs").select("*, test_cycles(name, release_id, environment_id)").eq("id", cycle_run_id).single();
  if (!run) throw new Error("cycle_run not found");
  const resolvedRelease = release_id || (run as any).test_cycles?.release_id;

  const { data: items } = await sb.from("cycle_run_items")
    .select("status,attempt_count,test_cases(title)")
    .eq("run_id", cycle_run_id);
  const total = items?.length || 0;
  const passed = items?.filter((i: any) => i.status === "passed").length || 0;
  const failed = items?.filter((i: any) => i.status === "failed").length || 0;
  const skipped = items?.filter((i: any) => i.status === "skipped").length || 0;
  const flaky = items?.filter((i: any) => i.status === "passed" && (i.attempt_count || 1) > 1).length || 0;

  const { data: failures } = await sb.from("cycle_attempts")
    .select("error_signature,notes,run_item_id,cycle_run_items!inner(run_id,test_cases(title))")
    .eq("status", "failed")
    .eq("cycle_run_items.run_id", cycle_run_id)
    .limit(40);

  const failureLines = (failures || []).map((f: any) =>
    `- ${f.cycle_run_items?.test_cases?.title || "test"}: ${(f.notes || f.error_signature || "(no message)").slice(0, 200)}`
  ).join("\n");

  const { data: gateEvals } = await sb.from("gate_evaluations")
    .select("status,blocks_release,rule_results").eq("cycle_run_id", cycle_run_id);
  const blockingGates = (gateEvals || []).filter((g: any) => g.blocks_release).length;

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  await setProgress(sb, job.id, 50, "Calling AI judge");

  const prompt = `You are a senior release-quality judge. Decide whether this release is safe to ship.

Cycle run: ${(run as any).name || (run as any).test_cycles?.name}
Totals: ${total} tests | ${passed} passed | ${failed} failed | ${skipped} skipped | ${flaky} flaky
Blocking quality gates: ${blockingGates}

Top failures:
${failureLines || "(none)"}

Return JSON with shape:
{"verdict":"approve"|"block"|"warn","score":0-100,"summary":"2-3 sentence executive summary","failure_themes":[{"theme":"...","count":N,"examples":["..."]}],"next_actions":["actionable step","..."]}`;

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!aiRes.ok) {
    const t = await aiRes.text();
    throw new Error(`AI gateway ${aiRes.status}: ${t.slice(0, 300)}`);
  }
  const ai = await aiRes.json();
  const parsed = safeParseJson(ai.choices?.[0]?.message?.content || "{}");

  const { data: proj } = await sb.from("projects").select("workspace_id").eq("id", project_id).single();

  await sb.from("release_evaluations").insert({
    project_id, workspace_id: (proj as any)?.workspace_id,
    release_id: resolvedRelease || null,
    cycle_run_id, deployment_id: deployment_id || null,
    verdict: parsed.verdict || "warn",
    score: typeof parsed.score === "number" ? parsed.score : null,
    summary: parsed.summary || null,
    failure_themes: parsed.failure_themes || [],
    next_actions: parsed.next_actions || [],
    metrics: { total, passed, failed, skipped, flaky, blocking_gates: blockingGates },
    model: "google/gemini-2.5-flash",
  });

  await setProgress(sb, job.id, 100, `Verdict: ${parsed.verdict}`);
  return { verdict: parsed.verdict, score: parsed.score };
}

export const HANDLERS: Record<string, (sb: Sb, job: any) => Promise<any>> = {
  generate_test_plan_from_docs: handleGenerateTestPlanFromDocs,
  ingest_ci_results: handleIngestCiResults,
  evaluate_quality_gates: handleEvaluateQualityGates,
  ai_release_judge: handleAiReleaseJudge,
};
