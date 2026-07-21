// Polls TestCase Forge for the status of a plan_test_run and syncs
// counters + streaming events + terminal state back into the DB.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const FORGE_BASE = "https://testgenerator.qualixa.cortanexai.com";
const TERMINAL = new Set(["passed", "failed", "cancelled", "timeout", "error", "completed", "succeeded"]);

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

    const { plan_test_run_id } = await req.json();
    if (!plan_test_run_id) return j({ error: "plan_test_run_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row } = await admin.from("plan_test_runs").select("*").eq("id", plan_test_run_id).maybeSingle();
    if (!row) return j({ error: "Not found" }, 404);
    if (!(row as any).forge_run_id) return j({ status: (row as any).status });

    // Fetch status
    const statusResp = await fetch(`${FORGE_BASE}/v1/test-runs/${(row as any).forge_run_id}`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    if (!statusResp.ok) {
      const text = await statusResp.text();
      return j({ error: `Forge status failed (${statusResp.status}): ${text.slice(0, 300)}` }, 502);
    }
    const s = await statusResp.json().catch(() => ({} as any));

    // Extract counters (flexible — Forge shape varies by field name)
    const total = pickN(s, ["totalTests", "total", "counts.total"]);
    const passed = pickN(s, ["passedTests", "passed", "counts.passed"]);
    const failed = pickN(s, ["failedTests", "failed", "counts.failed"]);
    const running = pickN(s, ["runningTests", "running", "counts.running"]);
    const remoteStatus = String(s?.status || s?.state || "").toLowerCase();
    const isTerminal = TERMINAL.has(remoteStatus);
    let newStatus = (row as any).status as string;
    if (isTerminal) {
      newStatus = (remoteStatus === "cancelled") ? "cancelled"
        : (failed > 0 || ["failed", "error", "timeout"].includes(remoteStatus)) ? "failed"
        : "passed";
    } else if (remoteStatus) {
      newStatus = "running";
    }

    // Pull recent events (append-only, dedupe by id/ts+type)
    const existingEvents: any[] = Array.isArray((row as any).events) ? (row as any).events : [];
    let merged = existingEvents;
    try {
      const evResp = await fetch(`${FORGE_BASE}/v1/test-runs/${(row as any).forge_run_id}/events`, {
        headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" },
      });
      if (evResp.ok) {
        const text = await evResp.text();
        const parsed = parseEvents(text);
        if (parsed.length) {
          const seen = new Set(existingEvents.map((e) => e?.id ?? `${e?.ts}|${e?.type}|${e?.testId ?? ""}`));
          const additions = parsed.filter((e) => {
            const key = e?.id ?? `${e?.ts}|${e?.type}|${e?.testId ?? ""}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          merged = existingEvents.concat(additions).slice(-500);
        }
      }
    } catch (_) { /* ignore event fetch errors */ }

    // Artifacts on terminal
    let artifacts: any[] = Array.isArray((row as any).artifacts) ? (row as any).artifacts : [];
    if (isTerminal && artifacts.length === 0) {
      try {
        const artResp = await fetch(`${FORGE_BASE}/v1/test-runs/${(row as any).forge_run_id}/artifacts`, {
          headers: { authorization: `Bearer ${apiKey}` },
        });
        if (artResp.ok) {
          const arr = await artResp.json().catch(() => []);
          if (Array.isArray(arr)) artifacts = arr;
          else if (arr?.files) artifacts = arr.files;
        }
      } catch (_) { /* ignore */ }
    }

    const now = new Date().toISOString();
    const patch: any = {
      status: newStatus,
      total_tests: total || (row as any).total_tests,
      passed_tests: passed || (row as any).passed_tests,
      failed_tests: failed || (row as any).failed_tests,
      running_tests: running || 0,
      progress_message: s?.message || s?.progressMessage || (row as any).progress_message,
      exit_code: typeof s?.exitCode === "number" ? s.exitCode : (row as any).exit_code,
      events: merged,
      artifacts,
      result: s,
      last_polled_at: now,
    };
    if (isTerminal && !(row as any).finished_at) patch.finished_at = now;

    await admin.from("plan_test_runs").update(patch).eq("id", plan_test_run_id);

    return j({ status: newStatus, isTerminal, counts: { total, passed, failed, running }, events: merged.length });
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

function parseEvents(text: string): any[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) { try { const a = JSON.parse(trimmed); return Array.isArray(a) ? a : []; } catch { return []; } }
  // NDJSON or SSE `data:` frames
  const out: any[] = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const l = line.trim();
    if (!l || l.startsWith(":") || l.startsWith("event:") || l.startsWith("id:")) continue;
    const payload = l.startsWith("data:") ? l.slice(5).trim() : l;
    if (!payload || payload === "[DONE]") continue;
    try { out.push(JSON.parse(payload)); } catch { /* skip */ }
  }
  return out;
}

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
