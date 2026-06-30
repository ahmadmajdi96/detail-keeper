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
  await sb.from("jobs").update({
    progress, progress_message: message ?? null,
    checkpoint: checkpoint ?? null,
  }).eq("id", jobId);
}

// ---------------- generate_test_plan_from_docs ----------------
export async function handleGenerateTestPlanFromDocs(sb: Sb, job: any) {
  const test_plan_id = job.payload?.test_plan_id;
  if (!test_plan_id) throw new Error("payload.test_plan_id required");

  await sb.from("test_plans").update({
    ai_status: "running",
    ai_last_run_at: new Date().toISOString(),
  }).eq("id", test_plan_id);

  await setProgress(sb, job.id, 5, "Loading plan & documents");

  const { data: plan } = await sb.from("test_plans").select("*").eq("id", test_plan_id).single();
  if (!plan) throw new Error("Test plan not found");

  const { data: planDocs } = await sb
    .from("test_plan_documents")
    .select("document_id, documents:document_id(filename, content, summary)")
    .eq("test_plan_id", test_plan_id);

  const docsContext = (planDocs || [])
    .map((d: any) => {
      const doc = d.documents;
      if (!doc) return "";
      return `### ${doc.filename}\n${(doc.summary || "")}\n${(doc.content || "").slice(0, 6000)}`;
    })
    .filter(Boolean).join("\n\n---\n\n");

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  await setProgress(sb, job.id, 20, "Calling AI gateway");

  const systemPrompt = `You are a senior QA engineer. Generate a complete, structured test plan in JSON.
Return ONLY valid JSON with shape:
{ "objective": string, "scope": string, "coverage_areas": string[],
  "test_cases": [{ "title": string, "description": string,
    "priority": "high"|"medium"|"low",
    "type": "functional"|"integration"|"e2e"|"security"|"performance"|"regression",
    "preconditions": string, "steps": string[], "expected_result": string,
    "coverage_tags": string[] }] }
Generate 8-15 high-quality cases covering happy path, edge, negative, and security.`;

  const userPrompt = `Test Plan: ${plan.name}
Description: ${plan.description || "N/A"}
Objective: ${plan.objective || "N/A"}
Scope: ${plan.scope || "N/A"}

Source Documents:
${docsContext || "(no documents attached — infer from plan name/description)"}`;

  const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      response_format: { type: "json_object" },
    }),
  });
  if (!aiRes.ok) {
    const t = await aiRes.text();
    throw new Error(`AI gateway ${aiRes.status}: ${t.slice(0, 300)}`);
  }
  const aiJson = await aiRes.json();
  const raw = aiJson.choices?.[0]?.message?.content || "{}";
  const parsed = safeParseJson(raw);

  await setProgress(sb, job.id, 65, "Saving test cases");

  await sb.from("test_plans").update({
    objective: parsed.objective || plan.objective,
    scope: parsed.scope || plan.scope,
    ai_suggested: true,
  }).eq("id", test_plan_id);

  const cases = Array.isArray(parsed.test_cases) ? parsed.test_cases : [];
  let created = 0;
  for (const tc of cases) {
    const priorityNum = tc.priority === "high" ? 1 : tc.priority === "low" ? 3 : 2;
    const { data: inserted, error: tcErr } = await sb.from("test_cases").insert({
      title: tc.title || "Untitled",
      description: tc.description || null,
      preconditions: tc.preconditions || null,
      expected_result: tc.expected_result || null,
      priority: priorityNum,
      status: "draft",
      ai_generated: true,
      ai_confidence: 0.85,
      coverage_tags: tc.coverage_tags || (tc.type ? [tc.type, ...(tc.coverage_tags || [])] : null),
      created_by: plan.created_by,
      workspace_id: plan.workspace_id,
      project_id: plan.project_id,
      source: "ai_generated",
    }).select("id").single();

    if (!tcErr && inserted) {
      await sb.from("test_plan_test_cases").insert({
        test_plan_id, test_case_id: inserted.id, added_by: plan.created_by,
      });
      if (Array.isArray(tc.steps)) {
        const stepRows = tc.steps.map((s: string, i: number) => ({
          test_case_id: inserted.id, step_number: i + 1, action: s,
          expected_result: i === tc.steps.length - 1 ? tc.expected_result || "" : "",
        }));
        if (stepRows.length) await sb.from("test_case_steps").insert(stepRows);
      }
      created++;
    }
  }

  const nextVersion = (plan.current_version || 1) + (created > 0 ? 1 : 0);
  if (created > 0) {
    await sb.from("test_plan_versions").insert({
      test_plan_id, version: nextVersion, snapshot: parsed,
      change_summary: `AI generated ${created} test case(s)`,
      created_by: plan.created_by,
    });
    await sb.from("test_plans").update({
      ai_status: "ready", current_version: nextVersion,
    }).eq("id", test_plan_id);

    const docIds = (planDocs || []).map((d: any) => d.document_id).filter(Boolean);
    if (docIds.length) {
      await sb.from("documents").update({ status: "requirements_extracted" }).in("id", docIds);
    }
  } else {
    await sb.from("test_plans").update({ ai_status: "ready" }).eq("id", test_plan_id);
  }

  await setProgress(sb, job.id, 100, `Generated ${created} test case(s)`);
  return { created, test_plan_id };
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
