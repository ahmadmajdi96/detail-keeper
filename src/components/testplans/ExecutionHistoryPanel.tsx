import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  History, ChevronRight, Loader2, Sparkles, Download, ExternalLink,
  CheckCircle2, XCircle, SkipForward, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props { testPlanId: string; }

const STATUS_CLS: Record<string, string> = {
  passed: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  completed: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  succeeded: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  failed: "text-rose-400 border-rose-500/40 bg-rose-500/10",
  cancelled: "text-slate-400 border-slate-500/40 bg-slate-500/10",
  running: "text-cyan-400 border-cyan-500/40 bg-cyan-500/10",
  queued: "text-amber-400 border-amber-500/40 bg-amber-500/10",
};

export function ExecutionHistoryPanel({ testPlanId }: Props) {
  const qc = useQueryClient();
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  const { data: runs = [], isLoading } = useQuery<any[]>({
    queryKey: ["plan-test-runs", testPlanId],
    queryFn: async () => {
      const { data } = await supabase
        .from("plan_test_runs")
        .select("*")
        .eq("test_plan_id", testPlanId)
        .order("started_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const analyze = async (runId: string) => {
    setAnalyzing(runId);
    const t = toast.loading("Running AI failure analysis…");
    try {
      const { data, error } = await supabase.functions.invoke("tp-run-analyze", {
        body: { plan_test_run_id: runId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("AI analysis ready", { id: t });
      qc.invalidateQueries({ queryKey: ["plan-test-runs", testPlanId] });
    } catch (e: any) {
      toast.error(e.message || "Analysis failed", { id: t });
    } finally { setAnalyzing(null); }
  };

  if (isLoading) {
    return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading execution history…</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <History className="h-4 w-4 text-cyan-400" /> Execution History
        <Badge variant="outline" className="text-[10px]">{runs.length}</Badge>
      </div>

      {runs.length === 0 && (
        <Card className="border-dashed"><CardContent className="py-10 text-center text-sm text-muted-foreground">
          No automated executions yet for this plan.
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {runs.map((r, i) => {
          const duration = r.started_at && r.finished_at
            ? Math.round((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 1000)
            : null;
          const ai = r.ai_analysis as any;
          return (
            <Collapsible key={r.id}>
              <Card className="overflow-hidden">
                <CollapsibleTrigger className="w-full text-left">
                  <CardHeader className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <ChevronRight className="h-4 w-4 shrink-0 transition-transform data-[state=open]:rotate-90" />
                      <CardTitle className="text-sm">Run #{runs.length - i}</CardTitle>
                      <Badge variant="outline" className={cn("text-[10px] capitalize", STATUS_CLS[r.status] ?? "")}>{r.status}</Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {r.started_at ? new Date(r.started_at).toLocaleString() : "—"}
                      </span>
                      {r.environment && <Badge variant="secondary" className="text-[10px]">{r.environment}</Badge>}
                      {r.browser && <Badge variant="secondary" className="text-[10px]">{r.browser}</Badge>}
                      {r.build_version && <Badge variant="secondary" className="text-[10px]">build {r.build_version}</Badge>}
                      <div className="flex-1" />
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400"><CheckCircle2 className="h-3 w-3" />{r.passed_tests}</span>
                      <span className="flex items-center gap-1 text-[11px] text-rose-400"><XCircle className="h-3 w-3" />{r.failed_tests}</span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-400"><SkipForward className="h-3 w-3" />{r.skipped_tests ?? 0}</span>
                      {duration !== null && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="h-3 w-3" />{fmtDur(duration)}</span>
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="space-y-3 border-t border-border/50 pt-3">
                    <div className="flex flex-wrap gap-2">
                      {r.download_url && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={r.download_url} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5 mr-1" /> Artifacts</a>
                        </Button>
                      )}
                      {r.live_view_url && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={r.live_view_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Live view</a>
                        </Button>
                      )}
                      <Button size="sm" variant="outline" disabled={analyzing === r.id} onClick={() => analyze(r.id)}>
                        {analyzing === r.id ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                        {ai ? "Re-run AI analysis" : "AI failure analysis"}
                      </Button>
                    </div>

                    {ai && (
                      <div className="space-y-2 rounded-md border border-cyan-500/30 bg-cyan-500/5 p-3">
                        <div className="text-xs font-semibold text-cyan-300">AI root-cause analysis</div>
                        {ai.summary && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{ai.summary}</p>}
                        {(ai.failures ?? []).map((f: any, k: number) => (
                          <div key={k} className="rounded-md border border-border/50 bg-background/40 p-2 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-medium">{f.test}</span>
                              {f.category && <Badge variant="outline" className="text-[10px]">{String(f.category).replace(/_/g, " ")}</Badge>}
                              {f.likely_flaky && <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/40">flaky</Badge>}
                              {typeof f.confidence === "number" && <span className="ml-auto font-mono text-[10px] text-muted-foreground">{f.confidence}%</span>}
                            </div>
                            {f.root_cause && <p className="text-[11px]"><span className="text-muted-foreground">Root cause: </span>{f.root_cause}</p>}
                            {f.suggested_fix && <p className="text-[11px]"><span className="text-muted-foreground">Suggested fix: </span>{f.suggested_fix}</p>}
                          </div>
                        ))}
                      </div>
                    )}

                    {Array.isArray((r.test_case_progress as any)?.test_cases) && (r.test_case_progress as any).test_cases.length > 0 && (
                      <>
                        <Separator />
                        <div className="text-xs font-semibold">Per-test results</div>
                        <ScrollArea className="max-h-[240px]">
                          <div className="space-y-1 pr-2">
                            {(r.test_case_progress as any).test_cases.map((c: any, k: number) => (
                              <div key={k} className="flex items-center gap-2 rounded border border-border/40 px-2 py-1">
                                <Badge variant="outline" className={cn("text-[10px] capitalize", STATUS_CLS[String(c.status).toLowerCase()] ?? "")}>{c.status}</Badge>
                                <span className="flex-1 truncate text-[11px]">{c.title ?? c.name ?? c.id}</span>
                                {c.duration_ms != null && <span className="font-mono text-[10px] text-muted-foreground">{Math.round(c.duration_ms / 100) / 10}s</span>}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </>
                    )}

                    {r.log_tail && (
                      <>
                        <Separator />
                        <div className="text-xs font-semibold">Log tail</div>
                        <pre className="max-h-[220px] overflow-auto rounded bg-[#0a0f1c] p-2 font-mono text-[10px] text-foreground/80">{r.log_tail}</pre>
                      </>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

function fmtDur(s: number) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}
