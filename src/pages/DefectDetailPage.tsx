import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Bug, Loader2 } from "lucide-react";

export default function DefectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["defect-detail", id],
    queryFn: async () => {
      const { data: defect } = await supabase
        .from("defects")
        .select(`*,
          reporter:profiles!defects_reported_by_fkey(id,name,email),
          assignee:profiles!defects_assigned_to_fkey(id,name,email),
          project:projects(id,name),
          test_plan:test_plans(id,name)
        `)
        .eq("id", id!)
        .maybeSingle();
      if (!defect) return null;
      let execution: any = null;
      let stepResults: any[] = [];
      if (defect.execution_id) {
        const { data: ex } = await supabase
          .from("test_executions")
          .select("*, test_case:test_cases(id,title)")
          .eq("id", defect.execution_id)
          .maybeSingle();
        execution = ex;
        const { data: steps } = await supabase
          .from("execution_step_results")
          .select("*")
          .eq("execution_id", defect.execution_id)
          .order("step_number");
        stepResults = steps || [];
      }
      return { defect, execution, stepResults };
    },
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  if (!data?.defect) {
    return (
      <AppLayout>
        <PageHeader title="Defect not found" description="The defect you're looking for does not exist." />
        <Button variant="outline" onClick={() => navigate("/defects")}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
      </AppLayout>
    );
  }

  const d = data.defect;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/defects")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> All Defects
          </Button>
        </div>
        <PageHeader
          title={d.title}
          description={`Defect · ${d.status.replace("_", " ")} · ${d.severity}/${d.priority}`}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-border/50">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Bug className="h-4 w-4" /> Description</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{d.description || "No description provided."}</p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row k="Status" v={<Badge variant="outline">{d.status}</Badge>} />
              <Row k="Severity" v={<Badge variant="outline">{d.severity}</Badge>} />
              <Row k="Priority" v={<Badge variant="outline">{d.priority}</Badge>} />
              <Row k="Project" v={(d as any).project?.name ?? "—"} />
              <Row k="Test Plan" v={(d as any).test_plan?.name ?? "—"} />
              <Row k="Reporter" v={(d as any).reporter ? (
                <span className="flex items-center gap-2"><Avatar className="h-5 w-5"><AvatarFallback className="text-[10px]">{(d as any).reporter.name?.charAt(0)}</AvatarFallback></Avatar>{(d as any).reporter.name}</span>
              ) : "—"} />
              <Row k="Assignee" v={(d as any).assignee?.name ?? "Unassigned"} />
              <Row k="Created" v={new Date(d.created_at).toLocaleString()} />
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Test Execution Log</CardTitle>
          </CardHeader>
          <CardContent>
            {!data.execution ? (
              <p className="text-sm text-muted-foreground">No linked execution.</p>
            ) : (
              <div className="space-y-3">
                <div className="text-sm">
                  <span className="text-muted-foreground">Test Case:</span>{" "}
                  <span className="font-medium">{data.execution.test_case?.title ?? "—"}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Result:</span>{" "}
                  <Badge variant="outline">{data.execution.status}</Badge>
                </div>
                <div className="rounded-lg border border-border/60 bg-[#0a0f1c] overflow-hidden">
                  <div className="px-3 py-1.5 border-b border-border/60 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Step Results</div>
                  <ScrollArea className="h-64">
                    <div className="p-2 font-mono text-[11px] space-y-1">
                      {data.stepResults.length === 0 ? (
                        <div className="text-muted-foreground px-1 py-1">No detailed step log recorded.</div>
                      ) : (
                        data.stepResults.map((s) => (
                          <div key={s.id} className="flex gap-2">
                            <span className="text-muted-foreground/60 shrink-0">#{s.step_number}</span>
                            <span className={`shrink-0 w-16 ${s.status === "passed" ? "text-success" : s.status === "failed" ? "text-destructive" : "text-warning"}`}>
                              {s.status?.toUpperCase()}
                            </span>
                            <span className="text-foreground/90 whitespace-pre-wrap break-words">{s.notes || s.actual_result || ""}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
