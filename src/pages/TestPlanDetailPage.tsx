import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft, Sparkles, Loader2, FileText, Users, GitBranch, Play,
  CheckCircle2, ListChecks, Clock, Target, History, Activity, RefreshCw,
} from "lucide-react";
import { format } from "date-fns";

export default function TestPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");

  const { data: plan, isLoading } = useQuery({
    queryKey: ["test-plan", id],
    enabled: !!id,
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
        .select("id, document:documents!test_plan_documents_document_id_fkey(id, name, filename, mime_type, status, created_at)")
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

  const generate = useMutation({
    mutationFn: async () => {
      await supabase.from("test_plans").update({ ai_status: "running" }).eq("id", id!);
      const { error } = await supabase.functions.invoke("generate-test-plan-from-docs", {
        body: { test_plan_id: id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("AI generation complete");
      qc.invalidateQueries({ queryKey: ["test-plan", id] });
      qc.invalidateQueries({ queryKey: ["test-plan-cases", id] });
      qc.invalidateQueries({ queryKey: ["test-plan-versions", id] });
    },
    onError: (e: any) => toast.error(e.message || "Generation failed"),
  });

  if (isLoading || !plan) {
    return <AppLayout><div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></AppLayout>;
  }

  const passed = executions.filter((e: any) => e.status === "passed").length;
  const failed = executions.filter((e: any) => e.status === "failed").length;
  const passRate = executions.length ? Math.round((passed / executions.length) * 100) : 0;

  const aiStatusVariant = plan.ai_status === "ready" ? "success" : plan.ai_status === "running" ? "info" : plan.ai_status === "failed" ? "destructive" : "muted";

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
            onClick={() => generate.mutate()}
            disabled={generate.isPending || plan.ai_status === "running"}
          >
            {generate.isPending || plan.ai_status === "running" ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" /> Generate with AI</>
            )}
          </Button>
        }
      />

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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview"><FileText className="mr-2 h-4 w-4" />Overview</TabsTrigger>
          <TabsTrigger value="cases"><ListChecks className="mr-2 h-4 w-4" />Test Cases ({testCases.length})</TabsTrigger>
          <TabsTrigger value="ai"><Sparkles className="mr-2 h-4 w-4" />AI Generation</TabsTrigger>
          <TabsTrigger value="versions"><GitBranch className="mr-2 h-4 w-4" />Versions ({versions.length})</TabsTrigger>
          <TabsTrigger value="executions"><Play className="mr-2 h-4 w-4" />Executions ({executions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
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
        </TabsContent>

        <TabsContent value="cases">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Test Cases in this Plan</CardTitle>
              <CardDescription>{testCases.length} test cases linked</CardDescription>
            </CardHeader>
            <CardContent>
              {testCases.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <ListChecks className="mx-auto h-10 w-10 mb-3 opacity-50" />
                  <p className="text-sm">No test cases yet. Generate with AI or add manually.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {testCases.map((row: any) => {
                    const tc = row.test_case;
                    if (!tc) return null;
                    return (
                      <Link key={row.id} to={`/test-cases/${tc.id}/edit`}
                        className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-secondary/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium truncate">{tc.title}</p>
                            {tc.ai_generated && <Sparkles className="h-3 w-3 text-accent shrink-0" />}
                          </div>
                          {tc.description && <p className="text-xs text-muted-foreground line-clamp-1">{tc.description}</p>}
                          {tc.coverage_tags?.length > 0 && (
                            <div className="flex gap-1 mt-1.5">
                              {tc.coverage_tags.slice(0, 4).map((t: string, i: number) => (
                                <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-3 shrink-0">
                          <StatusBadge variant={tc.status === "approved" ? "success" : tc.status === "draft" ? "warning" : "muted"} size="sm">
                            {tc.status}
                          </StatusBadge>
                          <Badge variant="outline" className="text-xs">P{tc.priority}</Badge>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai">
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
                <Button
                  className="ai-gradient text-white w-full"
                  onClick={() => generate.mutate()}
                  disabled={generate.isPending || plan.ai_status === "running"}
                >
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

        <TabsContent value="versions">
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

        <TabsContent value="executions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" />Recent Runs</CardTitle>
              <CardDescription>Test executions for this plan</CardDescription>
            </CardHeader>
            <CardContent>
              {executions.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Play className="mx-auto h-10 w-10 mb-3 opacity-50" />
                  <p className="text-sm">No executions yet</p>
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
      </Tabs>
    </AppLayout>
  );
}
