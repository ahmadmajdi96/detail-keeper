import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Rocket, StopCircle, Radio, X, Download, Monitor, TerminalSquare, Maximize2 } from "lucide-react";
import { toast } from "sonner";

interface Props { planRunId: string; onClose?: () => void; compact?: boolean }

const ACTIVE = new Set(["queued", "running"]);


export function ForgeRunProgress({ planRunId, onClose, compact }: Props) {
  const qc = useQueryClient();
  const [cancelling, setCancelling] = useState(false);

  const { data: run } = useQuery<any>({
    queryKey: ["plan-test-run", planRunId],
    queryFn: async () => {
      const { data } = await supabase.from("plan_test_runs" as any).select("*").eq("id", planRunId).maybeSingle();
      return data;
    },
    refetchInterval: (q) => ACTIVE.has((q.state.data as any)?.status) ? 2000 : false,
  });

  // Poll Forge for live updates while running.
  useEffect(() => {
    if (!run || !ACTIVE.has(run.status)) return;
    let stop = false;
    const tick = async () => {
      if (stop) return;
      try {
        await supabase.functions.invoke("tp-forge-run-check", { body: { plan_test_run_id: planRunId } });
        qc.invalidateQueries({ queryKey: ["plan-test-run", planRunId] });
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => { stop = true; clearInterval(id); };
  }, [run?.status, planRunId, qc]);

  // Realtime updates on the row itself.
  useEffect(() => {
    const ch = supabase.channel(`plan-run-${planRunId}-${Math.random().toString(36).slice(2, 6)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_test_runs", filter: `id=eq.${planRunId}` },
        () => qc.invalidateQueries({ queryKey: ["plan-test-run", planRunId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [planRunId, qc]);

  const cancelRun = async () => {
    setCancelling(true);
    try {
      const { error } = await supabase.functions.invoke("tp-forge-run-cancel", { body: { plan_test_run_id: planRunId } });
      if (error) throw error;
      toast.success("Cancellation requested");
      qc.invalidateQueries({ queryKey: ["plan-test-run", planRunId] });
    } catch (e: any) {
      toast.error(e.message || "Cancel failed");
    } finally { setCancelling(false); }
  };

  const [downloading, setDownloading] = useState(false);
  const downloadArtifacts = async () => {
    setDownloading(true);
    const t = toast.loading("Fetching execution artifacts…");
    try {
      const { data, error } = await supabase.functions.invoke("tp-rr-download", {
        body: { plan_test_run_id: planRunId },
      });
      if (error) throw error;
      const blob = data instanceof Blob ? data : new Blob([data as any], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `playwright-execution-artifacts.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Artifacts downloaded", { id: t });
    } catch (e: any) {
      toast.error(e.message || "Download failed", { id: t });
    } finally { setDownloading(false); }
  };


  const pct = useMemo(() => {
    if (!run) return 0;
    const total = run.total_tests || 0;
    const done = (run.passed_tests || 0) + (run.failed_tests || 0);
    return total > 0 ? Math.round((done / total) * 100) : (ACTIVE.has(run.status) ? 5 : 100);
  }, [run]);

  const logRef = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [run?.log_tail]);

  if (!run) return null;
  const isActive = ACTIVE.has(run.status);
  const events: any[] = Array.isArray(run.events) ? run.events.slice(-30) : [];


  const statusCls =
    run.status === "cancelled" ? "text-muted-foreground border-muted-foreground/40" :
    run.status === "failed" ? "text-red-300 border-red-500/40" :
    run.status === "passed" ? "text-emerald-300 border-emerald-500/40" :
    "text-cyan-300 border-cyan-500/40";

  const liveReady = !!run.live_view_url && (run.live_view_status ?? "ready") === "ready" && isActive;

  return (
    <div className={`border-t border-border/50 ${compact ? "" : "bg-muted/10"} p-3 space-y-2`}>
      <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
        <div className="flex items-center gap-2 font-medium">
          {isActive
            ? <Radio className="h-3.5 w-3.5 text-red-400 animate-pulse" />
            : <Rocket className="h-3.5 w-3.5 text-accent" />}
          Live Playwright execution · <span className="font-mono opacity-70">{run.base_url}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className={statusCls}>{run.status}</Badge>
          {run.execution_phase && (
            <Badge variant="outline" className="text-violet-300 border-violet-500/30">{run.execution_phase}</Badge>
          )}
          <Badge variant="outline" className="text-emerald-300 border-emerald-500/30">✓ {run.passed_tests ?? 0}</Badge>
          {(run.failed_tests ?? 0) > 0 && <Badge variant="outline" className="text-red-300 border-red-500/30">✗ {run.failed_tests}</Badge>}
          {run.total_tests > 0 && <span className="text-muted-foreground">{(run.passed_tests || 0) + (run.failed_tests || 0)}/{run.total_tests}</span>}
          {!isActive && (
            <Button size="sm" variant="ghost" className="h-6 px-2" disabled={downloading} onClick={downloadArtifacts}>
              {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
              Artifacts
            </Button>
          )}
          {isActive && (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-red-300 hover:text-red-200 hover:bg-red-500/10"
              disabled={cancelling} onClick={cancelRun}>
              {cancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <StopCircle className="h-3 w-3 mr-1" />}
              Stop
            </Button>
          )}
          {onClose && <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClose}><X className="h-3 w-3" /></Button>}
        </div>
      </div>
      <Progress value={pct} className={`h-1.5 ${run.status === "cancelled" ? "opacity-60" : ""}`} />
      {run.progress_message && <p className="text-[11px] text-muted-foreground">{run.progress_message}</p>}

      {/* Remote browser live view */}
      <div className="rounded border border-border/40 bg-background/40 overflow-hidden">
        <div className="px-2 py-1 text-[11px] font-semibold border-b border-border/40 flex items-center gap-1">
          <Monitor className="h-3 w-3 text-cyan-400" /> Live browser
          {liveReady && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />}
          {liveReady && (
            <a href={run.live_view_url} target="_blank" rel="noreferrer"
              className="ml-auto inline-flex items-center gap-1 text-accent hover:underline">
              <Maximize2 className="h-3 w-3" /> open in new tab
            </a>
          )}
        </div>
        {liveReady ? (
          <iframe
            src={run.live_view_url}
            title="Live Playwright execution"
            className="w-full border-0 bg-black"
            style={{ height: compact ? 420 : 640 }}
            allow="clipboard-read; clipboard-write"
          />
        ) : (
          <p className="p-3 text-[11px] text-muted-foreground">
            {isActive
              ? "Waiting for the remote browser to start — the live view appears as soon as Repo Reader reports it ready."
              : "The live view is only available while the execution is running."}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div className="rounded border border-border/40 bg-background/40">
          <div className="px-2 py-1 text-[11px] font-semibold border-b border-border/40 flex items-center gap-1">
            <TerminalSquare className="h-3 w-3 text-emerald-400" /> Terminal logs
          </div>
          <pre ref={logRef}
            className="max-h-[260px] overflow-auto p-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {run.log_tail || (isActive ? "Waiting for runner output…" : "No logs captured.")}
          </pre>
        </div>
        <div className="rounded border border-border/40 bg-background/40">
          <div className="px-2 py-1 text-[11px] font-semibold border-b border-border/40 flex items-center gap-1">
            <Radio className="h-3 w-3 text-red-400" /> Execution events
          </div>
          <div className="max-h-[260px] overflow-auto p-2 space-y-1 font-mono text-[10px]">
            {events.length === 0 && <p className="text-muted-foreground">Waiting for execution events…</p>}
            {events.map((e, i) => (
              <EventLine key={i} e={e} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

}

function EventLine({ e }: { e: any }) {
  const t = e?.type || e?.event || "event";
  const ts = e?.ts || e?.time || e?.timestamp;
  const name = e?.testName || e?.title || e?.file || e?.testId || "";
  const status = e?.status || e?.result || "";
  const color =
    t.includes("finished") && status === "failed" ? "text-red-300" :
    t.includes("finished") && (status === "passed" || status === "ok") ? "text-emerald-300" :
    t.includes("started") ? "text-cyan-300" :
    t.includes("terminal") ? "text-violet-300" :
    "text-muted-foreground";
  return (
    <div className={`flex items-center gap-1.5 ${color}`}>
      {ts && <span className="opacity-50 shrink-0">{String(ts).slice(11, 19)}</span>}
      <span className="shrink-0">{t}</span>
      {name && <span className="truncate">· {name}</span>}
      {status && <span className="ml-auto opacity-80 shrink-0">{status}</span>}
      {t.includes("finished") && (status === "passed" || status === "ok") && <CheckCircle2 className="h-3 w-3 shrink-0" />}
      {t.includes("finished") && status === "failed" && <XCircle className="h-3 w-3 shrink-0" />}
    </div>
  );
}
