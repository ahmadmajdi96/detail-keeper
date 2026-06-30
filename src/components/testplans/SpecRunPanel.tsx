import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, Clock, Loader2, Activity } from "lucide-react";
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

export function SpecRunPanel({ specId }: Props) {
  const qc = useQueryClient();
  const { data: runs = [] } = useQuery<any[]>({
    queryKey: ["spec-runs", specId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spec_runs" as any)
        .select("*")
        .eq("spec_id", specId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`spec-runs-${specId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "spec_runs", filter: `spec_id=eq.${specId}` },
        () => qc.invalidateQueries({ queryKey: ["spec-runs", specId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [specId, qc]);

  const latest = runs[0];

  return (
    <div className="border-t border-border/50 bg-muted/20 max-h-[260px] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 text-xs">
        <div className="flex items-center gap-2 font-medium">
          <Activity className="h-3.5 w-3.5 text-accent" /> Execution Results
        </div>
        {latest && (
          <Badge variant="outline">
            Latest: {latest.status} {latest.finished_at && `· ${formatDistanceToNow(new Date(latest.finished_at), { addSuffix: true })}`}
          </Badge>
        )}
      </div>
      <ScrollArea className="flex-1">
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
                      <Badge variant="outline" className="ml-2 text-emerald-300 border-emerald-500/30">
                        ✓ {summary.passed} passed
                      </Badge>
                    )}
                    {summary?.failed > 0 && (
                      <Badge variant="outline" className="text-red-300 border-red-500/30">
                        ✗ {summary.failed} failed
                      </Badge>
                    )}
                  </div>
                  {(r.stdout || r.stderr) && (
                    <pre className="text-[11px] bg-background/60 border border-border/50 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">
{r.stdout || ""}{r.stderr ? `\n--- stderr ---\n${r.stderr}` : ""}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
