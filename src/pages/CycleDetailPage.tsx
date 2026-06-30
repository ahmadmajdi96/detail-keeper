import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Rocket, Server, Layers, Repeat, Bug } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";
import { ReleaseJudgeCard } from "@/components/sentinel/ReleaseJudgeCard";
import { GateEvaluationsCard } from "@/components/sentinel/GateEvaluationsCard";

const STATUS_COLORS: Record<string, string> = {
  not_run: "bg-muted text-muted-foreground",
  in_progress: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  passed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
  blocked: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  skipped: "bg-muted text-muted-foreground",
  not_applicable: "bg-muted text-muted-foreground",
};

const ITEM_STATUSES = ["not_run","in_progress","passed","failed","blocked","skipped","not_applicable"];

export default function CycleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const navigate = useNavigate();


  const { data: cycle, isLoading } = useQuery({
    queryKey: ["cycle", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("test_cycles")
        .select("*, release:releases(name,version), environment:environments(name,type), suite:test_suites(name), project:projects(workspace_id)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: runs = [] } = useQuery({
    queryKey: ["cycle-runs", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cycle_runs")
        .select("*")
        .eq("cycle_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["cycle-items", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("cycle_run_items")
        .select("*, test_case:test_cases(id,title,priority)")
        .eq("cycle_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  // Realtime updates
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`cycle-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "cycle_run_items", filter: `cycle_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["cycle-items", id] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "cycle_runs", filter: `cycle_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["cycle-runs", id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, qc]);

  const updateItem = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: string }) => {
      const { error } = await (supabase as any)
        .from("cycle_run_items")
        .update({ status, last_executed_at: new Date().toISOString() })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cycle-items", id] }),
    onError: (e: any) => toast.error(e.message || "Failed to update"),
  });

  const totals = items.reduce((acc: any, i: any) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    acc.total = (acc.total || 0) + 1;
    return acc;
  }, {});

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }
  if (!cycle) {
    return <AppLayout><div className="p-8 text-muted-foreground">Cycle not found.</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title={cycle.name}
          description={cycle.description || "Test cycle"}
          actions={
            <Button variant="outline" asChild>
              <Link to="/cycles"><ArrowLeft className="mr-2 h-4 w-4" />Back to cycles</Link>
            </Button>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card className="border-border/50"><CardContent className="py-4">
            <div className="text-xs text-muted-foreground">Release</div>
            <div className="flex items-center gap-1.5 mt-1"><Rocket className="h-4 w-4 text-accent" />{cycle.release?.name || "—"}</div>
          </CardContent></Card>
          <Card className="border-border/50"><CardContent className="py-4">
            <div className="text-xs text-muted-foreground">Environment</div>
            <div className="flex items-center gap-1.5 mt-1"><Server className="h-4 w-4 text-accent" />{cycle.environment?.name || "—"}</div>
          </CardContent></Card>
          <Card className="border-border/50"><CardContent className="py-4">
            <div className="text-xs text-muted-foreground">Suite</div>
            <div className="flex items-center gap-1.5 mt-1"><Layers className="h-4 w-4 text-accent" />{cycle.suite?.name || "—"}</div>
          </CardContent></Card>
          <Card className="border-border/50"><CardContent className="py-4">
            <div className="text-xs text-muted-foreground">Runs</div>
            <div className="flex items-center gap-1.5 mt-1"><Repeat className="h-4 w-4 text-accent" />{runs.length}</div>
          </CardContent></Card>
        </div>

        {totals.total > 0 && (
          <Card className="border-border/50">
            <CardHeader><CardTitle className="text-base">Progress</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 text-xs">
                {ITEM_STATUSES.map((s) => (
                  <Badge key={s} variant="outline" className={STATUS_COLORS[s]}>
                    {s.replace("_", " ")}: {totals[s] || 0}
                  </Badge>
                ))}
                <Badge variant="outline">total: {totals.total}</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GateEvaluationsCard cycleRunId={runs[runs.length - 1]?.id} />
          <ReleaseJudgeCard
            cycleRunId={runs[runs.length - 1]?.id}
            releaseId={cycle.release_id}
            projectId={cycle.project_id}
            workspaceId={cycle.project?.workspace_id}
          />
        </div>

        <Card className="border-border/50">
          <CardHeader><CardTitle className="text-base">Test Items</CardTitle></CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No items in this cycle yet. Link a suite when creating the cycle to auto-seed items.
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((it: any) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{it.test_case?.title || "Untitled test case"}</div>
                      <div className="text-xs text-muted-foreground">
                        P{it.test_case?.priority ?? "-"} · attempts: {it.attempt_count}
                        {it.last_executed_at && <> · last run: {new Date(it.last_executed_at).toLocaleString()}</>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {it.status === "failed" && (
                        <Button size="sm" variant="ghost" title="Report defect"
                          onClick={() => navigate("/defects", { state: {
                            openCreate: true,
                            cycle_run_item_id: it.id,
                            cycle_run_id: it.run_id,
                            project_id: it.project_id || cycle.project_id,
                            title: `Failure: ${it.test_case?.title}`,
                          }})}>
                          <Bug className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Select
                        value={it.status}
                        onValueChange={(v) => updateItem.mutate({ itemId: it.id, status: v })}
                      >
                        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ITEM_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
