// Poll Repo Reader for a live Playwright execution and sync state, live-view
// URL, terminal logs and counters back into plan_test_runs.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const BASE = (Deno.env.get("REPO_READER_BASE_URL_V1") || "https://reporeader.qualixa.cortanexai.com").replace(/\/+$/, "");
const API_KEY = Deno.env.get("REPO_READER_API_KEY_V1") || "qualixa-repo-reader-key";
const TERMINAL = new Set(["succeeded", "failed", "canceled", "cancelled", "timeout", "error", "completed"]);

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

    const { plan_test_run_id, tail } = await req.json();
    if (!plan_test_run_id) return j({ error: "plan_test_run_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row } = await admin.from("plan_test_runs").select("*").eq("id", plan_test_run_id).maybeSingle();
    if (!row) return j({ error: "Not found" }, 404);
    const jobId = (row as any).forge_run_id as string | null;
    if (!jobId) return j({ status: (row as any).status });

    const resp = await fetch(`${BASE}/v1/jobs/${encodeURIComponent(jobId)}/execution`, {
      headers: { Authorization: `Bearer ${API_KEY}`, Accept: "application/json" },
    });
    if (!resp.ok) {
      const text = await resp.text();
      return j({ error: `Repo Reader execution status failed (${resp.status}): ${text.slice(0, 300)}` }, 502);
    }
    const s = await resp.json().catch(() => ({} as any));

    const remoteStatus = String(s?.status || "").toLowerCase();
    const state = s?.execution_state ?? {};
    const summary = s?.summary ?? state?.summary ?? {};
    const tce = state?.test_case_execution ?? {};
    const isTerminal = TERMINAL.has(remoteStatus);

    const hasTce = tce && typeof tce === "object" && Number(tce.total) > 0;
    const total = hasTce ? Number(tce.total)
      : pickN(summary, ["total", "total_tests", "tests"]) || pickN(state, ["total", "total_tests"]);
    const passed = hasTce ? Number(tce.passed || 0)
      : pickN(summary, ["passed", "passed_tests"]) || pickN(state, ["passed", "passed_tests"]);
    const failed = hasTce ? Number(tce.failed || 0)
      : pickN(summary, ["failed", "failed_tests"]) || pickN(state, ["failed", "failed_tests"]);
    const running = hasTce ? Number(tce.running || 0) : 0;

    let newStatus = (row as any).status as string;
    if (isTerminal) {
      newStatus = (remoteStatus === "canceled" || remoteStatus === "cancelled")
        ? "cancelled"
        : (remoteStatus === "succeeded" || remoteStatus === "completed") && failed === 0
          ? "passed"
          : "failed";
    } else if (remoteStatus === "queued") {
      newStatus = "queued";
    } else if (remoteStatus) {
      newStatus = "running";
    }

    // Live terminal log tail
    let logTail = (row as any).log_tail as string | null;
    try {
      const n = Number.isFinite(Number(tail)) ? Math.max(50, Math.min(2000, Number(tail))) : 500;
      const logResp = await fetch(
        `${BASE}/v1/jobs/${encodeURIComponent(jobId)}/execution/logs?tail=${n}`,
        { headers: { Authorization: `Bearer ${API_KEY}` } },
      );
      if (logResp.ok) {
        const text = await logResp.text();
        if (text) logTail = text.slice(-60_000);
      }
    } catch (_) { /* logs are best-effort */ }

    // Append a phase event when the phase changes.
    const events: any[] = Array.isArray((row as any).events) ? (row as any).events : [];
    const phase = String(state?.phase || remoteStatus || "");
    const now = new Date().toISOString();
    if (phase && phase !== (row as any).execution_phase) {
      events.push({ ts: now, type: "phase", status: remoteStatus, testName: phase });
    }

    const liveUrl = isTerminal ? null : (s?.live_view_url ?? null);

    const patch: Record<string, unknown> = {
      status: newStatus,
      execution_phase: phase || (row as any).execution_phase,
      live_view_url: liveUrl,
      live_view_status: isTerminal ? "unavailable" : (s?.live_view_status ?? state?.remote_browser?.status ?? null),
      download_url: s?.download_url ?? (isTerminal ? `/v1/jobs/${jobId}/download.zip` : null),
      log_tail: logTail,
      total_tests: total || (row as any).total_tests,
      passed_tests: passed || (row as any).passed_tests,
      failed_tests: failed || (row as any).failed_tests,
      running_tests: isTerminal ? 0 : (row as any).running_tests ?? 0,
      progress_message: s?.message || state?.message || phase || (row as any).progress_message,
      events: events.slice(-500),
      result: s,
      last_polled_at: now,
    };
    if (isTerminal && !(row as any).finished_at) patch.finished_at = now;

    await admin.from("plan_test_runs").update(patch).eq("id", plan_test_run_id);

    return j({
      status: newStatus,
      isTerminal,
      phase,
      live_view_url: liveUrl,
      live_view_status: patch.live_view_status,
      counts: { total, passed, failed },
    });
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});

function pickN(obj: any, keys: string[]): number {
  for (const k of keys) {
    const v = k.split(".").reduce<any>((a, p) => (a == null ? a : a[p]), obj);
    if (typeof v === "number") return v;
  }
  return 0;
}

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
