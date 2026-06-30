import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CheckCircle2, XCircle, Clock, Loader2, Activity, Terminal,
  Monitor, Maximize2, Minimize2, Radio,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Props { specId: string }

const STATUS_META: Record<string, { icon: any; cls: string }> = {
  queued: { icon: Clock, cls: "text-muted-foreground" },
  dispatched: { icon: Loader2, cls: "text-cyan-400 animate-spin" },
  running: { icon: Loader2, cls: "text-cyan-400 animate-spin" },
  succeeded: { icon: CheckCircle2, cls: "text-emerald-400" },
  failed: { icon: XCircle, cls: "text-red-400" },
  timeout: { icon: XCircle, cls: "text-amber-400" },
  cancelled: { icon: XCircle, cls: "text-muted-foreground" },
};

function extractLive(run: any): { liveUrl?: string; frame?: string; frames?: any[] } {
  const r = run?.result_json || {};
  return {
    liveUrl: r.live_url || r.liveUrl || r.cdp_url,
    frame: r.frame || r.last_frame || r.screenshot,
    frames: Array.isArray(r.frames) ? r.frames : undefined,
  };
}

export function SpecRunPanel({ specId }: Props) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const terminalRef = useRef<HTMLPreElement>(null);

  const { data: runs = [] } = useQuery<any[]>({
    queryKey: ["spec-runs", specId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spec_runs" as any)
        .select("*").eq("spec_id", specId)
        .order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: (q) => {
      const latest = (q.state.data as any[])?.[0];
      return latest && ["queued", "dispatched", "running"].includes(latest.status) ? 2000 : false;
    },
  });

  useEffect(() => {
    if (!specId) return;
    const tag = `${specId}-${Math.random().toString(36).slice(2, 8)}`;
    const ch = supabase
      .channel(`spec-runs-${tag}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "spec_runs", filter: `spec_id=eq.${specId}` },
        () => qc.invalidateQueries({ queryKey: ["spec-runs", specId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [specId, qc]);

  const latest = runs[0];
  const isLive = latest && ["queued", "dispatched", "running"].includes(latest.status);
  const live = latest ? extractLive(latest) : {};
  const lastFrame = live.frame || (live.frames && live.frames[live.frames.length - 1]?.image);

  // Auto-scroll terminal as logs stream
  useEffect(() => {
    if (terminalRef.current && isLive) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [latest?.stdout, latest?.stderr, isLive]);

  const LiveView = ({ inDialog = false }: { inDialog?: boolean }) => (
    <div className={`bg-black rounded border border-border/50 overflow-hidden ${inDialog ? "h-[60vh]" : "h-48"}`}>
      {live.liveUrl ? (
        <iframe src={live.liveUrl} className="w-full h-full" title="Live browser" sandbox="allow-scripts allow-same-origin" />
      ) : lastFrame ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={lastFrame} alt="Live frame" className="w-full h-full object-contain" />
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-xs text-muted-foreground gap-2">
          <Monitor className="h-8 w-8 opacity-40" />
          {isLive
            ? <span className="flex items-center gap-1"><Radio className="h-3 w-3 text-red-400 animate-pulse" /> waiting for runner stream…</span>
            : <span>No live view available for this run</span>}
          <span className="text-[10px] opacity-60">Runner can publish <code>result_json.live_url</code> or <code>result_json.frame</code></span>
        </div>
      )}
    </div>
  );

  const Terminal_ = ({ run, max }: { run: any; max: string }) => (
    <pre
      ref={terminalRef}
      className={`text-[11px] bg-[#0a0a0a] text-emerald-200/90 font-mono border border-border/50 rounded p-2 overflow-auto whitespace-pre-wrap leading-relaxed ${max}`}
    >
{run.stdout || (isLive ? "▌ awaiting runner output…" : "(no stdout)")}
{run.stderr ? `\n\x1b[31m--- stderr ---\n${run.stderr}\x1b[0m` : ""}
    </pre>
  );

  return (
    <>
      <div className="border-t border-border/50 bg-muted/20 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <Activity className="h-3.5 w-3.5 text-accent" /> Execution Results
            {isLive && <Badge variant="outline" className="border-red-500/40 text-red-300 gap-1"><Radio className="h-2.5 w-2.5 animate-pulse" /> LIVE</Badge>}
          </div>
          <div className="flex items-center gap-2">
            {latest && (
              <Badge variant="outline">
                Latest: {latest.status} {latest.finished_at && `· ${formatDistanceToNow(new Date(latest.finished_at), { addSuffix: true })}`}
              </Badge>
            )}
            {latest && (
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setExpanded(true)}>
                <Maximize2 className="h-3.5 w-3.5 mr-1" /> Expand
              </Button>
            )}
          </div>
        </div>

        {latest && (
          <div className="grid grid-cols-2 gap-3 p-3 border-b border-border/30">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                <Monitor className="h-3 w-3" /> Live Browser View
              </div>
              <LiveView />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                <Terminal className="h-3 w-3" /> Terminal
              </div>
              <Terminal_ run={latest} max="h-48" />
            </div>
          </div>
        )}

        <ScrollArea className="max-h-[200px]">
          {runs.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground">No runs yet — click <em>Run</em> to dispatch this spec to a registered runner.</div>
          ) : (
            <div className="divide-y divide-border/30">
              {runs.map(r => {
                const meta = STATUS_META[r.status] || STATUS_META.queued;
                const Icon = meta.icon;
                const summary = r.result_json?.summary || r.result_json;
                return (
                  <div key={r.id} className="p-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <Icon className={`h-3.5 w-3.5 ${meta.cls}`} />
                      <span className="font-medium">{r.status}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                      {summary?.passed !== undefined && (
                        <Badge variant="outline" className="ml-2 text-emerald-300 border-emerald-500/30">✓ {summary.passed} passed</Badge>
                      )}
                      {summary?.failed > 0 && (
                        <Badge variant="outline" className="text-red-300 border-red-500/30">✗ {summary.failed} failed</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-accent" />
              Live Run {latest && <Badge variant="outline">{latest.status}</Badge>}
              {isLive && <Badge variant="outline" className="border-red-500/40 text-red-300 gap-1"><Radio className="h-2.5 w-2.5 animate-pulse" /> streaming</Badge>}
            </DialogTitle>
          </DialogHeader>
          {latest && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-medium mb-2 flex items-center gap-1"><Monitor className="h-3 w-3" /> Chromium view</div>
                <LiveView inDialog />
              </div>
              <div>
                <div className="text-xs font-medium mb-2 flex items-center gap-1"><Terminal className="h-3 w-3" /> Terminal logs</div>
                <Terminal_ run={latest} max="h-[60vh]" />
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => setExpanded(false)}>
              <Minimize2 className="h-3.5 w-3.5 mr-1" /> Collapse
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
