// Poll the Playwright codegen job stored on a test plan. Writes live
// progress into test_plans.codegen_* so any subscriber sees a progress
// bar. When the remote job succeeds, fetches the bundle and persists
// every file into test_plan_specs, then flips codegen_status to 'ready'.
// Idempotent — safe to call every few seconds from the client.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const FORGE_BASE = "https://testgenerator.qualixa.cortanexai.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return j({ error: "Unauthorized" }, 401);

    const apiKey = Deno.env.get("TESTGEN_API_KEY");
    if (!apiKey) return j({ error: "TESTGEN_API_KEY is not configured" }, 500);

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

    const s = await fetch(`${FORGE_BASE}/v1/codegen/${jobId}`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    if (!s.ok) {
      const t = await s.text();
      return j({ status: (plan as any).codegen_status, remote_http: s.status, note: t.slice(0, 200) });
    }
    const body = await s.json().catch(() => ({}));
    const rstatus = String(body?.status || body?.state || "").toLowerCase();
    const prog = (body?.progress && typeof body.progress === "object") ? body.progress : {};
    const totalUnits = Number(prog.totalUnits ?? prog.totalFiles ?? body?.totalUnits ?? 0);
    const completedUnits = Number(prog.completedUnits ?? prog.completedFiles ?? body?.completedUnits ?? 0);
    let percent: number | null = null;
    if (typeof body?.progress === "number") percent = clampPct(body.progress);
    else if (typeof body?.percent === "number") percent = clampPct(body.percent);
    else if (typeof prog.percent === "number") percent = clampPct(prog.percent);
    else if (totalUnits > 0) percent = clampPct((completedUnits / totalUnits) * 100);
    const stage = body?.stage || body?.phase || prog.stage || null;
    const message = buildMessage(rstatus, stage, completedUnits, totalUnits);

    if (["failed", "error", "cancelled"].includes(rstatus)) {
      await admin.from("test_plans").update({
        codegen_status: "failed",
        codegen_progress: percent ?? 0,
        codegen_progress_message: message || `Codegen ${rstatus}`,
        codegen_progress_updated_at: new Date().toISOString(),
      }).eq("id", test_plan_id);
      return j({ status: "failed", remote_status: rstatus });
    }

    const isSuccess = ["succeeded", "completed", "success", "completed_with_gaps", "completed_with_errors", "partial"].includes(rstatus)
      || rstatus.startsWith("completed");
    if (!isSuccess) {
      if (percent !== null && percent !== (plan as any).codegen_progress) {
        await admin.from("test_plans").update({
          codegen_status: "running",
          codegen_progress: percent,
          codegen_progress_message: message,
          codegen_progress_updated_at: new Date().toISOString(),
        }).eq("id", test_plan_id);
      } else if (message) {
        await admin.from("test_plans").update({
          codegen_status: "running",
          codegen_progress_message: message,
          codegen_progress_updated_at: new Date().toISOString(),
        }).eq("id", test_plan_id);
      }
      return j({ status: "running", remote_status: rstatus, progress: percent, message });
    }

    if ((plan as any).codegen_status === "ready") {
      return j({ status: "ready", remote_status: rstatus, note: "already persisted" });
    }

    await admin.from("test_plans").update({
      codegen_progress: 100,
      codegen_progress_message: "Fetching generated files…",
      codegen_progress_updated_at: new Date().toISOString(),
    }).eq("id", test_plan_id);

    const files = await fetchBundleWithRetry(jobId, apiKey);
    if (!files) {
      await admin.from("test_plans").update({
        codegen_status: "failed",
        codegen_progress_message: "Could not fetch generated files from Forge",
        codegen_progress_updated_at: new Date().toISOString(),
      }).eq("id", test_plan_id);
      return j({ status: "failed", note: "bundle fetch failed" });
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

    // Provenance for generated Playwright output: the document versions and
    // traceability mappings that were live when codegen ran.
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
    const { data: provLinks } = await admin
      .from("requirement_links")
      .select("requirement_id, linked_type, linked_id")
      .limit(2000);
    const provenance = {
      generator: "forge-codegen",
      job_id: jobId,
      generated_at: new Date().toISOString(),
      skip_stubs: skipStubs,
      documents: (provDocs ?? []).map((d: any) => {
        const v = provVersions.find((x: any) => x.document_id === d.id);
        return { document_id: d.id, slug: d.slug, title: d.title, version: v?.version ?? null, version_id: v?.id ?? null };
      }),
      traceability: { captured_at: new Date().toISOString(), mappings: (provLinks ?? []).length },
      traceability_links: provLinks ?? [],
    };

    let inserted = 0;
    for (const [path, content] of Object.entries(files)) {
      const filename = String(path).split("/").pop()!.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 200);
      const raw = typeof content === "string" ? content : JSON.stringify(content, null, 2);
      const isSpec = /\.(spec|test)\.(ts|tsx|js|mjs)$/i.test(filename);
      const text = skipStubs && isSpec
        ? `// Generated as an inspect-only skeleton — every test is skipped.\n${toSkipStub(raw)}`
        : raw;
      const language = filename.endsWith(".json") ? "json"
        : filename.endsWith(".ts") || filename.endsWith(".tsx") ? "typescript"
        : filename.endsWith(".js") ? "javascript" : "text";


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

    await admin.from("test_plans").update({
      codegen_status: "ready",
      codegen_progress: 100,
      codegen_progress_message: `Generated ${inserted} spec file${inserted === 1 ? "" : "s"}`,
      codegen_progress_updated_at: new Date().toISOString(),
    }).eq("id", test_plan_id);

    {
      const dry = (plan as any).codegen_dry_run !== false;
      await admin.from("generation_stage_logs").insert([
        {
          test_plan_id, kind: "code", stage: "persist", dry_run: dry,
          install_skipped: dry, execution_skipped: dry,
          message: dry
            ? `Specs persisted (${inserted} file${inserted === 1 ? "" : "s"}) — no dependencies installed, no tests executed`
            : `Specs persisted (${inserted} file${inserted === 1 ? "" : "s"})`,
          meta: { inserted, skip_stubs: skipStubs },
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
    return j({ status: "ready", inserted });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(99, Math.round(n)));
}

function buildMessage(status: string, stage: any, done: number, total: number): string {
  if (stage) return `${String(stage)}${total ? ` · ${done}/${total} files` : ""}`;
  if (total > 0) return `Generating specs · ${done}/${total} files`;
  if (status === "queued") return "Queued at Forge";
  if (status === "running") return "Generating Playwright code…";
  return "";
}

async function fetchBundleWithRetry(jobId: string, apiKey: string): Promise<Record<string, any> | null> {
  const urls = [
    `${FORGE_BASE}/v1/codegen/${jobId}/bundle`,
    `${FORGE_BASE}/v1/codegen/${jobId}/files`,
    `${FORGE_BASE}/v1/codegen/${jobId}/artifacts`,
  ];
  for (const url of urls) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(url, { headers: { authorization: `Bearer ${apiKey}` } });
        if (!r.ok) { await sleep(500 * (attempt + 1)); continue; }
        const body = await r.json().catch(() => ({}));
        const files = extractFiles(body);
        if (files && Object.keys(files).length) return files;
      } catch {
        await sleep(500 * (attempt + 1));
      }
    }
  }
  return null;
}

function extractFiles(body: any): Record<string, any> | null {
  if (!body || typeof body !== "object") return null;
  if (body.files && typeof body.files === "object" && !Array.isArray(body.files)) return body.files;
  if (Array.isArray(body.files)) {
    const out: Record<string, any> = {};
    for (const f of body.files) {
      const p = f?.path || f?.filename || f?.name;
      const c = f?.content ?? f?.body ?? f?.source;
      if (p) out[String(p)] = c ?? "";
    }
    return out;
  }
  if (Array.isArray(body.artifacts)) {
    const out: Record<string, any> = {};
    for (const f of body.artifacts) {
      const p = f?.path || f?.filename || f?.name;
      const c = f?.content ?? f?.body ?? f?.source;
      if (p) out[String(p)] = c ?? "";
    }
    return out;
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
