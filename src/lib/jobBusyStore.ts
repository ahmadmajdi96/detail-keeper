// Shared, storage-backed state for background generation jobs.
// Extracted so both the global tracker and the visible tracker panel read the
// exact same source of truth — and so it can be unit-tested (jobs must survive
// navigating away and coming back).

export const BUSY_PREFIX = "wb-busy-";
export const STAGE_PREFIX = "wb-stages-";
export const MAX_AGE_MS = 6 * 60 * 60 * 1000;

export type BusyKind = "docs" | "cases" | "code" | "suite";
export type BusyEntry = { kind: BusyKind; startedAt: number; adopted?: boolean };

export function readBusy(planId: string): BusyEntry | null {
  try {
    const raw = localStorage.getItem(BUSY_PREFIX + planId);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.kind || !parsed?.startedAt) return null;
    if (Date.now() - parsed.startedAt > MAX_AGE_MS) {
      localStorage.removeItem(BUSY_PREFIX + planId);
      return null;
    }
    return parsed as BusyEntry;
  } catch {
    return null;
  }
}

export function readAllBusy(): Record<string, BusyEntry> {
  const out: Record<string, BusyEntry> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(BUSY_PREFIX)) continue;
      const id = k.slice(BUSY_PREFIX.length);
      const entry = readBusy(id);
      if (entry) out[id] = entry;
    }
  } catch {
    /* ssr / disabled storage */
  }
  return out;
}

export function writeBusy(planId: string, entry: BusyEntry) {
  try {
    localStorage.setItem(BUSY_PREFIX + planId, JSON.stringify(entry));
  } catch {
    /* ignore */
  }
}

export function clearBusy(planId: string) {
  try {
    localStorage.removeItem(BUSY_PREFIX + planId);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Stage / sub-step log                                                */
/* ------------------------------------------------------------------ */

export type StageId =
  | "submit"
  | "docs"
  | "cases"
  | "codegen"
  | "persist"
  | "done"
  | "failed";

export type StageEvent = {
  stage: StageId;
  message: string;
  at: number;
  progress?: number | null;
};

export const STAGE_LABELS: Record<StageId, string> = {
  submit: "Job submitted",
  docs: "Document extraction",
  cases: "Test-case generation",
  codegen: "Playwright code generation",
  persist: "Artifact persistence",
  done: "Completed",
  failed: "Failed",
};

/** Best-effort mapping of a server progress message onto a pipeline stage. */
export function stageFromMessage(kind: BusyKind, message: string, status?: string): StageId {
  const m = (message || "").toLowerCase();
  if (status === "ready") return "done";
  if (status === "failed") return "failed";
  if (/extract|document|parsing|analy/.test(m)) return "docs";
  if (/persist|saving|stored|import|writing/.test(m)) return "persist";
  if (/codegen|playwright|spec/.test(m)) return "codegen";
  if (/case|generat/.test(m)) return kind === "code" ? "codegen" : "cases";
  if (/queued|submitt|dispatch/.test(m)) return "submit";
  return kind === "code" ? "codegen" : "cases";
}

export function readStages(planId: string): StageEvent[] {
  try {
    const raw = localStorage.getItem(STAGE_PREFIX + planId);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Appends a stage event, de-duplicating identical consecutive messages. */
export function appendStage(planId: string, ev: Omit<StageEvent, "at"> & { at?: number }) {
  try {
    const list = readStages(planId);
    const last = list[list.length - 1];
    if (last && last.stage === ev.stage && last.message === ev.message) return list;
    const next = [...list, { ...ev, at: ev.at ?? Date.now() }].slice(-60);
    localStorage.setItem(STAGE_PREFIX + planId, JSON.stringify(next));
    return next;
  } catch {
    return readStages(planId);
  }
}

export function clearStages(planId: string) {
  try {
    localStorage.removeItem(STAGE_PREFIX + planId);
  } catch {
    /* ignore */
  }
}
