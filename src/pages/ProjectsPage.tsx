import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ProjectWizard } from "@/components/projects/ProjectWizard";
import { toast } from "sonner";
import {
  Plus, Search, FileText, FileArchive, Github, FolderOpen, Trash2,
  RefreshCw, ArrowRight, Layers, CheckCircle2, AlertCircle, Clock,
} from "lucide-react";

const sourceIcon = { documentation: FileText, zip: FileArchive, github: Github } as const;
const statusColor: Record<string, string> = {
  ready: "text-success", processing: "text-warning",
  pending: "text-muted-foreground", failed: "text-destructive", archived: "text-muted-foreground",
};

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { currentWorkspace, setCurrentProjectId, refresh } = useWorkspace();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(params.get("new") === "1");

  useEffect(() => {
    if (params.get("new") === "1") {
      setWizardOpen(true);
      params.delete("new"); setParams(params);
    }
  }, []);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return [];
      const { data } = await supabase
        .from("projects")
        .select("*")
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

  const filtered = projects.filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: projects.length,
    ready: projects.filter((p: any) => p.status === "ready").length,
    processing: projects.filter((p: any) => p.status === "processing").length,
    failed: projects.filter((p: any) => p.status === "failed").length,
  };

  if (!currentWorkspace) {
    return (
      <AppLayout>
        <Card><CardContent className="py-16 text-center">
          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Select a workspace from the top bar to view projects</p>
        </CardContent></Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Projects"
        description={`All projects in ${currentWorkspace.name}`}
        actions={
          <Button className="ai-gradient text-white" onClick={() => setWizardOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Project
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Total" value={stats.total} icon={Layers} />
        <MetricCard label="Ready" value={stats.ready} icon={CheckCircle2} variant="success" />
        <MetricCard label="Processing" value={stats.processing} icon={Clock} variant="warning" />
        <MetricCard label="Failed" value={stats.failed} icon={AlertCircle} variant="destructive" />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-4">No projects yet</p>
          <Button onClick={() => setWizardOpen(true)}><Plus className="mr-2 h-4 w-4" /> Create project</Button>
        </CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p: any) => {
            const Icon = sourceIcon[p.source_type as keyof typeof sourceIcon];
            return (
              <Card key={p.id} className="hover:border-accent/40 transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-accent" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm truncate">{p.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className={`text-xs ${statusColor[p.status]}`}>{p.status}</Badge>
                        <span className="text-xs text-muted-foreground capitalize">{p.source_type}</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem] mb-3">{p.description || "No description"}</p>
                  {p.process_error && (
                    <div className="text-xs text-destructive mb-3 line-clamp-2">{p.process_error}</div>
                  )}
                  {p.github_url && (
                    <a href={p.github_url} target="_blank" rel="noreferrer" className="text-xs text-accent flex items-center gap-1 mb-3 truncate">
                      <Github className="h-3 w-3 shrink-0" />{p.github_url.replace("https://github.com/", "")}
                    </a>
                  )}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                    <div><div className="font-semibold">{p.files_count || 0}</div><div className="text-muted-foreground">Files</div></div>
                    <div><div className="font-semibold">{p.endpoints_count || 0}</div><div className="text-muted-foreground">Endpoints</div></div>
                    <div><div className="font-semibold">{p.test_cases_count || 0}</div><div className="text-muted-foreground">Tests</div></div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => { setCurrentProjectId(p.id); navigate("/documents"); }}>
                      Open <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                    {(p.source_type === "github" || p.source_type === "zip") && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => reprocess.mutate(p)} title="Reprocess">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete project?</AlertDialogTitle>
                          <AlertDialogDescription>This permanently deletes "{p.name}" and unlinks its documents and tests.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => del.mutate(p.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ProjectWizard open={wizardOpen} onOpenChange={setWizardOpen} workspaceId={currentWorkspace.id} onCreated={() => qc.invalidateQueries({ queryKey: ["projects"] })} />
    </AppLayout>
  );
}
