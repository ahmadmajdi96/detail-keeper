// Poll the Repo Reader Playwright code job stored on a test plan.
//
//   GET  /v1/jobs/<playwright_code_job_id>
//   GET  /v1/jobs/<playwright_code_job_id>/documents
//   GET  /v1/jobs/<playwright_code_job_id>/documents/<path>
//
// Writes live progress into test_plans.codegen_* and, on success, persists
// every generated file into `test_plan_specs`, then flips codegen_status to
// 'ready'. Idempotent — safe to call every few seconds from the client.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const BASE = (Deno.env.get("REPO_READER_BASE_URL_V1") || "https://reporeader.qualixa.cortanexai.com").replace(/\/+$/, "");
const API_KEY = Deno.env.get("REPO_READER_API_KEY_V1") || "qualixa-repo-reader-key";

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

    const { data: plan } = await admin
      .from("test_plans")
      .select("id, project_id, workspace_id, codegen_status, codegen_job_ref, codegen_progress, codegen_skip_stubs, codegen_dry_run")
      .eq("id", test_plan_id)
      .maybeSingle();
    if (!plan) return j({ error: "Test plan not found" }, 404);
    const jobId = (plan as any).codegen_job_ref;
    if (!jobId) return j({ status: (plan as any).codegen_status || "unknown", note: "no job ref" });

    const s = await rr(`/v1/jobs/${jobId}`);
    if (!s.ok) {
      const t = await s.text();
      return j({ status: (plan as any).codegen_status, remote_http: s.status, note: t.slice(0, 200) });
    }
    const body = await s.json().catch(() => ({}));
    const rstatus = String(body?.status || body?.state || "").toLowerCase();
    const prog = (body?.progress && typeof body.progress === "object") ? body.progress : {};
    let percent: number | null = null;
    if (typeof body?.progress === "number") percent = clampPct(body.progress);
    else if (typeof body?.percent === "number") percent = clampPct(body.percent);
    else if (typeof prog.percent === "number") percent = clampPct(prog.percent);
    const stage = body?.stage || body?.phase || prog.stage || null;
    const message = buildMessage(rstatus, stage, percent);

    if (["failed", "error", "cancelled", "canceled"].includes(rstatus)) {
      const detail = body?.error || body?.message || null;
      await admin.from("test_plans").update({
        codegen_status: "failed",
        codegen_progress: percent ?? 0,
        codegen_progress_message: detail ? String(detail).slice(0, 300) : (message || `Codegen ${rstatus}`),
        codegen_progress_updated_at: new Date().toISOString(),
      }).eq("id", test_plan_id);
      return j({ status: "failed", remote_status: rstatus });
    }

    const isSuccess = ["succeeded", "completed", "success", "ready"].includes(rstatus)
      || rstatus.startsWith("completed");
    if (!isSuccess) {
      await admin.from("test_plans").update({
        codegen_status: "running",
        ...(percent !== null ? { codegen_progress: percent } : {}),
        codegen_progress_message: message,
        codegen_progress_updated_at: new Date().toISOString(),
      }).eq("id", test_plan_id);
      return j({ status: "running", remote_status: rstatus, progress: percent, message });
    }

    if ((plan as any).codegen_status === "ready") {
      return j({ status: "ready", remote_status: rstatus, note: "already persisted" });
    }

    await admin.from("test_plans").update({
      codegen_progress: 100,
      codegen_progress_message: "Fetching generated Playwright files…",
      codegen_progress_updated_at: new Date().toISOString(),
    }).eq("id", test_plan_id);

    const paths = await listDocuments(jobId);
    if (!paths.length) {
      const msg = "Repo Reader finished but returned no Playwright files yet — re-run code generation.";
      await admin.from("test_plans").update({
        codegen_status: "failed",
        codegen_progress_message: msg,
        codegen_progress_updated_at: new Date().toISOString(),
      }).eq("id", test_plan_id);
      await admin.from("generation_stage_logs").insert({
        test_plan_id, kind: "code", stage: "failed", message: msg, meta: { job_ref: jobId },
      } as any);
      return j({ status: "failed", error: msg });
    }

    // When the plan asked for inspect-only skeletons, force every generated
    // test into a skip stub so opening the file can never trigger a run.
    const skipStubs = (plan as any).codegen_skip_stubs === true;
    const toSkipStub = (src: string) =>
      src
        .replace(/(^|[^.\w])test\s*\(/g, "$1test.skip(")
        .replace(/(^|[^.\w])it\s*\(/g, "$1it.skip(")
        .replace(/(^|[^.\w])test\.only\s*\(/g, "$1test.skip(")
        .replace(/(^|[^.\w])test\.skip\.skip\s*\(/g, "$1test.skip(");

    // ---- Provenance snapshot -------------------------------------------
    const { data: provDocs } = await admin
      .from("test_plan_documents_v2")
      .select("id, slug, title")
      .eq("test_plan_id", test_plan_id);
    const provDocIds = (provDocs ?? []).map((d: any) => d.id);
    let provVersions: any[] = [];
    if (provDocIds.length) {
      const { data: vs } = await admin
        .from("test_plan_document_versions")
        .select("id, document_id, version")
        .in("document_id", provDocIds)
        .order("version", { ascending: false });
      const seen = new Set<string>();
      provVersions = (vs ?? []).filter((v: any) => {
        if (seen.has(v.document_id)) return false;
        seen.add(v.document_id);
        return true;
      });
    }
    const { count: linkCount } = await admin
      .from("requirement_links")
      .select("requirement_id", { count: "exact", head: true });
    const provenance = {
      generator: "repo-reader-playwright-code",
      job_id: jobId,
      generated_at: new Date().toISOString(),
      skip_stubs: skipStubs,
      env: { base_url_env: "PLAYWRIGHT_BASE_URL", api_base_url_env: "API_BASE_URL", auth_token_env: "E2E_AUTH_TOKEN" },
      documents: (provDocs ?? []).map((d: any) => {
        const v = provVersions.find((x: any) => x.document_id === d.id);
        return { document_id: d.id, slug: d.slug, title: d.title, version: v?.version ?? null, version_id: v?.id ?? null };
      }),
      traceability: { captured_at: new Date().toISOString(), mappings: linkCount ?? 0 },
    };

    let inserted = 0;
    const failedFiles: string[] = [];
    for (const path of paths) {
      const raw = await fetchDocument(jobId, path);
      if (raw === null) { failedFiles.push(path); continue; }
      const filename = path.replace(/^\/+/, "").replace(/[^a-zA-Z0-9._/-]/g, "-").slice(0, 240);
      const isSpec = /\.(spec|test)\.(ts|tsx|js|mjs)$/i.test(filename);
      const text = skipStubs && isSpec
        ? `// Generated as an inspect-only skeleton — every test is skipped.\n${toSkipStub(raw)}`
        : raw;
      const language = filename.endsWith(".json") ? "json"
        : filename.endsWith(".ts") || filename.endsWith(".tsx") ? "typescript"
        : filename.endsWith(".js") ? "javascript"
        : filename.endsWith(".md") ? "markdown" : "text";

      const { data: existing } = await admin.from("test_plan_specs")
        .select("id").eq("test_plan_id", test_plan_id).eq("filename", filename).maybeSingle();
      if (existing) {
        await admin.from("test_plan_specs").update({ content: text, language, provenance } as any).eq("id", existing.id);
      } else {
        await admin.from("test_plan_specs").insert({
          test_plan_id, project_id: (plan as any).project_id,
          filename, content: text, language, created_by: userId, provenance,
        } as any);
      }
      inserted++;
    }

    if (inserted === 0) {
      const msg = "Could not download any generated Playwright files from Repo Reader.";
      await admin.from("test_plans").update({
        codegen_status: "failed",
        codegen_progress_message: msg,
        codegen_progress_updated_at: new Date().toISOString(),
      }).eq("id", test_plan_id);
      return j({ status: "failed", error: msg, failed_files: failedFiles });
    }

    await admin.from("test_plans").update({
      codegen_status: "ready",
      codegen_progress: 100,
      codegen_progress_message: `Generated ${inserted} Playwright file${inserted === 1 ? "" : "s"}`,
      codegen_progress_updated_at: new Date().toISOString(),
    }).eq("id", test_plan_id);

    {
      const dry = (plan as any).codegen_dry_run !== false;
      await admin.from("generation_stage_logs").insert([
        {
          test_plan_id, kind: "code", stage: "persist", dry_run: dry,
          install_skipped: dry, execution_skipped: dry,
          message: dry
            ? `Playwright project persisted (${inserted} file${inserted === 1 ? "" : "s"}) — no dependencies installed, no tests executed`
            : `Playwright project persisted (${inserted} file${inserted === 1 ? "" : "s"})`,
          meta: { inserted, skip_stubs: skipStubs, failed_files: failedFiles },
        },
        {
          test_plan_id, kind: "code", stage: "done", dry_run: dry,
          install_skipped: dry, execution_skipped: dry,
          message: dry
            ? "Codegen completed in dry-run mode — dependency installation and test execution were skipped"
            : "Codegen completed",
          meta: { inserted },
        },
      ]);
    }
    return j({ status: "ready", inserted, failed_files: failedFiles });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function rr(path: string, init: RequestInit = {}) {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${API_KEY}`, Accept: "application/json", ...(init.headers ?? {}) },
  });
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(99, Math.round(n)));
}

function buildMessage(status: string, stage: unknown, percent: number | null): string {
  if (stage) return `${String(stage)}${percent !== null ? ` · ${percent}%` : ""}`;
  if (status === "queued") return "Queued on Repo Reader";
  if (status === "running") return "Generating Playwright project…";
  return "Working…";
}

/** List every file the code job produced (nested paths included). */
async function listDocuments(jobId: string): Promise<string[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await rr(`/v1/jobs/${jobId}/documents`);
      if (r.ok) {
        const body = await r.json();
        const arr = Array.isArray(body) ? body : (body?.documents ?? body?.files ?? []);
        const list = (Array.isArray(arr) ? arr : [])
          .map((d: any) => {
            if (typeof d === "string") return d;
            // Prefer the relative filename — `path` is an absolute server path
            // (/data/artifacts/...) which the documents endpoint rejects.
            const raw = String(d?.filename ?? d?.name ?? d?.path ?? "");
            return raw.includes("/outputs/") ? raw.split("/outputs/").pop()! : raw.replace(/^\/+/, "");
          })
          .filter(Boolean);
        if (list.length) return list;

      }
    } catch { /* retry */ }
    await sleep(700 * (attempt + 1));
  }
  return [];
}

/** Fetch a single (possibly nested) document as text. */
async function fetchDocument(jobId: string, path: string): Promise<string | null> {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await rr(`/v1/jobs/${jobId}/documents/${encoded}`);
      if (r.ok) {
        const text = await r.text();
        // Some documents are returned wrapped in a JSON envelope.
        try {
          const p = JSON.parse(text);
          if (p && typeof p === "object" && typeof p.content === "string") return p.content;
        } catch { /* plain text */ }
        return text;
      }
    } catch { /* retry */ }
    await sleep(400 * (attempt + 1));
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
