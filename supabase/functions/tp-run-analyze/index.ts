// AI failure analysis for a completed automated run (FR-7).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { callAiJson } from "../_shared/ai-gateway.ts";

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

    const { plan_test_run_id } = await req.json();
    if (!plan_test_run_id) return j({ error: "plan_test_run_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: run } = await admin.from("plan_test_runs").select("*").eq("id", plan_test_run_id).maybeSingle();
    if (!run) return j({ error: "Run not found" }, 404);

    const tcp: any = (run as any).test_case_progress ?? {};
    const cases: any[] = Array.isArray(tcp.test_cases) ? tcp.test_cases : [];
    const failed = cases.filter((c) => ["failed", "timed_out", "timedout"].includes(String(c.status).toLowerCase()));

    if (failed.length === 0 && (run as any).failed_tests === 0) {
      const empty = { generated_at: new Date().toISOString(), summary: "All tests passed — no failures to analyse.", failures: [] };
      await admin.from("plan_test_runs").update({ ai_analysis: empty, ai_analysis_status: "completed" }).eq("id", plan_test_run_id);
      return j(empty);
    }

    await admin.from("plan_test_runs").update({ ai_analysis_status: "running" }).eq("id", plan_test_run_id);

    const logTail = String((run as any).log_tail ?? "").slice(-14000);
    const prompt = [
      `Base URL: ${(run as any).base_url ?? "unknown"}`,
      `Environment: ${(run as any).environment ?? "unspecified"} · Browser: ${(run as any).browser ?? "chromium"}`,
      `Totals: ${(run as any).total_tests} tests, ${(run as any).passed_tests} passed, ${(run as any).failed_tests} failed.`,
      "",
      "Failed test cases:",
      JSON.stringify(failed.slice(0, 40).map((c) => ({
        title: c.title ?? c.name ?? c.id,
        status: c.status,
        error: String(c.error ?? c.error_message ?? c.message ?? "").slice(0, 1200),
        duration_ms: c.duration_ms ?? c.duration ?? null,
      }))),
      "",
      "Playwright log tail:",
      logTail,
      "",
      'Return JSON: {"summary":"...","failures":[{"test","root_cause","category":"ui_change|locator|network|backend|assertion|flaky|environment|data|unknown","likely_flaky":true|false,"suggested_fix","confidence":0-100}]}',
    ].join("\n");

    let analysis: any;
    try {
      analysis = await callAiJson<any>(prompt, {
        system: "You are a senior QA automation engineer performing root-cause analysis of Playwright failures. Answer with JSON only.",
        temperature: 0.2,
      });
    } catch (e) {
      await admin.from("plan_test_runs").update({ ai_analysis_status: "failed" }).eq("id", plan_test_run_id);
      return j({ error: (e as Error).message }, 502);
    }

    const payload = {
      generated_at: new Date().toISOString(),
      summary: analysis?.summary ?? "",
      failures: Array.isArray(analysis?.failures) ? analysis.failures : [],
    };
    await admin.from("plan_test_runs").update({ ai_analysis: payload, ai_analysis_status: "completed" }).eq("id", plan_test_run_id);
    return j(payload);
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
