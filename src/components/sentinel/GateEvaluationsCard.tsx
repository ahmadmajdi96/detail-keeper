import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { useEffect } from "react";

interface Props { cycleRunId?: string | null; releaseId?: string | null; }

export function GateEvaluationsCard({ cycleRunId, releaseId }: Props) {
  const qc = useQueryClient();
  const key = ["gate-evals", cycleRunId, releaseId];
  const { data: items = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      let q = (supabase as any).from("gate_evaluations")
        .select("*, gate:quality_gates(name, blocks_release)")
        .order("evaluated_at", { ascending: false }).limit(10);
      if (cycleRunId) q = q.eq("cycle_run_id", cycleRunId);
      else if (releaseId) q = q.eq("release_id", releaseId);
      else return [];
      const { data } = await q;
      return data || [];
    },
    enabled: !!(cycleRunId || releaseId),
  });

  useEffect(() => {
    if (!cycleRunId && !releaseId) return;
    const filter = cycleRunId ? `cycle_run_id=eq.${cycleRunId}` : `release_id=eq.${releaseId}`;
    const ch = supabase.channel(`ge-${cycleRunId || releaseId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "gate_evaluations", filter },
        () => qc.invalidateQueries({ queryKey: key }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cycleRunId, releaseId]);

  const icon = (s: string) => s === "passed" ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
    : s === "failed" ? <XCircle className="h-4 w-4 text-red-400" />
    : <AlertTriangle className="h-4 w-4 text-amber-400" />;

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-accent" /> Quality Gates
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No gate evaluations yet.</p>
        ) : (
          <div className="space-y-2">
            {items.map((g: any) => (
              <div key={g.id} className="p-2 rounded border border-border/40">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {icon(g.status)}
                    <span className="text-sm font-medium">{g.gate?.name || "Gate"}</span>
                    {g.blocks_release && <Badge variant="outline" className="bg-red-500/10 text-red-300 border-red-500/30 text-xs">blocks</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(g.evaluated_at).toLocaleString()}</span>
                </div>
                {Array.isArray(g.rule_results) && g.rule_results.length > 0 && (
                  <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                    {g.rule_results.map((r: any, i: number) => (
                      <div key={i} className="flex justify-between">
                        <span>{r.ok ? "✓" : "✗"} {r.name}</span>
                        <span>actual: <code className="text-foreground">{String(r.actual)}</code> · expected: <code>{String(r.expected)}</code></span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
