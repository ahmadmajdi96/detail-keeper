// Client-triggered Playwright codegen via testcase-forge.
// POSTs to /v1/codegen with the source test-generation jobId + env-var NAMES
// from the test plan's variable sets, then polls until terminal and persists
// every returned file into test_plan_specs.
//
// The remote endpoint requires `sourceJobId` to be a UUID (the id of a
// completed /v1/test-generations job on the same tenant), and env vars to be
// UPPER_SNAKE_CASE names — values are never sent.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const FORGE_BASE = "https://testgenerator.qualixa.cortanexai.com";
const ENV_NAME = /^[A-Z][A-Z0-9_]{0,63}$/;

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

    const { test_plan_id, base_url } = await req.json();
    if (!test_plan_id) return j({ error: "test_plan_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: plan } = await admin
      .from("test_plans")
      .select("id, project_id, workspace_id, ai_job_ref, ai_status, variables")
      .eq("id", test_plan_id)
      .maybeSingle();
    if (!plan) return j({ error: "Test plan not found" }, 404);
    const sourceJobId = (plan as any).ai_job_ref as string | null;
    if (!sourceJobId) {
      return j({ error: "Generate test cases first — no Forge sourceJobId on this plan." }, 400);
    }
    if ((plan as any).ai_status !== "ready") {
      return j({ error: "Test case generation must finish before codegen." }, 400);
    }

    // Extract env-var NAMES (values are never sent) from all variable sets.
    const rawSets = Array.isArray((plan as any).variables) ? (plan as any).variables : [];
    const names = new Set<string>();
    for (const s of rawSets) {
      const vars = Array.isArray(s?.variables) ? s.variables : Array.isArray(s) ? [] : [];
      const list = vars.length ? vars : (s?.key ? [s] : []);
      for (const v of list) {
        const k = String(v?.key ?? "").trim();
        if (ENV_NAME.test(k)) names.add(k);
      }
    }
    const envVars = Array.from(names).slice(0, 50);

    const body: any = {
      sourceJobId,
      options: {
        ...(envVars.length ? { envVars } : {}),
        ...(base_url ? { baseUrl: String(base_url) } : {}),
        concurrency: 4,
        maxCasesPerFile: 10,
      },
    };

    const submit = await fetch(`${FORGE_BASE}/v1/codegen`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!submit.ok) {
      const t = await submit.text();
      return j({ error: `Forge codegen submit failed (${submit.status}): ${t.slice(0, 500)}` }, 502);
    }
    const submitBody = await submit.json().catch(() => ({}));
    const codegenJobId: string | undefined = submitBody?.id || submitBody?.jobId;
    if (!codegenJobId) return j({ error: "Forge did not return a codegen job id", raw: submitBody }, 502);

    // Poll + persist in background so the client can return immediately.
    const work = pollAndPersist({
      admin, apiKey, test_plan_id,
      project_id: (plan as any).project_id,
      codegenJobId, userId,
    }).catch((e) => console.error("codegen work failed", (e as Error).message));

    // @ts-ignore EdgeRuntime is available in Supabase functions
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);

    return j({ status: "accepted", codegenJobId, envVarsSent: envVars.length }, 202);
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

async function pollAndPersist(args: {
  admin: any; apiKey: string; test_plan_id: string;
  project_id: string; codegenJobId: string; userId: string;
}) {
  const { admin, apiKey, test_plan_id, project_id, codegenJobId, userId } = args;
  const started = Date.now();
  const MAX_MS = 30 * 60 * 1000; // 30 minutes
  let terminal = false;
  let status = "queued";

  while (Date.now() - started < MAX_MS) {
    await sleep(5000);
    try {
      const r = await fetch(`${FORGE_BASE}/v1/codegen/${codegenJobId}`, {
        headers: { authorization: `Bearer ${apiKey}` },
      });
      if (!r.ok) continue;
      const s = await r.json().catch(() => ({}));
      status = String(s?.status || "").toLowerCase();
      if (["completed", "completed_with_errors", "succeeded", "failed", "cancelled"].includes(status)
          || status.startsWith("completed")) {
        terminal = true;
        break;
      }
    } catch { /* retry */ }
  }

  if (!terminal || ["failed", "cancelled"].includes(status)) {
    console.warn("codegen not persisted", codegenJobId, status);
    return;
  }

  // Fetch bundle: {files: {path: content}}
  const b = await fetch(`${FORGE_BASE}/v1/codegen/${codegenJobId}/bundle`, {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  if (!b.ok) {
    console.warn("bundle fetch failed", codegenJobId, b.status);
    return;
  }
  const bundle = await b.json().catch(() => ({}));
  const files: Record<string, string> = (bundle && typeof bundle.files === "object") ? bundle.files : {};

  let inserted = 0;
  for (const [path, content] of Object.entries(files)) {
    const filename = String(path).split("/").pop()!.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 200);
    const text = typeof content === "string" ? content : JSON.stringify(content, null, 2);
    const language = filename.endsWith(".json") ? "json"
      : filename.endsWith(".ts") || filename.endsWith(".tsx") ? "typescript"
      : filename.endsWith(".js") ? "javascript" : "text";

    const { data: existing } = await admin.from("test_plan_specs")
      .select("id").eq("test_plan_id", test_plan_id).eq("filename", filename).maybeSingle();
    if (existing) {
      await admin.from("test_plan_specs").update({ content: text, language }).eq("id", existing.id);
    } else {
      await admin.from("test_plan_specs").insert({
        test_plan_id, project_id, filename, content: text, language, created_by: userId,
      });
    }
    inserted++;
  }
  console.log(`codegen persisted ${inserted} files for plan ${test_plan_id}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
