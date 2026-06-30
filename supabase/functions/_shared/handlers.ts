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
        error_message: t.error?.message || null,
        error_signature: t.error?.signature || null,
        logs: t.error?.stack || null,
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

export const HANDLERS: Record<string, (sb: Sb, job: any) => Promise<any>> = {
  generate_test_plan_from_docs: handleGenerateTestPlanFromDocs,
  ingest_ci_results: handleIngestCiResults,
};
