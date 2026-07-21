import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

// Global background-job tracker. Two responsibilities:
//   1. Never lose a created job: on every tick we ADOPT any test plan the
//      user can see whose ai_status OR codegen_status is 'running',
//      even if no localStorage entry exists (e.g. job started on another
//      device / previous session).
//   2. Drive live progress: call `tp-forge-check` for cases and
//      `tp-forge-codegen-check` for Playwright code. Both write progress
//      into test_plans (ai_* / codegen_*) which the workbench renders live.

const BUSY_PREFIX = "wb-busy-";
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const STALE_MS   = 45 * 60 * 1000;
const POLL_MS    = 6000;
const CLICK_SKEW_MS = 15_000;

type BusyKind = "docs" | "cases" | "code" | "suite";
type BusyEntry = { kind: BusyKind; startedAt: number; adopted?: boolean };

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

// Unified key so the tracker can operate on both ai_* and codegen_* columns
// through the same code path.
type JobKind = "cases" | "code";
const JOB_COLS: Record<JobKind, {
  status: string; jobRef: string; lastRun: string; progress: string;
  progressMsg: string; progressAt: string; checkFn: string;
  casesInvalidateKeys?: string[]; specsInvalidateKey?: string;
}> = {
  cases: {
    status: "ai_status", jobRef: "ai_job_ref",
    lastRun: "ai_last_run_at", progress: "ai_progress",
    progressMsg: "ai_progress_message", progressAt: "ai_progress_updated_at",
    checkFn: "tp-forge-check",
    casesInvalidateKeys: ["tp-cases", "tp-wb-cases", "test-plan-cases"],
  },
  code: {
    status: "codegen_status", jobRef: "codegen_job_ref",
    lastRun: "codegen_last_run_at", progress: "codegen_progress",
    progressMsg: "codegen_progress_message", progressAt: "codegen_progress_updated_at",
    checkFn: "tp-forge-codegen-check",
    specsInvalidateKey: "tp-specs",
  },
};

export function GenerationJobTracker() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  // seen key = `${kind}:${planId}` — track cases and code independently.
  const seen = useRef<Record<string, string>>({});
  const adopted = useRef<Set<string>>(new Set());
  const stalled = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function adoptOrphans(kind: JobKind): Promise<string[]> {
      const cols = JOB_COLS[kind];
      const orphanIds: string[] = [];
      try {
        const { data: running } = await (supabase
          .from("test_plans") as any)
          .select(`id, name, ${cols.jobRef}, ${cols.lastRun}, ${cols.progressAt}`)
          .eq(cols.status, "running")
          .not(cols.jobRef, "is", null)
          .limit(50);

        for (const row of (running ?? []) as any[]) {
          const key = BUSY_PREFIX + row.id;
          const existing = (() => { try { return JSON.parse(localStorage.getItem(key) || ""); } catch { return null; } })();
          if (existing?.kind === kind) continue; // already tracked for this kind
          if (existing && existing.kind !== kind) continue; // another kind holds the lock; skip
          writeBusy(row.id, { kind, startedAt: Date.now(), adopted: true });
          const adoptKey = `${kind}:${row.id}`;
          if (!adopted.current.has(adoptKey)) {
            adopted.current.add(adoptKey);
            orphanIds.push(row.id);
          }
        }
      } catch { /* offline / rls */ }
      return orphanIds;
    }

    async function tick() {
      const orphanCase = await adoptOrphans("cases");
      const orphanCode = await adoptOrphans("code");

      const active = readAllBusy();
      const ids = Object.keys(active);
      if (ids.length === 0) return;

      // Ask the appropriate server function for each active plan.
      await Promise.all(ids.map(async (id) => {
        const kind = active[id]?.kind;
        if (kind !== "cases" && kind !== "code") return;
        const fn = JOB_COLS[kind].checkFn;
        try { await supabase.functions.invoke(fn, { body: { test_plan_id: id } }); }
        catch { /* next tick retries */ }
      }));

      const { data, error } = await supabase
        .from("test_plans")
        .select("id, name, ai_status, ai_last_run_at, ai_progress, ai_progress_message, ai_progress_updated_at, codegen_status, codegen_last_run_at, codegen_progress, codegen_progress_message, codegen_progress_updated_at")
        .in("id", ids);
      if (error || !data) return;

      for (const row of data as any[]) {
        const busy = active[row.id];
        const kind = busy?.kind;
        if (kind !== "cases" && kind !== "code") continue;
        const cols = JOB_COLS[kind];
        const kindLabel = LABELS[kind] || "generation";

        // Keep react-query row fresh regardless of kind.
        qc.setQueryData(["test-plan", row.id], (old: any) => old ? { ...old, ...row } : old);

        const status = String(row[cols.status] || "").toLowerCase();
        const seenKey = `${kind}:${row.id}`;
        const prev = seen.current[seenKey];
        const age = Date.now() - busy.startedAt;

        const lastRunAt = row[cols.lastRun] ? new Date(row[cols.lastRun]).getTime() : 0;
        const runIsCurrent = busy.adopted ? true : lastRunAt >= busy.startedAt - CLICK_SKEW_MS;
        const isTerminal = (status === "ready" || status === "failed") && runIsCurrent;
        const progressUpdatedAt = row[cols.progressAt] ? new Date(row[cols.progressAt]).getTime() : 0;
        const heartbeatAt = Math.max(progressUpdatedAt, runIsCurrent ? lastRunAt : 0, busy.startedAt);
        const heartbeatAge = heartbeatAt ? Date.now() - heartbeatAt : age;
        const isStale = status === "running" && age > STALE_MS && heartbeatAge > STALE_MS;

        seen.current[seenKey] = status;

        if (isTerminal) {
          localStorage.removeItem(BUSY_PREFIX + row.id);
          stalled.current.delete(row.id);
          if (cols.casesInvalidateKeys) {
            for (const k of cols.casesInvalidateKeys) qc.invalidateQueries({ queryKey: [k, row.id] });
          }
          if (cols.specsInvalidateKey) qc.invalidateQueries({ queryKey: [cols.specsInvalidateKey, row.id] });
          qc.invalidateQueries({ queryKey: ["test-plan", row.id] });
          if (prev !== status) {
            if (status === "ready") {
              toast.success(`Generated ${kindLabel} for “${row.name}”`, {
                description: row[cols.progressMsg] || undefined,
                action: { label: "Open", onClick: () => navigate(`/test-plans/${row.id}`) },
              });
            } else {
              toast.error(`${kindLabel} generation failed for “${row.name}”`, {
                description: row[cols.progressMsg] || undefined,
                action: { label: "Open", onClick: () => navigate(`/test-plans/${row.id}`) },
              });
            }
          }
          continue;
        }

        if (isStale) {
          if (!stalled.current.has(row.id)) {
            stalled.current.add(row.id);
            seen.current[seenKey] = "__stale__";
            toast.warning(`Still tracking ${kindLabel} for “${row.name}”`, {
              description: "No new progress recorded recently. I’ll keep polling.",
              action: { label: "Open", onClick: () => navigate(`/test-plans/${row.id}`) },
            });
          }
        } else {
          stalled.current.delete(row.id);
        }
      }

      for (const id of [...orphanCase, ...orphanCode]) {
        const row = (data as any[]).find((r) => r.id === id);
        if (!row) continue;
        const kind = active[id]?.kind === "code" ? "Playwright code" : "test cases";
        toast.info(`Resuming ${kind} generation for “${row.name}”`, {
          description: "Live progress restored.",
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
