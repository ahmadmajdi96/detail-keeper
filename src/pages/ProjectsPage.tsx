import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectWizard } from "@/components/projects/ProjectWizard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatFilterCards } from "@/components/ui/stat-filter-cards";
import {
  ArrowLeft, ArrowRight, ChevronRight, Clock, FileArchive, FileText, FolderOpen,
  Github, LayoutGrid, List, Loader2, Plus, RefreshCw, Search, Trash2,
  CheckCircle2, AlertCircle, Loader, Zap, Network, FlaskConical,
} from "lucide-react";
import { toast } from "sonner";

const SOURCE_ICON: Record<string, any> = {
  documentation: FileText,
  zip: FileArchive,
  github: Github,
};

const STATUS_META: Record<string, { label: string; cls: string; icon: any; color: string }> = {
  ready:      { label: "Ready",      cls: "bg-success/10 text-success border-success/20",          icon: CheckCircle2, color: "hsl(var(--success))" },
  processing: { label: "Processing", cls: "bg-warning/10 text-warning border-warning/20",          icon: Loader,       color: "hsl(var(--warning))" },
  pending:    { label: "Pending",    cls: "bg-muted text-muted-foreground border-border",          icon: Clock,        color: "hsl(var(--muted-foreground))" },
  failed:     { label: "Failed",     cls: "bg-destructive/10 text-destructive border-destructive/20", icon: AlertCircle, color: "hsl(var(--destructive))" },
  archived:   { label: "Archived",   cls: "bg-muted text-muted-foreground border-border",          icon: Clock,        color: "hsl(var(--muted-foreground))" },
};

export default function ProjectsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const canManageProjects = hasPermission("qa_manager");
  const { currentWorkspace, setCurrentProjectId, refresh } = useWorkspace();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | string>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [wizardOpen, setWizardOpen] = useState(params.get("new") === "1");

  useEffect(() => {
    if (params.get("new") === "1") {
      setWizardOpen(true);
      params.delete("new");
      setParams(params);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return [];
      const { data } = await supabase
        .from("projects").select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!currentWorkspace,
  });

  const reprocess = useMutation({
    mutationFn: async (p: any) => {
      await supabase.from("projects").update({ status: "processing", process_error: null }).eq("id", p.id);
      if (p.source_type === "github") {
        await supabase.functions.invoke("ingest-github", {
          body: { project_id: p.id, url: p.github_url, branch: p.github_branch, token: p.github_token_secret_name },
        });
      } else if (p.source_type === "zip") {
        await supabase.functions.invoke("ingest-zip", { body: { project_id: p.id } });
      }
    },
    onSuccess: () => {
      toast.success("Reprocessing started");
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project deleted");
      qc.invalidateQueries({ queryKey: ["projects"] });
      refresh();
    },
  });

  const stats = useMemo(() => {
    const t = projects.length || 0;
    const ready = projects.filter((p: any) => p.status === "ready").length;
    const proc = projects.filter((p: any) => p.status === "processing").length;
    const failed = projects.filter((p: any) => p.status === "failed").length;
    const endpoints = projects.reduce((s: number, p: any) => s + (p.endpoints_count || 0), 0);
    const tests = projects.reduce((s: number, p: any) => s + (p.test_cases_count || 0), 0);
    return { t, ready, proc, failed, endpoints, tests };
  }, [projects]);

  const visible = projects.filter((p: any) => {
    if (filter !== "all" && p.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
    }
    return true;
  });

  if (!currentWorkspace) {
    return (
      <AppLayout>
        <PageHeader title="Projects" description="Select a workspace to view its projects" />
        <Card className="border-border/50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Choose a workspace from the top bar to view projects.
            </p>
            <Button variant="outline" onClick={() => navigate("/workspaces")}>
              Browse workspaces
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Projects"
        description={`All projects in ${currentWorkspace.name}`}
        breadcrumbs={[
          { label: "Workspaces", href: "/workspaces" },
          { label: currentWorkspace.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/workspaces")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            {canManageProjects && (
              <Button onClick={() => setWizardOpen(true)} className="ai-gradient text-white">
                <Plus className="h-4 w-4 mr-2" /> New project
              </Button>
            )}
          </div>
        }

      />


      {/* KPI row */}
      <StatFilterCards
        activeFilter={filter}
        onSelect={(k) => setFilter(k as any)}
        cards={[
          { key: "all", label: "Projects", value: stats.t, hint: "All statuses", icon: FolderOpen, grad: "from-accent/20 to-transparent" },
          { key: "ready", label: "Ready", value: stats.ready, hint: "Processed", icon: CheckCircle2, grad: "from-success/20 to-transparent" },
          { key: "processing", label: "Processing", value: stats.proc, hint: "In progress", icon: Loader, grad: "from-warning/20 to-transparent" },
          { key: "failed", label: "Failed", value: stats.failed, hint: "Needs attention", icon: AlertCircle, grad: "from-destructive/20 to-transparent" },
          { key: "all", label: "Endpoints", value: stats.endpoints, hint: "Discovered APIs", icon: Network, grad: "from-cyan-500/20 to-transparent" },
          { key: "all", label: "Test cases", value: stats.tests, hint: "Across projects", icon: FlaskConical, grad: "from-purple-500/20 to-transparent" },
        ]}
      />

      {/* Toolbar */}
      <Card className="mt-6 border-border/50">
        <CardContent className="p-3 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {(["all", "ready", "processing", "pending", "failed"] as const).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "secondary" : "ghost"}
                size="sm"
                className="h-8"
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : STATUS_META[f].label}
              </Button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1 border border-border rounded-md p-0.5">
            {([["grid", LayoutGrid], ["list", List]] as const).map(([m, Icon]) => (
              <Button
                key={m} variant={view === m ? "secondary" : "ghost"} size="sm"
                className="h-7 w-7 p-0" onClick={() => setView(m as any)}
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Body */}
      <div className="mt-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        ) : visible.length === 0 ? (
          <Card className="border-border/50 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {search || filter !== "all" ? "No projects match your filters" : "No projects yet"}
              </p>
              {!search && filter === "all" && (
                <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Create first project
                </Button>
              )}
            </CardContent>
          </Card>
        ) : view === "grid" ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((p: any, pi: number) => {
              const sm = STATUS_META[p.status] ?? STATUS_META.pending;
              const StatusIcon = sm.icon;
              const Icon = SOURCE_ICON[p.source_type] ?? FileText;
              const totalTests = p.test_cases_count || 0;
              const passed = p.passed_count || 0;
              const defects = p.defects_count || 0;
              const progress = p.progress ?? (totalTests ? Math.round((passed / totalTests) * 100) : 0);
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: pi * 0.04 }}
                >
                  <Card
                    className="border-border/50 hover:border-accent/40 hover:shadow-elevated transition-all cursor-pointer group relative overflow-hidden"
                    onClick={() => {
                      setCurrentProjectId(p.id);
                      navigate(`/projects/${p.id}`);
                    }}
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{ background: `linear-gradient(90deg, ${sm.color}, transparent)` }}
                    />
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            background: `color-mix(in hsl, ${sm.color} 12%, transparent)`,
                            color: sm.color,
                          }}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {p.source_type || "doc"}
                            </Badge>
                            <Badge variant="outline" className={`gap-1 ${sm.cls}`}>
                              <StatusIcon className={`h-3 w-3 ${p.status === "processing" ? "animate-spin" : ""}`} />
                              {sm.label}
                            </Badge>
                          </div>
                          <h3 className="font-semibold text-sm truncate">{p.name}</h3>
                          {p.github_url && (
                            <a
                              href={p.github_url}
                              target="_blank" rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[11px] text-accent hover:underline flex items-center gap-1 mt-0.5 truncate"
                            >
                              <Github className="h-2.5 w-2.5" />
                              {p.github_url.replace("https://github.com/", "")}
                            </a>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 group-hover:text-accent transition-colors" />
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                        {p.description || "No description"}
                      </p>

                      {p.process_error && (
                        <p className="text-xs text-destructive line-clamp-2 px-2.5 py-1.5 rounded-md bg-destructive/10 border border-destructive/20">
                          ⚠ {p.process_error}
                        </p>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Progress</span>
                          <span className="text-xs font-medium tabular-nums" style={{ color: sm.color }}>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                      </div>

                      <div className="grid grid-cols-4 gap-2 pt-3 border-t border-border/50">
                        {[
                          { v: p.files_count || 0, l: "Files" },
                          { v: p.endpoints_count || 0, l: "Endp" },
                          { v: totalTests, l: "Tests" },
                          { v: defects, l: "Defects", color: defects > 0 ? "hsl(var(--warning))" : undefined },
                        ].map((s) => (
                          <div key={s.l} className="flex flex-col items-center">
                            <span className="text-sm font-semibold tabular-nums" style={{ color: s.color }}>{s.v}</span>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.l}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm" variant="ghost" className="h-7"
                            onClick={() => {
                              setCurrentProjectId(p.id);
                              navigate(`/projects/${p.id}`);
                            }}
                          >
                            Open <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                          <Button
                            size="sm" variant="ghost" className="h-7"
                            onClick={() => { setCurrentProjectId(p.id); navigate(`/projects/${p.id}?tab=documents`); }}
                          >
                            Documents
                          </Button>

                          {(p.source_type === "github" || p.source_type === "zip") && (
                            <Button
                              size="sm" variant="ghost" className="h-7 w-7 p-0"
                              onClick={() => reprocess.mutate(p)}
                              title="Reprocess"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {canManageProjects && (
                            <Button
                              size="sm" variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => { if (confirm(`Delete "${p.name}"?`)) del.mutate(p.id); }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}

                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <Card className="border-border/50">
            <CardContent className="p-0">
              {visible.map((p: any, i: number) => {
                const sm = STATUS_META[p.status] ?? STATUS_META.pending;
                const StatusIcon = sm.icon;
                const Icon = SOURCE_ICON[p.source_type] ?? FileText;
                const totalTests = p.test_cases_count || 0;
                const passed = p.passed_count || 0;
                const progress = p.progress ?? (totalTests ? Math.round((passed / totalTests) * 100) : 0);
                return (
                  <button
                    key={p.id}
                    onClick={() => { setCurrentProjectId(p.id); navigate(`/projects/${p.id}`); }}
                    className="w-full flex items-center gap-4 px-5 py-4 border-b border-border/50 last:border-0 text-left hover:bg-accent/5 transition-all group"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.source_type} · {p.endpoints_count || 0} endpoints · {totalTests} tests
                      </p>
                    </div>
                    <div className="hidden md:flex items-center gap-2 w-32">
                      <Progress value={progress} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{progress}%</span>
                    </div>
                    <Badge variant="outline" className={`gap-1 ${sm.cls}`}>
                      <StatusIcon className={`h-3 w-3 ${p.status === "processing" ? "animate-spin" : ""}`} />
                      {sm.label}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
                  </button>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      <ProjectWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        workspaceId={currentWorkspace.id}
        onCreated={() => qc.invalidateQueries({ queryKey: ["projects"] })}
      />
    </AppLayout>
  );
}
