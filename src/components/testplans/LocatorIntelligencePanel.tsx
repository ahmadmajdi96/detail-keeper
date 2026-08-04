import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Radar, Loader2, ShieldCheck, ShieldAlert, ShieldX, Check, X, Sparkles, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type LocatorVerdict = "ready" | "warning" | "blocked";

interface Finding {
  id: string; file: string; line: number; strategy: string; raw: string;
  health: "healthy" | "weak" | "broken";
  reason: string | null; recommendation: string | null;
  confidence: number | null; status: "pending" | "applied" | "rejected";
}

interface Props {
  testPlanId: string;
  suiteId?: string | null;
  baseUrl?: string;
  specCount: number;
  onVerdict?: (v: LocatorVerdict | null, analysisId: string | null) => void;
}

const VERDICT_META: Record<LocatorVerdict, { label: string; icon: typeof ShieldCheck; cls: string }> = {
  ready: { label: "Ready for Execution", icon: ShieldCheck, cls: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10" },
  warning: { label: "Ready with Warnings", icon: ShieldAlert, cls: "text-amber-400 border-amber-500/40 bg-amber-500/10" },
  blocked: { label: "Execution Blocked", icon: ShieldX, cls: "text-rose-400 border-rose-500/40 bg-rose-500/10" },
};

const HEALTH_CLS: Record<string, string> = {
  healthy: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  weak: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  broken: "text-rose-400 border-rose-500/30 bg-rose-500/10",
};

export function LocatorIntelligencePanel({ testPlanId, suiteId, baseUrl, specCount, onVerdict }: Props) {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: analysis } = useQuery<any>({
    queryKey: ["locator-analysis", testPlanId],
    queryFn: async () => {
      const { data } = await supabase
        .from("locator_analyses" as any)
        .select("*")
        .eq("test_plan_id", testPlanId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const findings: Finding[] = useMemo(
    () => (Array.isArray(analysis?.findings) ? analysis.findings : []),
    [analysis],
  );
  const actionable = findings.filter((f) => f.health !== "healthy" && f.status === "pending");
  const totals = analysis?.totals ?? {};
  const verdict = (analysis?.verdict ?? null) as LocatorVerdict | null;

  const analyze = async () => {
    setRunning(true);
    const t = toast.loading("Analysing Playwright locators…");
    try {
      const { data, error } = await supabase.functions.invoke("tp-locator-analyze", {
        body: { test_plan_id: testPlanId, suite_id: suiteId ?? null, base_url: baseUrl || null },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(
        `Analysed ${(data as any).totals?.total ?? 0} locators — health ${(data as any).health_score}%`,
        { id: t },
      );
      onVerdict?.((data as any).verdict, (data as any).analysis_id);
      qc.invalidateQueries({ queryKey: ["locator-analysis", testPlanId] });
    } catch (e: any) {
      toast.error(e.message || "Locator analysis failed", { id: t });
    } finally { setRunning(false); }
  };

  const act = async (action: "apply" | "reject", ids?: string[]) => {
    if (!analysis?.id) return;
    setBusyId(ids?.[0] ?? "bulk");
    try {
      const { data, error } = await supabase.functions.invoke("tp-locator-apply", {
        body: { analysis_id: analysis.id, action, finding_ids: ids ?? null },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(action === "apply" ? `Applied ${(data as any).applied} fix(es)` : "Recommendation rejected");
      onVerdict?.((data as any).verdict ?? verdict, analysis.id);
      qc.invalidateQueries({ queryKey: ["locator-analysis", testPlanId] });
      qc.invalidateQueries({ queryKey: ["tp-specs", testPlanId] });
    } catch (e: any) {
      toast.error(e.message || "Action failed");
    } finally { setBusyId(null); }
  };

  const V = verdict ? VERDICT_META[verdict] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Radar className="h-4 w-4 text-cyan-400" /> AI Locator Intelligence
          <Badge variant="outline" className="text-[10px]">Optional</Badge>
        </div>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={analyze} disabled={running || specCount === 0}
          title={specCount === 0 ? "Generate Playwright code first" : "Scan and score every locator in the generated specs"}>
          {running ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
          {analysis ? "Re-analyse" : "Analyse Locators"}
        </Button>
      </div>

      {!analysis && (
        <p className="text-xs text-muted-foreground">
          Validates and optimises Playwright locators before execution. Skip it to run tests immediately.
        </p>
      )}

      {analysis && (
        <>
          {V && (
            <div className={cn("flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium", V.cls)}>
              <V.icon className="h-4 w-4" /> {V.label}
              <span className="ml-auto font-mono">Health {analysis.health_score ?? 0}%</span>
            </div>
          )}
          <Progress value={analysis.health_score ?? 0} className="h-1.5" />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="Analysed" value={totals.total ?? 0} />
            <Stat label="Healthy" value={totals.healthy ?? 0} cls="text-emerald-400" />
            <Stat label="Weak" value={totals.weak ?? 0} cls="text-amber-400" />
            <Stat label="Broken" value={totals.broken ?? 0} cls="text-rose-400" />
            <Stat label="AI fixes" value={totals.fixes ?? 0} cls="text-cyan-400" />
          </div>

          {actionable.length > 0 && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => act("apply")} disabled={busyId !== null}>
                {busyId === "bulk" ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                Accept all ({actionable.filter((f) => f.recommendation).length})
              </Button>
              <Button size="sm" variant="outline" onClick={() => act("reject")} disabled={busyId !== null}>
                <X className="h-3.5 w-3.5 mr-1" /> Reject all
              </Button>
            </div>
          )}

          <ScrollArea className="max-h-[320px]">
            <div className="space-y-1.5 pr-2">
              {findings.filter((f) => f.health !== "healthy").length === 0 && (
                <p className="text-xs text-muted-foreground">All locators are healthy — nothing to fix.</p>
              )}
              {findings.filter((f) => f.health !== "healthy").map((f) => (
                <Card key={f.id} className="border-border/50 p-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-[10px] capitalize", HEALTH_CLS[f.health])}>{f.health}</Badge>
                    <span className="truncate font-mono text-[10px] text-muted-foreground">{f.file}:{f.line}</span>
                    {typeof f.confidence === "number" && (
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground">{f.confidence}%</span>
                    )}
                    {f.status !== "pending" && (
                      <Badge variant="secondary" className="text-[10px] capitalize">{f.status}</Badge>
                    )}
                  </div>
                  <code className="block break-all rounded bg-muted/40 px-2 py-1 font-mono text-[10px] text-rose-300">{f.raw}</code>
                  {f.recommendation && (
                    <code className="block break-all rounded bg-emerald-500/10 px-2 py-1 font-mono text-[10px] text-emerald-300">{f.recommendation}</code>
                  )}
                  {f.reason && <p className="text-[11px] text-muted-foreground">{f.reason}</p>}
                  {f.status === "pending" && (
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="outline" className="h-6 text-[11px]" disabled={!f.recommendation || busyId !== null}
                        onClick={() => act("apply", [f.id])}>
                        <Check className="h-3 w-3 mr-1" /> Accept
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 text-[11px]" disabled={busyId !== null}
                        onClick={() => act("reject", [f.id])}>
                        <X className="h-3 w-3 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls?: string }) {
  return (
    <div className="rounded-md border border-border/50 bg-muted/20 px-2 py-1.5">
      <div className={cn("font-mono text-base font-semibold", cls)}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
