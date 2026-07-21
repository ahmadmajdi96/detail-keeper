import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProjectScope } from "@/hooks/useProjectScope";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Sparkles, Loader2, FileText, Users, GitBranch, Play,
  CheckCircle2, ListChecks, Clock, Target, History, Activity, RefreshCw,
  Plus, Edit3, Trash2, Layers, Variable, Download, Save, BookOpen,
  ChevronDown, ExternalLink, FolderOpen, Settings2, Zap, Gauge,
} from "lucide-react";
import { useLatestJobForPlan } from "@/hooks/useJob";
import { format } from "date-fns";
import { TestPlanWorkbench } from "@/components/testplans/TestPlanWorkbench";
import { PlanPeoplePanel } from "@/components/testplans/PlanPeoplePanel";
import { PlanRunnersPanel, PlanDefectsPanel, PlanQualityGatesPanel, PlanReportsPanel, PlanLivePanel, PlanRequirementsPanel } from "@/components/testplans/TestPlanPanels";
import { Server, Bug, ShieldCheck, BarChart3, Radio } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AnimatePresence } from "framer-motion";

const TEST_TYPES = ["functional", "integration", "e2e", "security", "performance", "regression", "ui", "api", "other"] as const;
type TestType = typeof TEST_TYPES[number];

function inferType(tc: any): TestType {
  const tag = (tc?.coverage_tags?.[0] || "").toLowerCase();
  return (TEST_TYPES as readonly string[]).includes(tag) ? (tag as TestType) : "other";
}


export default function TestPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { job: genJob } = useLatestJobForPlan(id || null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { workspaceId, projectId } = useProjectScope();
  const [tab, setTab] = useState("overview");
  const [caseDialogOpen, setCaseDialogOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<any | null>(null);
  const [deletingCase, setDeletingCase] = useState<{ linkId: string; caseId: string; title: string } | null>(null);
  const [form, setForm] = useState<{ title: string; description: string; priority: string; type: TestType; expected_result: string }>({
    title: "", description: "", priority: "2", type: "functional", expected_result: "",
  });

  // Variable Sets editor state — each set groups a description + dynamic key/value list.
  type PlanVar = { key: string; value: string };
  type PlanVarSet = { id: string; name: string; description: string; variables: PlanVar[] };
  const [varSets, setVarSets] = useState<PlanVarSet[]>([]);
  const [varsLoaded, setVarsLoaded] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [impWs, setImpWs] = useState("");
  const [impProj, setImpProj] = useState("");
  const [impPlan, setImpPlan] = useState("");

  // Plan-level documents (dynamic list stored in test_plans.plan_documents jsonb)
  type PlanDoc = { id: string; name: string; url: string; description: string };
  const [planDocs, setPlanDocs] = useState<PlanDoc[]>([]);
  const [planDocsLoaded, setPlanDocsLoaded] = useState(false);

  // Overview collapsible open state
  const [openReq, setOpenReq] = useState(false);
  const [openVars, setOpenVars] = useState(false);
  const [openDocs, setOpenDocs] = useState(false);

  // Sub-tab state for grouped tabs
  const [workbenchSub, setWorkbenchSub] = useState("workbench");
  const [insightsSub, setInsightsSub] = useState("versions");
  const [opsSub, setOpsSub] = useState("defects");

  const { data: plan, isLoading } = useQuery({
    queryKey: ["test-plan", id],
    enabled: !!id,
    refetchInterval: (q) => {
      const s = (q.state.data as any)?.ai_status;
      return (s === "running" || s === "queued") ? 4000 : false;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_plans")
        .select("*, creator:profiles!test_plans_created_by_fkey(name, email)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });


  const { data: assignees = [] } = useQuery({
    queryKey: ["test-plan-assignees", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("test_plan_assignees")
        .select("id, role, user:profiles!test_plan_assignees_user_id_fkey(id, name, email, role)")
        .eq("test_plan_id", id!);
      return data || [];
    },
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["test-plan-documents", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("test_plan_documents")
        .select("id, document:documents!test_plan_documents_document_id_fkey(id, filename, mime_type, status, created_at)")
        .eq("test_plan_id", id!);
      return data || [];
    },
  });

  const { data: testCases = [] } = useQuery({
    queryKey: ["test-plan-cases", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("test_plan_test_cases")
        .select("id, test_case:test_cases!test_plan_test_cases_test_case_id_fkey(id, title, description, priority, status, ai_generated, coverage_tags, created_at)")
        .eq("test_plan_id", id!)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: versions = [] } = useQuery({
    queryKey: ["test-plan-versions", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("test_plan_versions")
        .select("*, creator:profiles!test_plan_versions_created_by_fkey(name)")
        .eq("test_plan_id", id!)
        .order("version", { ascending: false });
      return data || [];
    },
  });

  const { data: executions = [] } = useQuery({
    queryKey: ["test-plan-executions", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("test_executions")
        .select("id, status, environment, started_at, completed_at, executor:profiles!test_executions_executor_id_fkey(name), case:test_cases!test_executions_test_case_id_fkey(title)")
        .eq("test_plan_id", id!)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const { data: suiteRuns = [] } = useQuery({
    queryKey: ["test-plan-suite-runs", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("suite_runs")
        .select("id, status, total_specs, passed_specs, failed_specs, completed_specs, created_at, started_at, finished_at")
        .eq("test_plan_id", id!)
        .order("created_at", { ascending: false })
        .limit(25);
      return data || [];
    },
  });

  // Hydrate variable sets when plan loads (supports legacy flat list)
  useEffect(() => {
    if (!plan || varsLoaded) return;
    const arr = Array.isArray((plan as any).variables) ? (plan as any).variables : [];
    const isNewShape = arr.length > 0 && arr.every((r: any) => r && Array.isArray(r.variables));
    if (isNewShape) {
      setVarSets(arr.map((s: any) => ({
        id: String(s.id || (crypto?.randomUUID?.() ?? Math.random().toString(36))),
        name: String(s.name || "Untitled Set"),
        description: String(s.description || ""),
        variables: (s.variables || []).map((v: any) => ({ key: String(v?.key ?? ""), value: String(v?.value ?? "") })),
      })));
    } else if (arr.length > 0) {
      // Legacy flat [{key,value}] -> single "Default" set
      setVarSets([{
        id: crypto?.randomUUID?.() ?? "default",
        name: "Default",
        description: "",
        variables: arr.map((v: any) => ({ key: String(v?.key ?? ""), value: String(v?.value ?? "") })),
      }]);
    } else {
      setVarSets([]);
    }
    setVarsLoaded(true);
  }, [plan, varsLoaded]);

  useEffect(() => {
    if (!plan || planDocsLoaded) return;
    const arr = Array.isArray((plan as any).plan_documents) ? (plan as any).plan_documents : [];
    setPlanDocs(arr.map((d: any) => ({
      id: d?.id || (crypto?.randomUUID?.() ?? String(Math.random())),
      name: String(d?.name ?? ""),
      url: String(d?.url ?? ""),
      description: String(d?.description ?? ""),
    })));
    setPlanDocsLoaded(true);
  }, [plan, planDocsLoaded]);

  const savePlanDocs = useMutation({
    mutationFn: async (next: PlanDoc[]) => {
      const clean = next.filter((d) => d.name.trim() || d.url.trim());
      const { error } = await supabase
        .from("test_plans")
        .update({ plan_documents: clean as any } as any)
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["test-plan", id] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to save documents"),
  });

  const updatePlanDocs = (updater: (prev: PlanDoc[]) => PlanDoc[]) => {
    setPlanDocs((prev) => {
      const next = updater(prev);
      savePlanDocs.mutate(next);
      return next;
    });
  };



  const saveVars = useMutation({
    mutationFn: async () => {
      const clean = varSets
        .map((s) => ({
          id: s.id,
          name: s.name.trim() || "Untitled Set",
          description: s.description || "",
          variables: s.variables.filter((v) => v.key.trim()).map((v) => ({ key: v.key.trim(), value: v.value ?? "" })),
        }))
        .filter((s) => s.variables.length > 0 || s.name.trim() || s.description.trim());
      const { error } = await supabase.from("test_plans").update({ variables: clean as any }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Variable sets saved");
      qc.invalidateQueries({ queryKey: ["test-plan", id] });
    },
    onError: (e: any) => toast.error(e.message || "Save failed"),
  });

  const { data: impWorkspaces = [] } = useQuery({
    queryKey: ["plan-import-workspaces"],
    enabled: importOpen,
    queryFn: async () => (await supabase.from("workspaces").select("id, name").order("name")).data || [],
  });
  const { data: impProjects = [] } = useQuery({
    queryKey: ["plan-import-projects", impWs],
    enabled: importOpen && !!impWs,
    queryFn: async () => (await supabase.from("projects").select("id, name").eq("workspace_id", impWs).order("name")).data || [],
  });
  const { data: impPlans = [] } = useQuery({
    queryKey: ["plan-import-plans", impProj],
    enabled: importOpen && !!impProj,
    queryFn: async () => (await supabase.from("test_plans").select("id, name, variables").eq("project_id", impProj).order("name")).data || [],
  });

  const doImport = () => {
    const src: any = impPlans.find((p: any) => p.id === impPlan);
    const arr = Array.isArray(src?.variables) ? src.variables : [];
    if (!arr.length) { toast.error("Selected plan has no variables"); return; }
    const isNewShape = arr.every((r: any) => r && Array.isArray(r.variables));
    const imported: PlanVarSet[] = isNewShape
      ? arr.map((s: any) => ({
          id: crypto?.randomUUID?.() ?? String(Math.random()),
          name: String(s.name || "Imported Set"),
          description: String(s.description || ""),
          variables: (s.variables || []).map((v: any) => ({ key: String(v.key ?? ""), value: String(v.value ?? "") })),
        }))
      : [{
          id: crypto?.randomUUID?.() ?? String(Math.random()),
          name: `Imported from ${src?.name || "plan"}`,
          description: "",
          variables: arr.map((v: any) => ({ key: String(v.key ?? ""), value: String(v.value ?? "") })),
        }];
    setVarSets((prev) => [...prev, ...imported]);
    const total = imported.reduce((n, s) => n + s.variables.length, 0);
    toast.success(`Imported ${imported.length} set(s) · ${total} variable(s)`);
    setImportOpen(false); setImpWs(""); setImpProj(""); setImpPlan("");
  };


  const generate = useMutation({
    mutationFn: async () => {
      await supabase.from("test_plans").update({ ai_status: "running" }).eq("id", id!);
      // Fire-and-forget: edge function returns 202 immediately and runs in background.
      // Don't await — even if the user navigates away, the server keeps processing.
      const { error } = await supabase.functions.invoke("generate-test-plan-from-docs", {
        body: { test_plan_id: id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("AI generation started — running in the background");
      qc.invalidateQueries({ queryKey: ["test-plan", id] });
    },
    onError: (e: any) => toast.error(e.message || "Generation failed to start"),
  });

  // Realtime: keep versions, executions, suite runs fresh for this plan
  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`tp-detail-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "test_plan_versions", filter: `test_plan_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["test-plan-versions", id] });
        qc.invalidateQueries({ queryKey: ["test-plan", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "test_executions", filter: `test_plan_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["test-plan-executions", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "suite_runs", filter: `test_plan_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["test-plan-suite-runs", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "defects", filter: `test_plan_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["plan-defects", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);


  useEffect(() => {
    if (plan?.ai_status === "ready" || plan?.ai_status === "failed") {
      qc.invalidateQueries({ queryKey: ["test-plan-cases", id] });
      qc.invalidateQueries({ queryKey: ["test-plan-versions", id] });
    }
  }, [plan?.ai_status, id, qc]);

  const saveCase = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Title is required");
      const priorityNum = parseInt(form.priority, 10) || 2;
      const tags = [form.type];

      if (editingCase) {
        const { error } = await supabase
          .from("test_cases")
          .update({
            title: form.title,
            description: form.description || null,
            expected_result: form.expected_result || null,
            priority: priorityNum,
            coverage_tags: tags,
          })
          .eq("id", editingCase.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from("test_cases")
          .insert({
            title: form.title,
            description: form.description || null,
            expected_result: form.expected_result || null,
            priority: priorityNum,
            status: "draft",
            ai_generated: false,
            coverage_tags: tags,
            created_by: user?.id,
            workspace_id: plan!.workspace_id || workspaceId,
            project_id: plan!.project_id || projectId,
          })
          .select("id")
          .single();
        if (error) throw error;
        await supabase.from("test_plan_test_cases").insert({
          test_plan_id: id!,
          test_case_id: inserted!.id,
          added_by: user?.id,
        });
      }
    },
    onSuccess: () => {
      toast.success(editingCase ? "Test case updated" : "Test case added");
      setCaseDialogOpen(false);
      setEditingCase(null);
      setForm({ title: "", description: "", priority: "2", type: "functional", expected_result: "" });
      qc.invalidateQueries({ queryKey: ["test-plan-cases", id] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to save"),
  });

  const removeCase = useMutation({
    mutationFn: async ({ linkId, caseId }: { linkId: string; caseId: string }) => {
      await supabase.from("test_plan_test_cases").delete().eq("id", linkId);
      await supabase.from("test_cases").delete().eq("id", caseId);
    },
    onSuccess: () => {
      toast.success("Test case removed");
      setDeletingCase(null);
      qc.invalidateQueries({ queryKey: ["test-plan-cases", id] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete"),
  });

  const openCreate = () => {
    setEditingCase(null);
    setForm({ title: "", description: "", priority: "2", type: "functional", expected_result: "" });
    setCaseDialogOpen(true);
  };
  const openEdit = (tc: any) => {
    setEditingCase(tc);
    setForm({
      title: tc.title || "",
      description: tc.description || "",
      priority: String(tc.priority || 2),
      type: inferType(tc),
      expected_result: tc.expected_result || "",
    });
    setCaseDialogOpen(true);
  };

  if (isLoading || !plan) {
    return <AppLayout><div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  const passed = executions.filter((e: any) => e.status === "passed").length;
  const failed = executions.filter((e: any) => e.status === "failed").length;
  const passRate = executions.length ? Math.round((passed / executions.length) * 100) : 0;

  const aiStatusVariant = plan.ai_status === "ready" ? "success" : plan.ai_status === "running" ? "info" : plan.ai_status === "failed" ? "destructive" : "muted";

  // Group cases by type
  const groups: Record<string, any[]> = {};
  testCases.forEach((row: any) => {
    const tc = row.test_case;
    if (!tc) return;
    const t = inferType(tc);
    if (!groups[t]) groups[t] = [];
    groups[t].push({ link: row, tc });
  });
  const groupedTypes = Object.keys(groups).sort();


  return (
    <AppLayout>
      <div className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/test-plans")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Test Plans
        </Button>
      </div>

      <PageHeader
        title={plan.name}
        description={plan.description || "No description provided"}
        isAIPowered={!!plan.ai_suggested}
        actions={
          <Button
            className="ai-gradient text-white"
            onClick={() => setTab("workbench")}
          >
            <Sparkles className="mr-2 h-4 w-4" /> Generate with AI
          </Button>
        }
      />

      {genJob && (genJob.status === "queued" || genJob.status === "running" || genJob.status === "retrying" || genJob.status === "waiting") && (
        <Card className="mb-4 border-accent/40">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2 gap-3">
              <div className="text-sm font-medium flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                Generating test cases — {genJob.progress_message || genJob.status}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  attempt {genJob.attempt_count}/{genJob.max_attempts} · {genJob.progress}%
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!confirm("Cancel this generation? The remote Doc Generator job will be terminated safely.")) return;
                    const { error } = await supabase.functions.invoke("cancel-test-plan-job", {
                      body: { job_id: genJob.id, reason: "Cancelled from Test Plan UI" },
                    });
                    if (error) toast.error(error.message);
                    else {
                      toast.success("Generation cancelled");
                      qc.invalidateQueries({ queryKey: ["test-plan", id] });
                    }
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
            <Progress value={genJob.progress} />
            <p className="text-[11px] text-muted-foreground mt-2">
              You can safely navigate away — generation continues in the background.
            </p>
          </CardContent>
        </Card>
      )}
      {genJob && (genJob.status === "dead_letter" || genJob.status === "failed") && (
        <Card className="mb-4 border-destructive/50">
          <CardContent className="pt-5">
            <div className="text-sm font-medium text-destructive">
              Generation failed: {genJob.error?.message || "unknown error"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {genJob.status === "dead_letter"
                ? `Exhausted ${genJob.max_attempts} attempts.`
                : "Will retry automatically."}
            </p>
          </CardContent>
        </Card>
      )}


      {/* KPI Strip */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Status</span>
              <ListChecks className="h-4 w-4 text-accent" />
            </div>
            <StatusBadge variant={plan.status === "active" ? "success" : plan.status === "draft" ? "warning" : "muted"}>
              {plan.status}
            </StatusBadge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">AI Status</span>
              <Sparkles className="h-4 w-4 text-accent" />
            </div>
            <StatusBadge variant={aiStatusVariant as any}>{plan.ai_status || "idle"}</StatusBadge>
            {plan.ai_last_run_at && (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                last run {format(new Date(plan.ai_last_run_at), "MMM d, HH:mm")}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Test Cases</span>
              <Target className="h-4 w-4 text-accent" />
            </div>
            <p className="text-2xl font-bold">{testCases.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Runs</span>
              <Activity className="h-4 w-4 text-accent" />
            </div>
            <p className="text-2xl font-bold">{executions.length}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              <span className="text-green-400">{passed} passed</span> · <span className="text-red-400">{failed} failed</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Pass Rate</span>
              <CheckCircle2 className="h-4 w-4 text-accent" />
            </div>
            <p className="text-2xl font-bold">{passRate}%</p>
            <Progress value={passRate} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
      </motion.div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="mb-6 flex justify-center sm:justify-start">
          <TabsList className="relative inline-flex h-auto flex-wrap items-center gap-1 rounded-2xl border border-accent/20 bg-gradient-to-br from-card/80 via-card/50 to-background/40 p-1.5 backdrop-blur-xl shadow-[0_8px_40px_-12px_rgba(0,207,224,0.35)]">
            {[
              { v: "overview", l: "Overview", i: FileText },
              { v: "workbench", l: "AI Workbench", i: Sparkles },
              { v: "people", l: "People", i: Users },
              { v: "insights", l: "Insights", i: Gauge },
              { v: "operations", l: "Operations", i: Zap },
            ].map((t) => (
              <TabsTrigger
                key={t.v}
                value={t.v}
                className="group relative overflow-hidden rounded-xl px-5 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-300 hover:text-foreground data-[state=active]:text-white data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:shadow-[0_4px_24px_-4px_hsl(var(--accent)/0.55)] data-[state=active]:scale-[1.03]"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <t.i className="h-4 w-4 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 group-data-[state=active]:drop-shadow-[0_0_6px_rgba(255,255,255,0.7)]" />
                  {t.l}
                </span>
                <span className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br from-accent/0 via-accent/10 to-primary/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-data-[state=active]:opacity-0" />
                <span className="pointer-events-none absolute -bottom-8 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full bg-accent/40 opacity-0 blur-2xl transition-opacity duration-500 group-data-[state=active]:opacity-100" />
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ============== OVERVIEW ============== */}
        <TabsContent value="overview" className="space-y-4 animate-fade-in">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader><CardTitle>Plan Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Objective</p>
                  <p className="text-sm">{plan.objective || "Not specified"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Scope</p>
                  <p className="text-sm">{plan.scope || "Not specified"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Description</p>
                  <p className="text-sm">{plan.description || "—"}</p>
                </div>
                <div className="flex gap-6 pt-2 border-t">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Created by</p>
                    <p className="text-sm">{plan.creator?.name || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
                    <p className="text-sm">{format(new Date(plan.created_at), "MMM d, yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Version</p>
                    <p className="text-sm">v{plan.current_version}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Assignees</CardTitle>
              </CardHeader>
              <CardContent>
                {assignees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No assignees yet</p>
                ) : (
                  <div className="space-y-3">
                    {assignees.map((a: any) => (
                      <div key={a.id} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{(a.user?.name || "?").charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{a.user?.name || a.user?.email}</p>
                          <p className="text-xs text-muted-foreground">{a.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" />Source Documents</CardTitle>
              <CardDescription>Documents used to generate test cases</CardDescription>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents attached</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {documents.map((d: any) => (
                    <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                      <FileText className="h-4 w-4 text-accent" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{d.document?.name || d.document?.filename}</p>
                        <p className="text-xs text-muted-foreground">{d.document?.mime_type || "—"}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">{d.document?.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Collapsible: Requirements */}
          <Collapsible open={openReq} onOpenChange={setOpenReq}>
            <Card className="overflow-hidden transition-all hover:border-accent/40">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-accent/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <CardTitle className="text-base">Requirements</CardTitle>
                      <CardDescription>Traceability from requirements to this plan</CardDescription>
                    </div>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${openReq ? "rotate-180" : ""}`} />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
                <CardContent className="pt-0">
                  {plan?.project_id && <PlanRequirementsPanel projectId={plan.project_id} workspaceId={plan.workspace_id} />}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Collapsible: Variables */}
          <Collapsible open={openVars} onOpenChange={setOpenVars}>
            <Card className="overflow-hidden transition-all hover:border-accent/40">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-accent/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                      <Variable className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <CardTitle className="text-base flex items-center gap-2">
                        Variables
                        <Badge variant="secondary" className="text-[10px]">{vars.filter((v) => v.key.trim()).length}</Badge>
                      </CardTitle>
                      <CardDescription>Dynamic key/value pairs available to every case & execution</CardDescription>
                    </div>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${openVars ? "rotate-180" : ""}`} />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
                <CardContent className="pt-0 space-y-4">
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setImportOpen((v) => !v)} className="gap-1.5">
                      <Download className="h-4 w-4" /> Import
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setVars((p) => [...p, { key: "", value: "" }])} className="gap-1.5">
                      <Plus className="h-4 w-4" /> Add
                    </Button>
                    <Button size="sm" onClick={() => saveVars.mutate()} disabled={saveVars.isPending} className="gap-1.5">
                      {saveVars.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save
                    </Button>
                  </div>
                  {importOpen && (
                    <div className="rounded-lg border border-accent/40 bg-accent/5 p-4 space-y-3">
                      <p className="text-xs font-mono tracking-wider text-accent uppercase">Import variables from another plan</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <Select value={impWs} onValueChange={(v) => { setImpWs(v); setImpProj(""); setImpPlan(""); }}>
                          <SelectTrigger><SelectValue placeholder="Workspace…" /></SelectTrigger>
                          <SelectContent>{impWorkspaces.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={impProj} onValueChange={(v) => { setImpProj(v); setImpPlan(""); }} disabled={!impWs}>
                          <SelectTrigger><SelectValue placeholder="Project…" /></SelectTrigger>
                          <SelectContent>{impProjects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={impPlan} onValueChange={setImpPlan} disabled={!impProj}>
                          <SelectTrigger><SelectValue placeholder="Test Plan…" /></SelectTrigger>
                          <SelectContent>{impPlans.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({Array.isArray(p.variables) ? p.variables.length : 0})</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setImportOpen(false)}>Cancel</Button>
                        <Button size="sm" onClick={doImport} disabled={!impPlan}>Import Variables</Button>
                      </div>
                    </div>
                  )}
                  {vars.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No variables yet — click "Add" or import from another plan.</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-1 text-xs uppercase tracking-wider text-muted-foreground">
                        <span>Key</span><span>Value</span><span className="w-9" />
                      </div>
                      {vars.map((v, i) => (
                        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                          <Input value={v.key} placeholder="BASE_URL"
                            onChange={(e) => setVars((p) => p.map((x, idx) => idx === i ? { ...x, key: e.target.value } : x))} />
                          <Input value={v.value} placeholder="https://api.example.com"
                            onChange={(e) => setVars((p) => p.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))} />
                          <Button variant="ghost" size="icon" onClick={() => setVars((p) => p.filter((_, idx) => idx !== i))}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Collapsible: Plan-level Documents (dynamic list) */}
          <Collapsible open={openDocs} onOpenChange={setOpenDocs}>
            <Card className="overflow-hidden transition-all hover:border-accent/40">
              <CollapsibleTrigger className="w-full">
                <CardHeader className="flex flex-row items-center justify-between cursor-pointer hover:bg-accent/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent">
                      <FolderOpen className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <CardTitle className="text-base flex items-center gap-2">
                        Plan Documents
                        <Badge variant="secondary" className="text-[10px]">{planDocs.length}</Badge>
                      </CardTitle>
                      <CardDescription>Reference docs, links, and specs owned by this test plan</CardDescription>
                    </div>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${openDocs ? "rotate-180" : ""}`} />
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent className="data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up overflow-hidden">
                <CardContent className="pt-0 space-y-3">
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        updatePlanDocs((prev) => [
                          ...prev,
                          { id: (crypto?.randomUUID?.() ?? String(Math.random())), name: "", url: "", description: "" },
                        ]);
                      }}
                    >
                      <Plus className="h-4 w-4" /> Add Document
                    </Button>
                  </div>
                  {planDocs.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      <FolderOpen className="mx-auto h-8 w-8 mb-2 opacity-50" />
                      <p className="text-sm">No plan-level documents yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {planDocs.map((d) => (
                        <div key={d.id} className="rounded-lg border bg-card/60 p-3 space-y-2 hover:border-accent/40 transition-colors">
                          <div className="grid gap-2 md:grid-cols-[1fr_1.4fr_auto]">
                            <Input
                              placeholder="Name (e.g. API Spec)"
                              value={d.name}
                              onChange={(e) => updatePlanDocs((prev) => prev.map((x) => x.id === d.id ? { ...x, name: e.target.value } : x))}
                            />
                            <Input
                              placeholder="https://…"
                              value={d.url}
                              onChange={(e) => updatePlanDocs((prev) => prev.map((x) => x.id === d.id ? { ...x, url: e.target.value } : x))}
                            />
                            <div className="flex items-center gap-1">
                              {d.url && (
                                <Button asChild variant="ghost" size="icon" className="h-9 w-9">
                                  <a href={d.url} target="_blank" rel="noreferrer" aria-label="Open">
                                    <ExternalLink className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => updatePlanDocs((prev) => prev.filter((x) => x.id !== d.id))}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          <Textarea
                            rows={2}
                            placeholder="Notes (optional)"
                            value={d.description}
                            onChange={(e) => updatePlanDocs((prev) => prev.map((x) => x.id === d.id ? { ...x, description: e.target.value } : x))}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {savePlanDocs.isPending && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                    </p>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </TabsContent>

        {/* ============== AI WORKBENCH ============== */}
        <TabsContent value="workbench" className="animate-fade-in">
          <Tabs value={workbenchSub} onValueChange={setWorkbenchSub}>
            <TabsList className="mb-4 bg-secondary/40 backdrop-blur-sm border border-border/50">
              <TabsTrigger value="workbench" className="gap-2"><Sparkles className="h-4 w-4" />Workbench</TabsTrigger>
              <TabsTrigger value="cases" className="gap-2"><ListChecks className="h-4 w-4" />Test Cases ({testCases.length})</TabsTrigger>
              <TabsTrigger value="executions" className="gap-2"><Play className="h-4 w-4" />Executions ({executions.length + suiteRuns.length})</TabsTrigger>
              <TabsTrigger value="ai" className="gap-2"><Sparkles className="h-4 w-4" />AI Generation</TabsTrigger>
            </TabsList>

            <TabsContent value="workbench" className="animate-fade-in">
              {plan?.project_id && id ? (
                <TestPlanWorkbench testPlanId={id} projectId={plan.project_id} />
              ) : (
                <p className="text-sm text-muted-foreground">Loading workbench...</p>
              )}
            </TabsContent>

            <TabsContent value="cases" className="animate-fade-in">
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Layers className="h-4 w-4 text-accent" /> Test Cases by Type
                    </CardTitle>
                    <CardDescription>
                      {testCases.length} cases · {groupedTypes.length} type{groupedTypes.length === 1 ? "" : "s"}
                    </CardDescription>
                  </div>
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="mr-1.5 h-4 w-4" /> New Test Case
                  </Button>
                </CardHeader>
                <CardContent>
                  {testCases.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <ListChecks className="mx-auto h-10 w-10 mb-3 opacity-50" />
                      <p className="text-sm mb-3">No test cases yet. Generate with AI or add manually.</p>
                      <Button variant="outline" size="sm" onClick={openCreate}>
                        <Plus className="mr-1.5 h-4 w-4" /> Add first case
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {groupedTypes.map((type) => (
                        <div key={type}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="h-2 w-2 rounded-full bg-accent" />
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">{type}</h3>
                            <span className="text-xs text-muted-foreground">({groups[type].length})</span>
                            <div className="flex-1 h-px bg-border ml-2" />
                          </div>
                          <div className="space-y-2">
                            {groups[type].map(({ link, tc }) => (
                              <div key={link.id} className="group flex items-start justify-between gap-3 p-3 rounded-lg border bg-card hover:border-accent/40 transition-colors">
                                <Link to={`/test-cases/${tc.id}/edit?planId=${id}`} className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-sm font-medium truncate">{tc.title}</p>
                                    {tc.ai_generated && <Sparkles className="h-3 w-3 text-accent shrink-0" />}
                                  </div>
                                  {tc.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2">{tc.description}</p>
                                  )}
                                  {tc.coverage_tags?.length > 1 && (
                                    <div className="flex gap-1 mt-1.5 flex-wrap">
                                      {tc.coverage_tags.slice(1, 5).map((t: string, i: number) => (
                                        <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>
                                      ))}
                                    </div>
                                  )}
                                </Link>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <StatusBadge variant={tc.status === "approved" ? "success" : tc.status === "draft" ? "warning" : "muted"} size="sm">
                                    {tc.status}
                                  </StatusBadge>
                                  <Badge variant="outline" className="text-xs">P{tc.priority}</Badge>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(tc)} aria-label="Edit">
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive" onClick={() => setDeletingCase({ linkId: link.id, caseId: tc.id, title: tc.title })} aria-label="Delete">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="executions" className="space-y-4 animate-fade-in">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Layers className="h-4 w-4" />Suite Runs</CardTitle>
                  <CardDescription>Live runs dispatched from the Workbench (Playwright suites)</CardDescription>
                </CardHeader>
                <CardContent>
                  {suiteRuns.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No suite runs yet — dispatch one from the Workbench sub-tab.</p>
                  ) : (
                    <div className="space-y-2">
                      {suiteRuns.map((s: any) => {
                        const pct = s.total_specs ? Math.round(((s.completed_specs || 0) / s.total_specs) * 100) : 0;
                        const variant = s.status === "succeeded" ? "success" : s.status === "failed" ? "destructive" : s.status === "running" ? "info" : "warning";
                        return (
                          <div key={s.id} className="p-3 rounded-lg border bg-card">
                            <div className="flex items-center justify-between gap-3 mb-1.5">
                              <div className="flex items-center gap-2">
                                <StatusBadge variant={variant as any} size="sm">{s.status}</StatusBadge>
                                <span className="text-xs text-muted-foreground">{format(new Date(s.created_at), "MMM d, HH:mm")}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {s.passed_specs || 0}✓ · {s.failed_specs || 0}✗ · {s.total_specs || 0} total
                              </span>
                            </div>
                            <Progress value={pct} className="h-1.5" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" />Individual Test Executions</CardTitle>
                  <CardDescription>Manual or per-case runs for this plan</CardDescription>
                </CardHeader>
                <CardContent>
                  {executions.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground">
                      <Play className="mx-auto h-10 w-10 mb-3 opacity-50" />
                      <p className="text-sm">No individual executions yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {executions.map((e: any) => (
                        <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                          <div className="flex items-center gap-3 min-w-0">
                            <StatusBadge variant={e.status === "passed" ? "success" : e.status === "failed" ? "destructive" : "warning"} size="sm">
                              {e.status}
                            </StatusBadge>
                            <div className="min-w-0">
                              <p className="text-sm truncate">{e.case?.title || "—"}</p>
                              <p className="text-xs text-muted-foreground">
                                {e.environment || "default"} · {e.executor?.name || "unknown"}
                              </p>
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 shrink-0">
                            <Clock className="h-3 w-3" />
                            {e.started_at ? format(new Date(e.started_at), "MMM d, HH:mm") : "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ai" className="animate-fade-in">
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="h-4 w-4 text-accent" /> AI Generation
                    </CardTitle>
                    <CardDescription>
                      Generate test cases automatically from the attached documents using Lovable AI.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border bg-secondary/30 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Pipeline Status</span>
                        <StatusBadge variant={aiStatusVariant as any}>{plan.ai_status || "idle"}</StatusBadge>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div>
                          <p className="text-xl font-bold">{documents.length}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sources</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold">{testCases.filter((c: any) => c.test_case?.ai_generated).length}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">AI Cases</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold">v{plan.current_version}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Version</p>
                        </div>
                      </div>
                    </div>
                    <Button className="ai-gradient text-white w-full" onClick={() => generate.mutate()} disabled={generate.isPending || plan.ai_status === "running"}>
                      {generate.isPending || plan.ai_status === "running" ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Running…</>
                      ) : (
                        <><Sparkles className="mr-2 h-4 w-4" /> {testCases.length > 0 ? "Regenerate" : "Generate"} Test Cases</>
                      )}
                    </Button>
                    {documents.length === 0 && (
                      <p className="text-xs text-amber-400">No documents attached — AI will infer from name/description only.</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">How it works</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex gap-2"><span className="text-accent font-mono">1.</span> Reads attached documents.</div>
                    <div className="flex gap-2"><span className="text-accent font-mono">2.</span> Extracts requirements & scenarios.</div>
                    <div className="flex gap-2"><span className="text-accent font-mono">3.</span> Generates structured test cases.</div>
                    <div className="flex gap-2"><span className="text-accent font-mono">4.</span> Snapshots a new version.</div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ============== PEOPLE ============== */}
        <TabsContent value="people" className="animate-fade-in">
          <PlanPeoplePanel
            planId={id!}
            projectId={(plan as any).project_id ?? null}
            workspaceId={(plan as any).workspace_id ?? null}
          />
        </TabsContent>

        {/* ============== INSIGHTS ============== */}
        <TabsContent value="insights" className="animate-fade-in">
          <Tabs value={insightsSub} onValueChange={setInsightsSub}>
            <TabsList className="mb-4 bg-secondary/40 backdrop-blur-sm border border-border/50">
              <TabsTrigger value="versions" className="gap-2"><GitBranch className="h-4 w-4" />Versions ({versions.length})</TabsTrigger>
              <TabsTrigger value="runners" className="gap-2"><Server className="h-4 w-4" />Runners</TabsTrigger>
              <TabsTrigger value="reports" className="gap-2"><BarChart3 className="h-4 w-4" />Reports</TabsTrigger>
            </TabsList>
            <TabsContent value="versions" className="animate-fade-in">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4" />Version History</CardTitle>
                </CardHeader>
                <CardContent>
                  {versions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No versions recorded yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {versions.map((v: any) => (
                        <div key={v.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-accent text-xs font-bold shrink-0">
                            v{v.version}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{v.change_summary || "Snapshot"}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {v.creator?.name || "system"} · {format(new Date(v.created_at), "MMM d, yyyy HH:mm")}
                            </p>
                          </div>
                          {v.version === plan.current_version && (
                            <Badge variant="default" className="text-xs">current</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="runners" className="animate-fade-in">
              {plan?.project_id && <PlanRunnersPanel projectId={plan.project_id} workspaceId={plan.workspace_id} />}
            </TabsContent>
            <TabsContent value="reports" className="animate-fade-in">
              {id && plan?.project_id && <PlanReportsPanel testPlanId={id} projectId={plan.project_id} />}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ============== OPERATIONS ============== */}
        <TabsContent value="operations" className="animate-fade-in">
          <Tabs value={opsSub} onValueChange={setOpsSub}>
            <TabsList className="mb-4 bg-secondary/40 backdrop-blur-sm border border-border/50">
              <TabsTrigger value="defects" className="gap-2"><Bug className="h-4 w-4" />Defects</TabsTrigger>
              <TabsTrigger value="gates" className="gap-2"><ShieldCheck className="h-4 w-4" />Quality Gates</TabsTrigger>
              <TabsTrigger value="live" className="gap-2"><Radio className="h-4 w-4" />Live</TabsTrigger>
            </TabsList>
            <TabsContent value="defects" className="animate-fade-in">
              {id && <PlanDefectsPanel testPlanId={id} projectId={plan.project_id} workspaceId={plan.workspace_id} />}
            </TabsContent>
            <TabsContent value="gates" className="animate-fade-in">
              {plan?.project_id && <PlanQualityGatesPanel projectId={plan.project_id} workspaceId={plan.workspace_id} />}
            </TabsContent>
            <TabsContent value="live" className="animate-fade-in">
              {id && <PlanLivePanel testPlanId={id} />}
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* Create / Edit case dialog */}
      <Dialog open={caseDialogOpen} onOpenChange={(o) => { setCaseDialogOpen(o); if (!o) setEditingCase(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCase ? "Edit Test Case" : "New Test Case"}</DialogTitle>
            <DialogDescription>
              {editingCase ? "Update the test case details." : "Add a new test case to this plan."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. User can reset password" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="What does this case verify?" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as TestType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEST_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">P1 — High</SelectItem>
                    <SelectItem value="2">P2 — Medium</SelectItem>
                    <SelectItem value="3">P3 — Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Expected Result</Label>
              <Textarea value={form.expected_result} onChange={(e) => setForm({ ...form, expected_result: e.target.value })} rows={2} placeholder="What should happen?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCaseDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveCase.mutate()} disabled={saveCase.isPending}>
              {saveCase.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editingCase ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deletingCase} onOpenChange={(o) => !o && setDeletingCase(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete test case?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingCase?.title}" from the plan. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingCase && removeCase.mutate({ linkId: deletingCase.linkId, caseId: deletingCase.caseId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

