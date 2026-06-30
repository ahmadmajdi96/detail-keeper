import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Clock, Rocket } from "lucide-react";

interface Props { suiteRunId: string }

const META: Record<string, { icon: any; cls: string }> = {
  queued: { icon: Clock, cls: "text-muted-foreground" },
  dispatched: { icon: Loader2, cls: "text-cyan-400 animate-spin" },
  running: { icon: Loader2, cls: "text-cyan-400 animate-spin" },
  succeeded: { icon: CheckCircle2, cls: "text-emerald-400" },
  failed: { icon: XCircle, cls: "text-red-400" },
  timeout: { icon: XCircle, cls: "text-amber-400" },
  cancelled: { icon: XCircle, cls: "text-muted-foreground" },
};

export function SuiteRunProgress({ suiteRunId }: Props) {
  const qc = useQueryClient();

  const { data: suite } = useQuery<any>({
    queryKey: ["suite-run", suiteRunId],
    queryFn: async () => {
      const { data, error } = await supabase.from("suite_runs" as any).select("*").eq("id", suiteRunId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: runs = [] } = useQuery<any[]>({
    queryKey: ["suite-spec-runs", suiteRunId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spec_runs" as any)
        .select("id, status, spec_id, started_at, finished_at, spec:test_plan_specs(filename)")
        .eq("suite_run_id", suiteRunId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`suite-${suiteRunId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "suite_runs", filter: `id=eq.${suiteRunId}` },
        () => qc.invalidateQueries({ queryKey: ["suite-run", suiteRunId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "spec_runs", filter: `suite_run_id=eq.${suiteRunId}` },
        () => qc.invalidateQueries({ queryKey: ["suite-spec-runs", suiteRunId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [suiteRunId, qc]);

  if (!suite) return null;
  const total = suite.total_specs || runs.length || 0;
  const done = suite.completed_specs || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="border-t border-border/50 bg-muted/10 p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 font-medium">
          <Rocket className="h-3.5 w-3.5 text-accent" /> Suite Run · {suite.browser}{suite.headless ? " · headless" : ""} · retries {suite.retries}
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline">{suite.status}</Badge>
          <Badge variant="outline" className="text-emerald-300 border-emerald-500/30">✓ {suite.passed_specs}</Badge>
          {suite.failed_specs > 0 && <Badge variant="outline" className="text-red-300 border-red-500/30">✗ {suite.failed_specs}</Badge>}
          <span className="text-muted-foreground">{done}/{total}</span>
        </div>
      </div>
      <Progress value={pct} className="h-1.5" />
      <div className="grid grid-cols-2 gap-1 max-h-[160px] overflow-auto">
        {runs.map((r: any) => {
          const m = META[r.status] || META.queued;
          const Icon = m.icon;
          return (
            <div key={r.id} className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded bg-background/40 border border-border/30 truncate">
              <Icon className={`h-3 w-3 shrink-0 ${m.cls}`} />
              <span className="truncate">{r.spec?.filename || r.spec_id.slice(0, 8)}</span>
              <span className="ml-auto text-muted-foreground">{r.status}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
