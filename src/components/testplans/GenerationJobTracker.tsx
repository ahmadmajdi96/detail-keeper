import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

// Global background-job tracker. Two responsibilities:
//   1. Never lose a created job: on every tick we ADOPT any test plan the
//      user can see whose ai_status is 'running' with an ai_job_ref, even
//      if no localStorage entry exists (e.g. job was started on another
//      device or a previous session).
//   2. Drive live progress: we call `tp-forge-check` for each active plan
//      which polls Forge, writes progress into `test_plans.ai_progress`,
//      and (on completion) persists cases and flips status. The detail
//      page subscribes to that row for a live progress bar.

const BUSY_PREFIX = "wb-busy-";
const MAX_AGE_MS = 60 * 60 * 1000;  // stop tracking after 60 min
const STALE_MS   = 35 * 60 * 1000;  // treat 'running' longer than 35 min as stalled
const POLL_MS    = 6000;
// Ignore terminal statuses observed before the server actually recorded a new
// run for this click — prevents a stale "ready" from a previous generation
// firing a fake success toast the moment the user clicks Generate.
const CLICK_SKEW_MS = 15_000;

type BusyEntry = { kind: string; startedAt: number; adopted?: boolean };

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

function writeBusy(planId: string, entry: BusyEntry) {
  try { localStorage.setItem(BUSY_PREFIX + planId, JSON.stringify(entry)); } catch { /* ignore */ }
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
      // (1) Adopt any orphan running jobs the user can see. RLS scopes this
      // to plans the current session has access to.
      let orphanIds: string[] = [];
      try {
        const { data: running } = await supabase
          .from("test_plans")
          .select("id, ai_job_ref, ai_last_run_at")
          .eq("ai_status", "running")
          .not("ai_job_ref", "is", null)
          .limit(50);
        for (const row of running ?? []) {
          const key = BUSY_PREFIX + row.id;
          if (!localStorage.getItem(key)) {
            const startedAt = row.ai_last_run_at
              ? new Date(row.ai_last_run_at as any).getTime()
              : Date.now() - 60_000;
            writeBusy(row.id, { kind: "cases", startedAt, adopted: true });
            orphanIds.push(row.id);
          }
        }
      } catch { /* offline / rls — skip */ }

      const active = readAllBusy();
      const ids = Object.keys(active);
      if (ids.length === 0) return;

      // (2) Ask the server to poll Forge for each plan currently generating
      // cases. This advances the job to 'ready'/'failed' and writes progress.
      await Promise.all(ids.map(async (id) => {
        if (active[id]?.kind !== "cases") return;
        try { await supabase.functions.invoke("tp-forge-check", { body: { test_plan_id: id } }); }
        catch { /* ignore, next tick retries */ }
      }));

      const { data, error } = await supabase
        .from("test_plans")
        .select("id, name, ai_status, ai_last_run_at, ai_progress, ai_progress_message")
        .in("id", ids);
      if (error || !data) return;

      for (const row of data) {
        const status = String(row.ai_status || "").toLowerCase();
        const prev = seen.current[row.id];
        const busy = active[row.id];
        const kindLabel = LABELS[busy?.kind] || "generation";
        const age = busy ? Date.now() - busy.startedAt : 0;

        // Keep the row fresh in react-query so any open panel reflects
        // ai_progress / ai_progress_message immediately.
        qc.setQueryData(["test-plan", row.id], (old: any) => old ? { ...old, ...row } : old);

        const lastRunAt = row.ai_last_run_at ? new Date(row.ai_last_run_at as any).getTime() : 0;
        // For adopted jobs we haven't clicked in this session, always trust the
        // terminal state. Otherwise require the server to have recorded a run
        // at/after our click (minus small clock skew).
        const runIsCurrent = busy?.adopted
          ? true
          : (busy ? lastRunAt >= busy.startedAt - CLICK_SKEW_MS : true);
        const isTerminal = (status === "ready" || status === "failed") && runIsCurrent;
        const isStale = status === "running" && age > STALE_MS;

        seen.current[row.id] = status;

        if (isTerminal) {
          localStorage.removeItem(BUSY_PREFIX + row.id);
          qc.invalidateQueries({ queryKey: ["tp-cases", row.id] });
          qc.invalidateQueries({ queryKey: ["tp-wb-cases", row.id] });
          qc.invalidateQueries({ queryKey: ["test-plan-cases", row.id] });
          qc.invalidateQueries({ queryKey: ["test-plan", row.id] });
          if (prev !== status) {
            if (status === "ready") {
              toast.success(`Generated ${kindLabel} for “${row.name}”`, {
                action: { label: "Open", onClick: () => navigate(`/test-plans/${row.id}`) },
              });
            } else {
              toast.error(`Generation failed for “${row.name}”`, {
                description: (row as any).ai_progress_message || undefined,
                action: { label: "Open", onClick: () => navigate(`/test-plans/${row.id}`) },
              });
            }
          }
          continue;
        }

        if (isStale) {
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

      // Surface adoption once so the user knows we picked things back up.
      for (const id of orphanIds) {
        const row = data.find((r) => r.id === id);
        if (!row) continue;
        toast.info(`Resuming generation for “${row.name}”`, {
          description: (row as any).ai_progress_message || "Live progress restored.",
          action: { label: "Open", onClick: () => navigate(`/test-plans/${row.id}`) },
        });
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
