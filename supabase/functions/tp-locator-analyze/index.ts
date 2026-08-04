// AI Locator Intelligence (pre-execution).
// Scans the Playwright specs of a test plan, extracts every locator, asks the
// AI gateway to classify each one (valid / weak / broken) and to propose a
// stronger Playwright locator, then stores a Locator Health report.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { callAiJson } from "../_shared/ai-gateway.ts";

const LOCATOR_RE =
  /(getByRole|getByTestId|getByLabel|getByPlaceholder|getByAltText|getByTitle|getByText|locator)\s*\(([\s\S]{0,300}?)\)/g;

interface Extracted {
  id: string;
  file: string;
  line: number;
  strategy: string;
  raw: string;
}

function extractLocators(files: Array<{ filename: string; content: string }>): Extracted[] {
  const out: Extracted[] = [];
  for (const f of files) {
    const lines = (f.content ?? "").split("\n");
    lines.forEach((text, i) => {
      LOCATOR_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = LOCATOR_RE.exec(text)) !== null) {
        const raw = `${m[1]}(${m[2].trim()})`;
        out.push({
          id: `${f.filename}:${i + 1}:${out.length}`,
          file: f.filename,
          line: i + 1,
          strategy: m[1],
          raw: raw.slice(0, 240),
        });
      }
    });
  }
  return out;
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

    const { test_plan_id, suite_id, base_url } = await req.json();
    if (!test_plan_id) return j({ error: "test_plan_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: plan } = await admin
      .from("test_plans")
      .select("id, project_id, workspace_id, variables")
      .eq("id", test_plan_id)
      .maybeSingle();
    if (!plan) return j({ error: "Test plan not found" }, 404);

    const { data: specs } = await admin
      .from("test_plan_specs")
      .select("id, filename, content")
      .eq("test_plan_id", test_plan_id);
    const files = (specs ?? []) as Array<{ id: string; filename: string; content: string }>;
    if (files.length === 0) {
      return j({ error: "No Playwright specs on this plan — generate Playwright code first." }, 400);
    }

    const locators = extractLocators(files);
    if (locators.length === 0) {
      const { data: empty } = await admin.from("locator_analyses").insert({
        test_plan_id, project_id: (plan as any).project_id, suite_id: suite_id ?? null,
        base_url: base_url ?? null, status: "completed", verdict: "ready",
        health_score: 100,
        totals: { total: 0, healthy: 0, weak: 0, broken: 0, fixes: 0 },
        findings: [], created_by: userId,
      }).select("id").single();
      return j({ analysis_id: empty?.id, totals: { total: 0 }, verdict: "ready", health_score: 100 });
    }

    const { data: analysis, error: insErr } = await admin.from("locator_analyses").insert({
      test_plan_id,
      project_id: (plan as any).project_id,
      suite_id: suite_id ?? null,
      base_url: base_url ?? null,
      status: "running",
      totals: { total: locators.length },
      created_by: userId,
    }).select("id").single();
    if (insErr) return j({ error: insErr.message }, 500);

    // Analyse in batches so a large suite doesn't overflow the context window.
    const findings: any[] = [];
    const BATCH = 40;
    for (let i = 0; i < locators.length; i += BATCH) {
      const batch = locators.slice(i, i + BATCH);
      const prompt = [
        base_url ? `Application under test: ${base_url}` : "",
        "Assess each Playwright locator below for reliability.",
        "Rules: getByRole/getByTestId with a stable name are strong. getByText with long or dynamic copy,",
        "deep CSS chains, nth-child, index-based selectors, XPath, generated class names (hashes) and",
        "absolute paths are weak. Syntactically invalid or empty selectors are broken.",
        "",
        JSON.stringify(batch.map((l) => ({ id: l.id, file: l.file, line: l.line, locator: l.raw }))),
        "",
        'Return JSON: {"results":[{"id","health":"healthy|weak|broken","reason","recommendation","confidence":0-100}]}',
        "recommendation must be a complete replacement Playwright locator expression (or null when healthy).",
      ].join("\n");

      try {
        const res = await callAiJson<{ results: any[] }>(prompt, {
          system: "You are a senior Playwright automation engineer auditing element locators. Answer with JSON only.",
          temperature: 0.1,
        });
        const byId = new Map((res?.results ?? []).map((r: any) => [String(r.id), r]));
        for (const l of batch) {
          const r: any = byId.get(l.id) ?? {};
          const health = ["healthy", "weak", "broken"].includes(r.health) ? r.health : "healthy";
          findings.push({
            ...l,
            health,
            reason: r.reason ?? null,
            recommendation: health === "healthy" ? null : (r.recommendation ?? null),
            confidence: Number.isFinite(Number(r.confidence)) ? Number(r.confidence) : null,
            status: "pending",
          });
        }
      } catch (e) {
        for (const l of batch) {
          findings.push({ ...l, health: "healthy", reason: `Not analysed: ${(e as Error).message}`, recommendation: null, confidence: null, status: "pending" });
        }
      }
    }

    const healthy = findings.filter((f) => f.health === "healthy").length;
    const weak = findings.filter((f) => f.health === "weak").length;
    const broken = findings.filter((f) => f.health === "broken").length;
    const total = findings.length;
    const score = total === 0 ? 100 : Math.round(((healthy + weak * 0.5) / total) * 100);
    const verdict = broken > 0 ? "blocked" : weak > 0 ? "warning" : "ready";

    await admin.from("locator_analyses").update({
      status: "completed",
      verdict,
      health_score: score,
      totals: { total, healthy, weak, broken, fixes: 0 },
      findings,
    }).eq("id", analysis.id);

    return j({ analysis_id: analysis.id, totals: { total, healthy, weak, broken }, verdict, health_score: score });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
