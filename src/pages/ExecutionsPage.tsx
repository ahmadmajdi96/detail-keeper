import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Play, CheckCircle2, XCircle, AlertTriangle, Clock, Bug, Camera, FileText, Loader2, ChevronRight, Upload } from "lucide-react";
import type { TestExecution, TestCase, ExecutionStatus, DefectSeverity, DefectPriority } from "@/types";

const statusConfig: Record<ExecutionStatus, { color: string; icon: React.ReactNode }> = {
  pending: { color: "bg-muted text-muted-foreground", icon: <Clock className="h-4 w-4" /> },
  in_progress: { color: "bg-accent/10 text-accent", icon: <Play className="h-4 w-4" /> },
  passed: { color: "bg-success/10 text-success", icon: <CheckCircle2 className="h-4 w-4" /> },
  failed: { color: "bg-destructive/10 text-destructive", icon: <XCircle className="h-4 w-4" /> },
  blocked: { color: "bg-warning/10 text-warning", icon: <AlertTriangle className="h-4 w-4" /> },
  skipped: { color: "bg-muted text-muted-foreground", icon: <Clock className="h-4 w-4" /> },
};

export default function ExecutionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedExecution, setSelectedExecution] = useState<TestExecution | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isDefectDialogOpen, setIsDefectDialogOpen] = useState(false);
  const [defectTitle, setDefectTitle] = useState("");
  const [defectDescription, setDefectDescription] = useState("");
  const [defectSeverity, setDefectSeverity] = useState<DefectSeverity>("minor");
  const [defectPriority, setDefectPriority] = useState<DefectPriority>("medium");

  const { data: executions = [], isLoading } = useQuery({
    queryKey: ["executions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_executions")
        .select("*, test_case:test_cases(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (TestExecution & { test_case: TestCase })[];
    },
  });

  const { data: testCases = [] } = useQuery({
    queryKey: ["test-cases-for-execution"],
    queryFn: async () => {
      const { data, error } = await supabase.from("test_cases").select("*").eq("status", "active");
      if (error) throw error;
      return data as TestCase[];
    },
  });

  const startExecutionMutation = useMutation({
    mutationFn: async (testCaseId: string) => {
      const { data, error } = await supabase
        .from("test_executions")
        .insert({ test_case_id: testCaseId, executor_id: user?.id, status: "in_progress" as ExecutionStatus, started_at: new Date().toISOString() })
        .select("*, test_case:test_cases(*)")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["executions"] });
      setSelectedExecution(data);
      toast.success("Execution started");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ExecutionStatus }) => {
      const { error } = await supabase
        .from("test_executions")
        .update({ status, completed_at: ["passed", "failed", "blocked"].includes(status) ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["executions"] });
      toast.success("Status updated");
    },
  });

  const createDefectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("defects").insert({
        title: defectTitle,
        description: defectDescription,
        severity: defectSeverity,
        priority: defectPriority,
        execution_id: selectedExecution?.id,
        reported_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Defect logged");
      setIsDefectDialogOpen(false);
      setDefectTitle("");
      setDefectDescription("");
    },
  });

  const stats = {
    total: executions.length,
    passed: executions.filter((e) => e.status === "passed").length,
    failed: executions.filter((e) => e.status === "failed").length,
    inProgress: executions.filter((e) => e.status === "in_progress").length,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Manual Test Execution" description="Execute tests step-by-step with evidence capture" />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Total Executions", value: stats.total, icon: Play, color: "primary" },
            { label: "Passed", value: stats.passed, icon: CheckCircle2, color: "success" },
            { label: "Failed", value: stats.failed, icon: XCircle, color: "destructive" },
            { label: "In Progress", value: stats.inProgress, icon: Clock, color: "accent" },
          ].map((stat) => (
            <Card key={stat.label} className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-${stat.color}/10`}>
                  <stat.icon className={`h-5 w-5 text-${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 border-border/50">
            <CardHeader><CardTitle className="text-lg">Available Tests</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {testCases.map((tc) => (
                    <div key={tc.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{tc.title}</p>
                        <p className="text-xs text-muted-foreground">v{tc.version}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => startExecutionMutation.mutate(tc.id)}>
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {testCases.length === 0 && <p className="text-center text-muted-foreground py-8">No active test cases</p>}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Execution Panel</CardTitle>
              <CardDescription>{selectedExecution ? selectedExecution.test_case?.title : "Select a test to execute"}</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedExecution ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <Badge className={statusConfig[selectedExecution.status].color}>{statusConfig[selectedExecution.status].icon}<span className="ml-1">{selectedExecution.status}</span></Badge>
                  </div>
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="font-medium mb-2">Step {currentStepIndex + 1}</p>
                      <p className="text-sm text-muted-foreground">{selectedExecution.test_case?.description || "Execute the test case"}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setIsDefectDialogOpen(true)}><Bug className="mr-2 h-4 w-4" />Log Defect</Button>
                      <Button variant="outline" className="flex-1"><Camera className="mr-2 h-4 w-4" />Capture Evidence</Button>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="destructive" className="flex-1" onClick={() => updateStatusMutation.mutate({ id: selectedExecution.id, status: "failed" })}>Fail</Button>
                      <Button variant="outline" className="flex-1" onClick={() => updateStatusMutation.mutate({ id: selectedExecution.id, status: "blocked" })}>Block</Button>
                      <Button className="flex-1 bg-success hover:bg-success/90" onClick={() => updateStatusMutation.mutate({ id: selectedExecution.id, status: "passed" })}>Pass</Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Play className="h-12 w-12 mb-4 opacity-50" />
                  <p>Select a test case to start execution</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={isDefectDialogOpen} onOpenChange={setIsDefectDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle><Bug className="inline mr-2 h-5 w-5" />Log Defect</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>Title</Label><Input value={defectTitle} onChange={(e) => setDefectTitle(e.target.value)} placeholder="Brief defect description" /></div>
              <div className="space-y-2"><Label>Description</Label><Textarea value={defectDescription} onChange={(e) => setDefectDescription(e.target.value)} placeholder="Detailed description..." rows={3} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Severity</Label><Select value={defectSeverity} onValueChange={(v) => setDefectSeverity(v as DefectSeverity)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="trivial">Trivial</SelectItem><SelectItem value="minor">Minor</SelectItem><SelectItem value="major">Major</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Priority</Label><Select value={defectPriority} onValueChange={(v) => setDefectPriority(v as DefectPriority)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent></Select></div>
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setIsDefectDialogOpen(false)}>Cancel</Button><Button onClick={() => createDefectMutation.mutate()} disabled={!defectTitle}>{createDefectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Create Defect</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
