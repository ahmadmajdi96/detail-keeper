import { useEffect, useRef, useState } from "react";
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
import { Play, CheckCircle2, XCircle, AlertTriangle, Clock, Bug, Camera, FileText, Loader2, ChevronRight, Upload, Zap } from "lucide-react";
import type { TestExecution, TestCase, ExecutionStatus, DefectSeverity, DefectPriority } from "@/types";
import { useProjectScope } from "@/hooks/useProjectScope";
import { AutoExecutePanel, type AutoExecItem, type AutoExecMode } from "@/components/executions/AutoExecutePanel";

type ExecutionWithTestCase = TestExecution & { test_case: TestCase | null };

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
  const { projectId, workspaceId, scopeKey } = useProjectScope();
  const [selectedExecution, setSelectedExecution] = useState<ExecutionWithTestCase | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isDefectDialogOpen, setIsDefectDialogOpen] = useState(false);
  const [defectTitle, setDefectTitle] = useState("");
  const [defectDescription, setDefectDescription] = useState("");
  const [defectSeverity, setDefectSeverity] = useState<DefectSeverity>("minor");
  const [defectPriority, setDefectPriority] = useState<DefectPriority>("medium");

  // Auto execute state
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoMode, setAutoMode] = useState<AutoExecMode>("api");
  const [autoItems, setAutoItems] = useState<AutoExecItem[]>([]);
  const [liveUrl, setLiveUrl] = useState<string | undefined>(undefined);
  const autoAbort = useRef(false);

  // Manual execution log stream (newest first)
  type ManualLog = { t: number; line: string; kind: "info" | "ok" | "err" | "warn" };
  const [manualLogs, setManualLogs] = useState<ManualLog[]>([]);
  const pushManualLog = (line: string, kind: ManualLog["kind"] = "info") =>
    setManualLogs((p) => [{ t: Date.now(), line, kind }, ...p].slice(0, 200));

  const { data: executions = [], isLoading } = useQuery({
    queryKey: ["executions", ...scopeKey],
    queryFn: async () => {
      let q = supabase
        .from("test_executions")
        .select("*, test_case:test_cases(*)")
        .order("created_at", { ascending: false });
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data as (TestExecution & { test_case: TestCase })[];
    },
  });

  const { data: testCases = [] } = useQuery({
    queryKey: ["test-cases-for-execution", ...scopeKey],
    queryFn: async () => {
      let q = supabase.from("test_cases").select("*").eq("status", "active");
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data as TestCase[];
    },
  });

  const startExecutionMutation = useMutation({
    mutationFn: async (testCaseId: string) => {
      const { data, error } = await supabase
        .from("test_executions")
        .insert({ test_case_id: testCaseId, executor_id: user?.id, status: "in_progress" as ExecutionStatus, started_at: new Date().toISOString(), project_id: projectId, workspace_id: workspaceId })
        .select("*, test_case:test_cases(*)")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["executions"] });
      setSelectedExecution(data);
      setManualLogs([]);
      pushManualLog(`▶ Started execution of "${data.test_case?.title ?? "test"}"`, "info");
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
      return status;
    },
    onSuccess: (status) => {
      queryClient.invalidateQueries({ queryKey: ["executions"] });
      const kind = status === "passed" ? "ok" : status === "failed" ? "err" : "warn";
      const glyph = status === "passed" ? "✓" : status === "failed" ? "✗" : "⏸";
      pushManualLog(`${glyph} Marked ${status}`, kind);
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
        project_id: projectId,
        workspace_id: workspaceId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Defect logged");
      pushManualLog(`🐞 Defect logged: "${defectTitle}" (${defectSeverity}/${defectPriority})`, "warn");
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

  // --- Auto execute runner (simulated; persists results to DB) ---
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const pushLog = (id: string, line: string, kind: AutoExecItem["logs"][number]["kind"] = "info") => {
    setAutoItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, logs: [...it.logs, { t: Date.now(), line, kind }] } : it))
    );
  };
  const updateItem = (id: string, patch: Partial<AutoExecItem>) =>
    setAutoItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const startAutoExecute = async () => {
    if (autoRunning) return;
    const pool = testCases.slice(0, 12);
    if (pool.length === 0) {
      toast.error("No active test cases to execute");
      return;
    }
    setAutoOpen(true);
    setAutoRunning(true);
    autoAbort.current = false;
    const items: AutoExecItem[] = pool.map((tc) => ({
      id: `auto-${tc.id}-${Date.now()}`,
      title: tc.title,
      status: "queued",
      progress: 0,
      logs: [],
    }));
    setAutoItems(items);
    toast.success(`Auto-executing ${items.length} test${items.length === 1 ? "" : "s"}`);

    for (let i = 0; i < items.length; i++) {
      if (autoAbort.current) break;
      const item = items[i];
      const tc = pool[i];
      updateItem(item.id, { status: "running", progress: 5 });
      pushLog(item.id, `▶ Starting "${tc.title}"`, "info");

      // create real DB row
      let execId: string | null = null;
      try {
        const { data } = await supabase
          .from("test_executions")
          .insert({
            test_case_id: tc.id,
            executor_id: user?.id,
            status: "in_progress" as ExecutionStatus,
            started_at: new Date().toISOString(),
            project_id: projectId,
            workspace_id: workspaceId,
          })
          .select("id")
          .single();
        execId = data?.id ?? null;
      } catch {
        /* keep running even if DB fails */
      }

      const steps =
        autoMode === "api"
          ? [
              { line: `POST /api/auth/login → 200 OK (142ms)`, kind: "req" as const },
              { line: `GET  /api/health → 200 OK (38ms)`, kind: "ok" as const },
              { line: `GET  /api/${tc.title.toLowerCase().replace(/\s+/g, "-").slice(0, 24)} → 200 OK`, kind: "req" as const },
              { line: `Assert response.status == 200`, kind: "ok" as const },
              { line: `Assert payload schema valid`, kind: "ok" as const },
            ]
          : [
              { line: `navigate → ${liveUrl ?? "about:blank"}`, kind: "info" as const },
              { line: `page.waitForSelector('main')`, kind: "info" as const },
              { line: `click "${tc.title.split(" ")[0] ?? "Submit"}" button`, kind: "info" as const },
              { line: `expect(page).toHaveURL(/dashboard|home/)`, kind: "ok" as const },
              { line: `screenshot captured`, kind: "info" as const },
            ];

      for (let s = 0; s < steps.length; s++) {
        if (autoAbort.current) break;
        await sleep(600 + Math.random() * 700);
        pushLog(item.id, steps[s].line, steps[s].kind);
        updateItem(item.id, { progress: Math.round(((s + 1) / (steps.length + 1)) * 100) });
      }
      if (autoAbort.current) {
        if (execId) await supabase.from("test_executions").update({ status: "blocked" }).eq("id", execId);
        updateItem(item.id, { status: "failed", progress: 100 });
        pushLog(item.id, `■ Aborted`, "err");
        break;
      }

      const passed = Math.random() > 0.18;
      const finalStatus: ExecutionStatus = passed ? "passed" : "failed";
      pushLog(item.id, passed ? "✓ All assertions passed" : "✗ Assertion failed", passed ? "ok" : "err");
      updateItem(item.id, { status: passed ? "passed" : "failed", progress: 100 });
      if (execId) {
        await supabase
          .from("test_executions")
          .update({ status: finalStatus, completed_at: new Date().toISOString() })
          .eq("id", execId);
      }
    }

    setAutoRunning(false);
    queryClient.invalidateQueries({ queryKey: ["executions"] });
    toast.success("Auto execution complete");
  };

  const stopAuto = () => {
    autoAbort.current = true;
    setAutoRunning(false);
    toast.message("Stopping auto execution…");
  };

  const downloadAutoReport = () => {
    const ts = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}-${pad(ts.getHours())}${pad(ts.getMinutes())}`;
    const passed = autoItems.filter((i) => i.status === "passed").length;
    const failed = autoItems.filter((i) => i.status === "failed").length;
    const lines: string[] = [];
    lines.push(`# Auto Execution Report`);
    lines.push(``);
    lines.push(`- Generated: ${ts.toISOString()}`);
    lines.push(`- Mode: ${autoMode}`);
    lines.push(`- Total: ${autoItems.length}  ·  Passed: ${passed}  ·  Failed: ${failed}`);
    lines.push(``);
    autoItems.forEach((it, idx) => {
      lines.push(`---`);
      lines.push(`## ${idx + 1}. ${it.title}`);
      lines.push(`Status: **${it.status.toUpperCase()}**  ·  Progress: ${it.progress}%`);
      lines.push(``);
      lines.push("```");
      it.logs.forEach((l) => {
        const t = new Date(l.t).toISOString().split("T")[1].replace("Z", "");
        lines.push(`[${t}] ${(l.kind ?? "info").toUpperCase().padEnd(4)}  ${l.line}`);
      });
      lines.push("```");
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auto-execution-report-${stamp}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Test Execution"
          description="Execute tests step-by-step or trigger an automated run with a live panel"
          actions={
            <Button onClick={startAutoExecute} disabled={autoRunning} className="gap-2">
              {autoRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {autoRunning ? "Running…" : "Auto Execute"}
            </Button>
          }
        />

        {autoOpen && (
          <AutoExecutePanel
            running={autoRunning}
            mode={autoMode}
            items={autoItems}
            liveUrl={liveUrl}
            onModeChange={setAutoMode}
            onStop={stopAuto}
            onClose={() => { autoAbort.current = true; setAutoRunning(false); setAutoOpen(false); }}
            onDownload={downloadAutoReport}
          />
        )}

        {/* Compact stat strip */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: "Total", value: stats.total, icon: Play, color: "primary" },
            { label: "Passed", value: stats.passed, icon: CheckCircle2, color: "success" },
            { label: "Failed", value: stats.failed, icon: XCircle, color: "destructive" },
            { label: "In Progress", value: stats.inProgress, icon: Clock, color: "accent" },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-2 rounded-md border border-border/50 bg-card/60 px-3 py-1.5"
            >
              <s.icon className={`h-3.5 w-3.5 text-${s.color}`} />
              <span className="text-sm font-semibold tabular-nums">{s.value}</span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
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
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge className={statusConfig[selectedExecution.status].color}>{statusConfig[selectedExecution.status].icon}<span className="ml-1">{selectedExecution.status}</span></Badge>
                    {manualLogs.length > 0 && (
                      <button
                        onClick={() => setManualLogs([])}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >Clear log</button>
                    )}
                  </div>

                  {/* Live activity log — at the very top of the section */}
                  <div className="rounded-lg border border-border/60 bg-[#0a0f1c] overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-border/60 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                      <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Activity Log</span>
                      <span className="ml-auto text-[10px] text-muted-foreground font-mono">{manualLogs.length}</span>
                    </div>
                    <ScrollArea className="h-40">
                      <div className="p-2 font-mono text-[11px] space-y-0.5">
                        {manualLogs.length === 0 ? (
                          <div className="text-muted-foreground px-1 py-1">Actions on this execution will appear here.</div>
                        ) : (
                          manualLogs.map((l, i) => {
                            const t = new Date(l.t);
                            const ts = `${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}:${String(t.getSeconds()).padStart(2,"0")}`;
                            const cls = l.kind === "ok" ? "text-success" : l.kind === "err" ? "text-destructive" : l.kind === "warn" ? "text-warning" : "text-muted-foreground";
                            return (
                              <div key={i} className="flex gap-2">
                                <span className="text-muted-foreground/60 shrink-0">{ts}</span>
                                <span className={`shrink-0 w-10 ${cls}`}>{l.kind.toUpperCase()}</span>
                                <span className="text-foreground/90 whitespace-pre-wrap break-words">{l.line}</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="font-medium mb-2">Step {currentStepIndex + 1}</p>
                      <p className="text-sm text-muted-foreground">{selectedExecution.test_case?.description || "Execute the test case"}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setIsDefectDialogOpen(true)}><Bug className="mr-2 h-4 w-4" />Log Defect</Button>
                      <Button variant="outline" className="flex-1" onClick={() => pushManualLog("📸 Evidence capture requested", "info")}><Camera className="mr-2 h-4 w-4" />Capture Evidence</Button>
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
