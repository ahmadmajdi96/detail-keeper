import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  BUSY_PREFIX, appendStage, clearBusy, readAllBusy, stageFromMessage, writeBusy,
} from "@/lib/jobBusyStore";
import { JobTrackerPanel, TrackedJob } from "./JobTrackerPanel";

// Global background-job tracker. Three responsibilities:
//   1. Never lose a created job: on every tick we ADOPT any test plan the
//      user can see whose ai_status OR codegen_status is 'running',
//      even if no localStorage entry exists (e.g. job started on another
//      device / previous session).
//   2. Drive live progress: call `tp-forge-check` for cases and
//      `tp-forge-codegen-check` for Playwright code.
//   3. Record every stage transition with a timestamp and render the
//      always-visible <JobTrackerPanel /> so progress survives navigation.

const MAX_AGE_MS = 6 * 60 * 60 * 1000;
const STALE_MS   = 45 * 60 * 1000;
const POLL_MS    = 6000;
const CLICK_SKEW_MS = 15_000;

const LABELS: Record<string, string> = {
  docs: "documents",
  cases: "test cases",
  code: "Playwright code",
  suite: "suite run",
};

// Unified key so the tracker can operate on both ai_* and codegen_* columns
// through the same code path.
type JobKind = "cases" | "code" | "docs";
const JOB_COLS: Record<JobKind, {
  status: string; jobRef: string; lastRun: string; progress: string;
  progressMsg: string; progressAt: string; checkFn: string;
  casesInvalidateKeys?: string[]; specsInvalidateKey?: string;
  docsInvalidateKey?: string;
}> = {
  docs: {
    status: "docs_status", jobRef: "docs_job_ref",
    lastRun: "docs_last_run_at", progress: "docs_progress",
    progressMsg: "docs_progress_message", progressAt: "docs_progress_updated_at",
    checkFn: "tp-sqa-check",
    docsInvalidateKey: "tp-docs",
  },
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
  const [jobs, setJobs] = useState<TrackedJob[]>([]);

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
          appendStage(row.id, { stage: "submit", message: "Resumed tracking of a running job" });
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
      const orphanDocs = await adoptOrphans("docs");

      const active = readAllBusy();
      const ids = Object.keys(active);
      if (ids.length === 0) { setJobs([]); return; }

      // Ask the appropriate server function for each active plan.
      await Promise.all(ids.map(async (id) => {
        const kind = active[id]?.kind;
        if (kind !== "cases" && kind !== "code" && kind !== "docs") return;
        const fn = JOB_COLS[kind].checkFn;
        try { await supabase.functions.invoke(fn, { body: { test_plan_id: id } }); }
        catch { /* next tick retries */ }
      }));

      const { data, error } = await (supabase.from("test_plans") as any)
        .select("id, name, plan_uid, docs_status, docs_job_ref, docs_last_run_at, docs_progress, docs_progress_message, docs_progress_updated_at, ai_status, ai_last_run_at, ai_progress, ai_progress_message, ai_progress_updated_at, ai_dry_run, codegen_status, codegen_last_run_at, codegen_progress, codegen_progress_message, codegen_progress_updated_at, codegen_dry_run")
        .in("id", ids);
      if (error || !data) return;

      // Merge server-recorded stage logs (incl. explicit dry-run skip records)
      // into the local timeline so they survive navigation and reloads.
      try {
        const { data: logs } = await (supabase.from("generation_stage_logs") as any)
          .select("test_plan_id, kind, stage, message, dry_run, created_at")
          .in("test_plan_id", ids)
          .order("created_at", { ascending: true })
          .limit(200);
        for (const l of ((logs ?? []) as any[])) {
          appendStage(l.test_plan_id, {
            stage: l.stage as any,
            message: l.message,
            at: new Date(l.created_at).getTime(),
          });
        }
      } catch { /* rls / offline */ }


      const nextJobs: TrackedJob[] = [];

      for (const row of data as any[]) {
        const busy = active[row.id];
        const kind = busy?.kind;
        if (kind !== "cases" && kind !== "code" && kind !== "docs") continue;
        const cols = JOB_COLS[kind];
        const kindLabel = LABELS[kind] || "generation";

        // Keep react-query row fresh regardless of kind.
        qc.setQueryData(["test-plan", row.id], (old: any) => old ? { ...old, ...row } : old);

        const status = String(row[cols.status] || "").toLowerCase();
        const message = row[cols.progressMsg] as string | null;
        const progress = typeof row[cols.progress] === "number" ? row[cols.progress] : null;
        const seenKey = `${kind}:${row.id}`;
        const prev = seen.current[seenKey];
        const age = Date.now() - busy.startedAt;

        // Record a timestamped sub-step whenever the server message changes.
        if (message) {
          appendStage(row.id, {
            stage: stageFromMessage(kind, message, status),
            message,
            progress,
            at: row[cols.progressAt] ? new Date(row[cols.progressAt]).getTime() : Date.now(),
          });
        }

        nextJobs.push({
          planId: row.id,
          planName: row.name,
          kind,
          status,
          progress,
          message,
          startedAt: busy.startedAt,
          dryRun: kind === "docs" ? false : kind === "code" ? row.codegen_dry_run !== false : row.ai_dry_run !== false,
        });

        const lastRunAt = row[cols.lastRun] ? new Date(row[cols.lastRun]).getTime() : 0;
        const runIsCurrent = busy.adopted ? true : lastRunAt >= busy.startedAt - CLICK_SKEW_MS;
        const isTerminal = (status === "ready" || status === "failed") && runIsCurrent;
        const progressUpdatedAt = row[cols.progressAt] ? new Date(row[cols.progressAt]).getTime() : 0;
        const heartbeatAt = Math.max(progressUpdatedAt, runIsCurrent ? lastRunAt : 0, busy.startedAt);
        const heartbeatAge = heartbeatAt ? Date.now() - heartbeatAt : age;
        const isStale = status === "running" && age > STALE_MS && heartbeatAge > STALE_MS;

        seen.current[seenKey] = status;

        if (isTerminal) {
          appendStage(row.id, {
            stage: status === "ready" ? "done" : "failed",
            message: status === "ready"
              ? `Artifacts persisted — ${kindLabel} ready`
              : (message || `${kindLabel} generation failed`),
          });
          clearBusy(row.id);
          stalled.current.delete(row.id);
          if (cols.casesInvalidateKeys) {
            for (const k of cols.casesInvalidateKeys) qc.invalidateQueries({ queryKey: [k, row.id] });
          }
          if (cols.specsInvalidateKey) qc.invalidateQueries({ queryKey: [cols.specsInvalidateKey, row.id] });
          if (cols.docsInvalidateKey) qc.invalidateQueries({ queryKey: [cols.docsInvalidateKey, row.id] });
          qc.invalidateQueries({ queryKey: ["test-plan", row.id] });
          if (prev !== status) {
            if (status === "ready") {
              toast.success(`Generated ${kindLabel} for “${row.name}”`, {
                description: message || undefined,
                action: { label: "Open", onClick: () => navigate(`/test-plans/${row.id}`) },
              });
            } else {
              toast.error(`${kindLabel} generation failed for “${row.name}”`, {
                description: message || undefined,
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

      setJobs(nextJobs);

      for (const id of [...orphanCase, ...orphanCode, ...orphanDocs]) {
        const row = (data as any[]).find((r) => r.id === id);
        if (!row) continue;
        const k = active[id]?.kind;
        const kind = k === "code" ? "Playwright code" : k === "docs" ? "QA documents" : "test cases";
        toast.info(`Resuming ${kind} generation for “${row.name}”`, {
          description: "Live progress restored.",
          action: { label: "Open", onClick: () => navigate(`/test-plans/${row.id}`) },
        });
      }
    }

    // Seed the panel synchronously from storage so a remount (navigate away →
    // come back) shows the job immediately, before the first network tick.
    const seeded = readAllBusy();
    setJobs(Object.entries(seeded)
      .filter(([, e]) => e.kind === "cases" || e.kind === "code" || e.kind === "docs")
      .map(([planId, e]) => ({
        planId, planName: "Test plan", kind: e.kind as JobKind,
        status: "running", progress: null, message: null, startedAt: e.startedAt,
      })));

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

  return <JobTrackerPanel jobs={jobs} />;
}
