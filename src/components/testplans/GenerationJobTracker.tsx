import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

// Polls every active generation job (recorded by TestPlanWorkbench in
// localStorage under `wb-busy-<testPlanId>`) so the user can navigate freely
// while server-side generation runs. Shows a toast when a job finishes.

const BUSY_PREFIX = "wb-busy-";
const MAX_AGE_MS = 60 * 60 * 1000; // stop tracking after 60 min
const STALE_MS = 35 * 60 * 1000;   // treat 'running' longer than 35 min as stalled
const POLL_MS = 6000;
// Ignore terminal statuses observed before the server actually recorded a new
// run for this click — prevents a stale "ready" from a previous generation
// firing a fake success toast the moment the user clicks Generate.
const CLICK_SKEW_MS = 15_000;



type BusyEntry = { kind: string; startedAt: number };

function readAllBusy(): Record<string, BusyEntry> {
  const out: Record<string, BusyEntry> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(BUSY_PREFIX)) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(k) || "");
        if (!parsed?.kind || !parsed?.startedAt) continue;
        if (Date.now() - parsed.startedAt > MAX_AGE_MS) {
          localStorage.removeItem(k);
          continue;
        }
        out[k.slice(BUSY_PREFIX.length)] = parsed;
      } catch { /* skip */ }
    }
  } catch { /* ssr */ }
  return out;
}

const LABELS: Record<string, string> = {
  docs: "documents",
  cases: "test cases",
  code: "Playwright code",
  suite: "suite run",
};

export function GenerationJobTracker() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const seen = useRef<Record<string, string>>({}); // planId -> last known status

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      const active = readAllBusy();
      const ids = Object.keys(active);
      if (ids.length === 0) return;

      const { data, error } = await supabase
        .from("test_plans")
        .select("id, name, ai_status, ai_last_run_at")
        .in("id", ids);
      if (error || !data) return;

      for (const row of data) {
        const status = String(row.ai_status || "").toLowerCase();
        const prev = seen.current[row.id];
        const busy = active[row.id];
        const kindLabel = LABELS[busy?.kind] || "generation";
        const age = busy ? Date.now() - busy.startedAt : 0;

        const lastRunAt = row.ai_last_run_at ? new Date(row.ai_last_run_at as any).getTime() : 0;
        // Only trust a terminal state if the server has recorded a run that
        // started at/after this click (minus small clock skew). Otherwise the
        // status still reflects the previous generation.
        const runIsCurrent = busy ? lastRunAt >= busy.startedAt - CLICK_SKEW_MS : true;
        const isTerminal = (status === "ready" || status === "failed") && runIsCurrent;
        const isStale = status === "running" && age > STALE_MS;

        // Record status for next tick.
        seen.current[row.id] = status;

        if (isTerminal) {
          // Fire once per plan when we observe a terminal state while a
          // busy lock exists — even if this is the first tick after reload
          // (prev === undefined). Prevents "job silently disappeared".
          localStorage.removeItem(BUSY_PREFIX + row.id);
          qc.invalidateQueries({ queryKey: ["tp-cases", row.id] });
          qc.invalidateQueries({ queryKey: ["test-plan", row.id] });
          if (prev !== status) {
            if (status === "ready") {
              toast.success(`Generated ${kindLabel} for “${row.name}”`, {
                action: { label: "Open", onClick: () => navigate(`/test-plans/${row.id}`) },
              });
            } else {
              toast.error(`Generation failed for “${row.name}”`, {
                action: { label: "Open", onClick: () => navigate(`/test-plans/${row.id}`) },
              });
            }
          }
          continue;
        }

        if (isStale) {
          // Background worker appears to have died — clear the lock so the
          // user can retry, and surface a toast once.
          localStorage.removeItem(BUSY_PREFIX + row.id);
          if (prev !== "__stale__") {
            seen.current[row.id] = "__stale__";
            toast.error(`Generation stalled for “${row.name}”`, {
              description: "The background job didn't finish in time. Please try again.",
              action: { label: "Open", onClick: () => navigate(`/test-plans/${row.id}`) },
            });
          }
        }
      }

    }

    const interval = setInterval(() => { if (!cancelled) void tick(); }, POLL_MS);
    void tick();

    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith(BUSY_PREFIX)) void tick();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("storage", onStorage);
    };
  }, [navigate, qc]);

  return null;
}
