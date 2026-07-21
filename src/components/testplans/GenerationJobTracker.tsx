import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

// Polls every active generation job (recorded by TestPlanWorkbench in
// localStorage under `wb-busy-<testPlanId>`) so the user can navigate freely
// while server-side generation runs. Shows a toast when a job finishes.

const BUSY_PREFIX = "wb-busy-";
const MAX_AGE_MS = 30 * 60 * 1000; // stop tracking after 30 min
const POLL_MS = 6000;

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
        .select("id, name, ai_status")
        .in("id", ids);
      if (error || !data) return;

      for (const row of data) {
        const status = String(row.ai_status || "").toLowerCase();
        const prev = seen.current[row.id];
        seen.current[row.id] = status;

        const isTerminal = status === "ready" || status === "failed";
        if (!isTerminal) continue;

        // Clear the busy lock and notify once per transition.
        localStorage.removeItem(BUSY_PREFIX + row.id);
        qc.invalidateQueries({ queryKey: ["tp-cases", row.id] });
        qc.invalidateQueries({ queryKey: ["test-plan", row.id] });

        if (prev && prev !== status) {
          const kind = LABELS[active[row.id]?.kind] || "generation";
          if (status === "ready") {
            toast.success(`Generated ${kind} for “${row.name}”`, {
              action: {
                label: "Open",
                onClick: () => navigate(`/test-plans/${row.id}`),
              },
            });
          } else {
            toast.error(`Generation failed for “${row.name}”`, {
              action: {
                label: "Open",
                onClick: () => navigate(`/test-plans/${row.id}`),
              },
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
