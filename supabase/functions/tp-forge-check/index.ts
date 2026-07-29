// Poll the Repo Reader test-case job stored on a test plan. Writes live
// progress back to test_plans (ai_progress, ai_progress_message) so any client
// subscribed to that row sees a live progress bar. When the remote job
// succeeds, fetches 01_test_case_catalog.json, persists the cases (plus the
// Playwright skeleton file when present), then flips ai_status to 'ready'.
// Idempotent — safe to call every few seconds from the client.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const BASE = (Deno.env.get("REPO_READER_BASE_URL_V1") || "https://reporeader.qualixa.cortanexai.com").replace(/\/+$/, "");
const API_KEY = Deno.env.get("REPO_READER_API_KEY_V1") || "qualixa-repo-reader-key";

const DONE = ["succeeded", "completed", "success", "ready"];
const FAILED = ["failed", "error", "canceled", "cancelled"];

const CATALOG_JSON = "01_test_case_catalog.json";
const SKELETON_FILE = "03_playwright_spec_skeletons.ts";

function rr(path: string, init: RequestInit = {}) {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${API_KEY}`, Accept: "application/json", ...(init.headers || {}) },
  });
}

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
    const userId = claims.claims.sub as string;

    const { test_plan_id } = await req.json();
    if (!test_plan_id) return j({ error: "test_plan_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: plan } = await admin
      .from("test_plans")
      .select("id, project_id, workspace_id, ai_status, ai_job_ref, ai_progress, ai_dry_run")
      .eq("id", test_plan_id)
      .maybeSingle();
    if (!plan) return j({ error: "Test plan not found" }, 404);
    const jobId = (plan as any).ai_job_ref;
    if (!jobId) return j({ status: (plan as any).ai_status || "unknown", note: "no job ref" });

    const s = await rr(`/v1/jobs/${jobId}`);
    const text = await s.text();
    if (!s.ok) {
      return j({ status: (plan as any).ai_status, remote_http: s.status, note: text.slice(0, 200) });
    }
    const body = JSON.parse(text || "{}");
    const rstatus = String(body?.status || body?.state || "").toLowerCase();
    const percent = typeof body?.progress === "number" ? clampPct(body.progress)
      : typeof body?.percent === "number" ? clampPct(body.percent) : null;
    const message = buildMessage(rstatus, body?.stage ?? body?.phase ?? null, percent);

    if (FAILED.includes(rstatus)) {
      const msg = body?.error || message || `Test-case job ${rstatus}`;
      await admin.from("test_plans").update({
        ai_status: "failed",
        ai_progress: percent ?? 0,
        ai_progress_message: msg,
        ai_progress_updated_at: new Date().toISOString(),
      }).eq("id", test_plan_id);
      await admin.from("generation_stage_logs").insert({
        test_plan_id, kind: "cases", stage: "failed", message: msg,
      });
      return j({ status: "failed", remote_status: rstatus });
    }

    if (!DONE.includes(rstatus)) {
      if (percent !== null && percent !== (plan as any).ai_progress) {
        await admin.from("test_plans").update({
          ai_progress: percent,
          ai_progress_message: message,
          ai_progress_updated_at: new Date().toISOString(),
        }).eq("id", test_plan_id);
      } else if (message) {
        await admin.from("test_plans").update({
          ai_progress_message: message,
          ai_progress_updated_at: new Date().toISOString(),
        }).eq("id", test_plan_id);
      }
      return j({ status: "running", remote_status: rstatus, progress: percent, message });
    }

    // Succeeded — but only persist once. If already ready, no-op.
    if ((plan as any).ai_status === "ready") {
      return j({ status: "ready", remote_status: rstatus, note: "already persisted" });
    }

    await admin.from("test_plans").update({
      ai_progress: 100,
      ai_progress_message: "Persisting generated test cases…",
      ai_progress_updated_at: new Date().toISOString(),
    }).eq("id", test_plan_id);

    const catalog = await fetchCatalog(jobId);
    if (!catalog) {
      await admin.from("test_plans").update({
        ai_status: "failed",
        ai_progress_message: "Could not fetch the generated test-case catalog from Repo Reader",
        ai_progress_updated_at: new Date().toISOString(),
      }).eq("id", test_plan_id);
      return j({ status: "failed", note: "catalog fetch failed" });
    }
    const items: any[] = Array.isArray(catalog.test_cases) ? catalog.test_cases : [];

    // ---- Provenance snapshot -------------------------------------------
    const buildProvenance = async () => {
      const { data: docs } = await admin
        .from("test_plan_documents_v2")
        .select("id, slug, title, updated_at")
        .eq("test_plan_id", test_plan_id);
      const docIds = (docs ?? []).map((d: any) => d.id);
      let versions: any[] = [];
      if (docIds.length) {
        const { data: vs } = await admin
          .from("test_plan_document_versions")
          .select("id, document_id, version, created_at")
          .in("document_id", docIds)
          .order("version", { ascending: false });
        const seen = new Set<string>();
        versions = (vs ?? []).filter((v: any) => {
          if (seen.has(v.document_id)) return false;
          seen.add(v.document_id);
          return true;
        });
      }
      const { data: links } = await admin
        .from("requirement_links")
        .select("requirement_id, linked_type, linked_id")
        .limit(2000);
      return {
        generator: "repo-reader",
        job_id: jobId,
        source_job_id: catalog.source_job_id ?? null,
        sqa_job_id: catalog.sqa_job_id ?? null,
        schema_version: catalog.schema_version ?? null,
        generated_at: new Date().toISOString(),
        documents: (docs ?? []).map((d: any) => {
          const v = versions.find((x: any) => x.document_id === d.id);
          return {
            document_id: d.id,
            slug: d.slug,
            title: d.title,
            version: v?.version ?? null,
            version_id: v?.id ?? null,
          };
        }),
        traceability: {
          captured_at: new Date().toISOString(),
          mappings: (links ?? []).length,
        },
        traceability_links: links ?? [],
      };
    };
    const provenance = await buildProvenance();

    // ---- Suite auto-grouping (by test_type / tags) ----------------------
    const suiteCache = new Map<string, string>();
    {
      const { data: existing } = await admin
        .from("test_suites").select("id,name").eq("project_id", plan.project_id);
      (existing ?? []).forEach((s: any) => suiteCache.set(String(s.name).toLowerCase(), s.id));
    }
    const suiteIdFor = async (tc: any, tags: string[]): Promise<string | null> => {
      const raw = tc.suite ?? tc.suite_name ?? tc.module ?? tc.feature
        ?? tc.category ?? tc.area ?? tc.test_type ?? tags[0];
      const name = String(raw ?? "").trim().slice(0, 80);
      if (!name) return null;
      const key = name.toLowerCase();
      if (suiteCache.has(key)) return suiteCache.get(key)!;
      const { data: created } = await admin.from("test_suites").insert({
        project_id: plan.project_id,
        name,
        description: "Auto-created by Qualixa AI generation",
        created_by: userId,
        provenance,
      } as any).select("id").single();
      if (!created) return null;
      suiteCache.set(key, created.id);
      return created.id;
    };

    let inserted = 0;
    for (const tc of items) {
      const title = String(tc.title || "Untitled").slice(0, 200);
      const description = String(tc.description || "");
      const expected = String(tc.expected_result || tc.expectedResult || "");
      const pr = String(tc.priority || "P2").toLowerCase();
      const priority = pr.includes("p0") || pr.includes("critical") ? 1
        : pr.includes("p1") || pr.includes("high") ? 1
        : pr.includes("p3") || pr.includes("low") ? 3 : 2;
      const tags = Array.isArray(tc.coverage_tags) ? tc.coverage_tags.slice(0, 8)
        : Array.isArray(tc.coverageTags) ? tc.coverageTags.slice(0, 8) : [];
      const preconds = String(tc.preconditions || "");
      const suite_id = await suiteIdFor(tc, tags as string[]);

      const rawType = String(tc.test_type ?? tc.testType ?? "").toLowerCase();
      const tagText = (tags as string[]).join(" ").toLowerCase();
      const test_type = rawType.includes("smoke") || tagText.includes("smoke") ? "smoke" : "regression";
      const rawScore = Number(tc.score ?? tc.priority_score ?? tc.priorityScore);
      const priority_score = Number.isFinite(rawScore)
        ? Math.max(0, Math.min(100, Math.round(rawScore)))
        : null;

      const { data: row, error } = await admin.from("test_cases").insert({
        workspace_id: plan.workspace_id,
        project_id: plan.project_id,
        suite_id,
        title,
        description,
        expected_result: expected,
        preconditions: preconds || null,
        priority,
        test_type,
        priority_score,
        status: "draft",
        ai_generated: true,
        coverage_tags: tags,
        created_by: userId,
        provenance: {
          ...provenance,
          external_id: tc.id ?? null,
          score_factors: tc.score_factors ?? null,
          ai_suggestions: tc.ai_suggestions ?? null,
          automation: tc.automation ?? null,
          source_requirements: (provenance.traceability_links ?? [])
            .filter((l: any) => l.linked_type === "test_case")
            .map((l: any) => l.requirement_id),
        },
      } as any).select("id").single();
      if (error || !row) continue;

      await admin.from("test_plan_test_cases").insert({
        test_plan_id, test_case_id: row.id, added_by: userId,
      } as any);

      const steps: any[] = Array.isArray(tc.steps) ? tc.steps : [];
      if (steps.length) {
        await admin.from("test_case_steps").insert(
          steps.map((st: any, i: number) => ({
            test_case_id: row.id,
            step_number: Number(st.index ?? i + 1),
            action: String(st.action ?? st.step ?? ""),
            expected_result: String(st.expected_result ?? st.expectedResult ?? ""),
          })),
        );
      }
      inserted++;
    }

    // ---- Playwright skeletons (optional companion artifact) -------------
    let skeletonSaved = false;
    try {
      const sk = await rr(`/v1/jobs/${jobId}/documents/${encodeURIComponent(SKELETON_FILE)}`);
      if (sk.ok) {
        const content = await sk.text();
        if (content.trim()) {
          const { data: existing } = await admin.from("test_plan_specs")
            .select("id").eq("test_plan_id", test_plan_id).eq("filename", SKELETON_FILE).maybeSingle();
          if (existing) {
            await admin.from("test_plan_specs")
              .update({ content, language: "typescript", provenance } as any).eq("id", existing.id);
          } else {
            await admin.from("test_plan_specs").insert({
              test_plan_id, project_id: plan.project_id,
              filename: SKELETON_FILE, content, language: "typescript",
              created_by: userId, provenance,
            } as any);
          }
          skeletonSaved = true;
        }
      }
    } catch { /* optional artifact */ }

    await admin.from("test_plans").update({
      ai_status: "ready",
      ai_progress: 100,
      ai_progress_message: `Generated ${inserted} test cases`,
      ai_progress_updated_at: new Date().toISOString(),
    }).eq("id", test_plan_id);

    {
      const dry = (plan as any).ai_dry_run !== false;
      await admin.from("generation_stage_logs").insert([
        {
          test_plan_id, kind: "cases", stage: "persist", dry_run: dry,
          install_skipped: dry, execution_skipped: dry,
          message: dry
            ? `Artifacts persisted (${inserted} test cases) — no dependencies installed, no tests executed`
            : `Artifacts persisted (${inserted} test cases)`,
          meta: { inserted, skeleton_saved: skeletonSaved, counts: catalog.test_case_counts_by_type ?? null },
        },
        {
          test_plan_id, kind: "cases", stage: "done", dry_run: dry,
          install_skipped: dry, execution_skipped: dry,
          message: dry
            ? "Job completed in dry-run mode — dependency installation and test execution were skipped"
            : "Job completed",
          meta: { inserted },
        },
      ]);
    }
    return j({ status: "ready", inserted, skeleton_saved: skeletonSaved });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(99, Math.round(n)));
}

function buildMessage(status: string, stage: unknown, percent: number | null): string {
  if (stage) return `${String(stage)}${percent !== null ? ` · ${percent}%` : ""}`;
  if (status === "queued") return "Queued on Repo Reader";
  if (percent !== null && percent < 40) return "Analysing SQA plan and requirements";
  if (percent !== null && percent < 85) return "Generating test cases";
  if (status === "running") return "Generating test cases…";
  return "Working…";
}

/** Fetch the JSON catalog, tolerating transient upstream blips. */
async function fetchCatalog(jobId: string): Promise<any | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await rr(`/v1/jobs/${jobId}/documents/${encodeURIComponent(CATALOG_JSON)}`);
      if (r.ok) {
        const raw = await r.text();
        try { return JSON.parse(raw); } catch { return null; }
      }
    } catch { /* retry */ }
    await sleep(600 * (attempt + 1));
  }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
