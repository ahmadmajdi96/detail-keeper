import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjectScope } from "@/hooks/useProjectScope";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Server, Trash2, PlayCircle, Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";

const KIND_LABELS: Record<string, string> = {
  webhook: "Webhook",
  github_actions: "GitHub Actions",
  gitlab_ci: "GitLab CI",
  docker: "Docker",
  local: "Local Agent",
};

const STATUS_COLORS: Record<string, string> = {
  idle: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  busy: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  offline: "bg-muted text-muted-foreground",
  disabled: "bg-red-500/15 text-red-300 border-red-500/30",
};

const JOB_STATUS_COLORS: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  dispatched: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  running: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  succeeded: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
  timeout: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  cancelled: "bg-muted text-muted-foreground",
};

export default function RunnersPage() {
  const { projectId, workspaceId } = useProjectScope();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [runners, setRunners] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [envs, setEnvs] = useState<any[]>([]);
  const [suites, setSuites] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", kind: "webhook", environment_id: "", webhook_url: "", dispatch_ref: "main",
  });

  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchRunner, setDispatchRunner] = useState<any>(null);
  const [dispatchForm, setDispatchForm] = useState({ suite_id: "", cycle_id: "", environment_id: "" });

  const load = async () => {
    if (!projectId) { setLoading(false); return; }
    setLoading(true);
    const [r, j, e, s, c] = await Promise.all([
      supabase.from("runners").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      supabase.from("runner_jobs").select("*, runner:runners(name), environment:environments(name)").eq("project_id", projectId).order("created_at", { ascending: false }).limit(50),
      supabase.from("environments").select("id,name,type").eq("project_id", projectId),
      supabase.from("test_suites").select("id,name").eq("project_id", projectId),
      (supabase as any).from("test_cycles").select("id,name").eq("project_id", projectId).order("created_at", { ascending: false }).limit(20),
    ]);
    setRunners(r.data || []);
    setJobs(j.data || []);
    setEnvs(e.data || []);
    setSuites(s.data || []);
    setCycles(c.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  // realtime
  useEffect(() => {
    if (!projectId) return;
    const ch = supabase
      .channel(`runners-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "runners", filter: `project_id=eq.${projectId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "runner_jobs", filter: `project_id=eq.${projectId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId]);

  const create = async () => {
    if (!projectId || !workspaceId) return toast.error("Select a project first");
    if (!form.name.trim()) return toast.error("Name is required");
    const config: any = {};
    if (form.kind === "webhook") config.webhook_url = form.webhook_url;
    if (form.kind === "github_actions") config.dispatch_ref = form.dispatch_ref;
    const { error } = await supabase.from("runners").insert({
      workspace_id: workspaceId,
      project_id: projectId,
      environment_id: form.environment_id || null,
      name: form.name,
      kind: form.kind,
      config,
      created_by: user?.id,
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Runner registered");
    setCreateOpen(false);
    setForm({ name: "", kind: "webhook", environment_id: "", webhook_url: "", dispatch_ref: "main" });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this runner?")) return;
    const { error } = await supabase.from("runners").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const setRunnerStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("runners").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const openDispatch = (runner: any) => {
    setDispatchRunner(runner);
    setDispatchForm({ suite_id: "", cycle_id: "", environment_id: runner.environment_id || "" });
    setDispatchOpen(true);
  };

  const dispatch = async () => {
    if (!dispatchRunner) return;
    if (!dispatchForm.suite_id) return toast.error("Pick a suite");
    try {
      const { data, error } = await (supabase.functions as any).invoke("runner-dispatch", {
        body: {
          runner_id: dispatchRunner.id,
          project_id: projectId,
          suite_id: dispatchForm.suite_id,
          cycle_id: dispatchForm.cycle_id || null,
          environment_id: dispatchForm.environment_id || dispatchRunner.environment_id,
        },
      });
      if (error) throw error;
      toast.success(`Job queued: ${data?.runner_job_id?.slice(0, 8)}`);
      setDispatchOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message || "Dispatch failed");
    }
  };

  if (!projectId) {
    return (
      <AppLayout>
        <PageHeader title="Runners" description="Automated test executors per environment" />
        <Card className="mt-6"><CardContent className="p-6 text-muted-foreground">Select a project to manage runners.</CardContent></Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Runners"
          description={`Automated executors for ${currentWorkspace?.name ?? "this workspace"}`}
          actions={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Register Runner
            </Button>
          }
        />

        <Tabs defaultValue="runners">
          <TabsList>
            <TabsTrigger value="runners">Runners ({runners.length})</TabsTrigger>
            <TabsTrigger value="jobs">Recent Jobs ({jobs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="runners" className="space-y-3 mt-4">
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : runners.length === 0 ? (
              <Card><CardContent className="p-12 text-center">
                <Server className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No runners registered yet</p>
                <Button className="mt-4" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> Register your first runner</Button>
              </CardContent></Card>
            ) : (
              runners.map((r) => (
                <Card key={r.id}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Server className="h-4 w-4 text-accent" /> {r.name}
                        <Badge variant="outline" className={STATUS_COLORS[r.status] || ""}>{r.status}</Badge>
                      </CardTitle>
                      <div className="text-xs text-muted-foreground mt-1">
                        {KIND_LABELS[r.kind] || r.kind}
                        {r.environment_id && ` · env: ${envs.find(e => e.id === r.environment_id)?.name || "—"}`}
                        {r.last_seen_at && ` · last seen ${new Date(r.last_seen_at).toLocaleString()}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => openDispatch(r)} disabled={r.status === "disabled"}>
                        <PlayCircle className="mr-1 h-3.5 w-3.5" /> Dispatch
                      </Button>
                      <Select value={r.status} onValueChange={(v) => setRunnerStatus(r.id, v)}>
                        <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="idle">Idle</SelectItem>
                          <SelectItem value="busy">Busy</SelectItem>
                          <SelectItem value="offline">Offline</SelectItem>
                          <SelectItem value="disabled">Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardHeader>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="jobs" className="space-y-2 mt-4">
            {jobs.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">
                <Activity className="mx-auto h-8 w-8 mb-2" /> No runner jobs yet
              </CardContent></Card>
            ) : (
              jobs.map((j) => (
                <Card key={j.id}>
                  <CardContent className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {j.runner?.name || "(unassigned)"} → cycle run {j.cycle_run_id?.slice(0,8) || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        env: {j.environment?.name || "—"} · attempt {j.attempt}/{j.max_attempts}
                        {j.started_at && ` · started ${new Date(j.started_at).toLocaleTimeString()}`}
                        {j.finished_at && ` · finished ${new Date(j.finished_at).toLocaleTimeString()}`}
                      </div>
                      {j.error?.message && <div className="text-xs text-red-400 mt-1 truncate">{j.error.message}</div>}
                    </div>
                    <Badge variant="outline" className={JOB_STATUS_COLORS[j.status]}>{j.status}</Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Register dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register a Runner</DialogTitle>
            <DialogDescription>Connect an executor that can run automated suites.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Runner name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(KIND_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.environment_id || "none"} onValueChange={(v) => setForm({ ...form, environment_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Default environment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Any environment</SelectItem>
                {envs.map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({e.type})</SelectItem>)}
              </SelectContent>
            </Select>
            {form.kind === "webhook" && (
              <Input placeholder="Webhook URL (POST target)" value={form.webhook_url} onChange={(e) => setForm({ ...form, webhook_url: e.target.value })} />
            )}
            {form.kind === "github_actions" && (
              <Input placeholder="Git ref / branch (e.g. main)" value={form.dispatch_ref} onChange={(e) => setForm({ ...form, dispatch_ref: e.target.value })} />
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={create}>Register</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispatch dialog */}
      <Dialog open={dispatchOpen} onOpenChange={setDispatchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispatch to {dispatchRunner?.name}</DialogTitle>
            <DialogDescription>Queue a suite to run on this runner. A new cycle run is created automatically.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={dispatchForm.suite_id} onValueChange={(v) => setDispatchForm({ ...dispatchForm, suite_id: v })}>
              <SelectTrigger><SelectValue placeholder="Suite to execute" /></SelectTrigger>
              <SelectContent>
                {suites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={dispatchForm.environment_id || "none"} onValueChange={(v) => setDispatchForm({ ...dispatchForm, environment_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Environment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Runner default</SelectItem>
                {envs.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={dispatchForm.cycle_id || "new"} onValueChange={(v) => setDispatchForm({ ...dispatchForm, cycle_id: v === "new" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Attach to cycle (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Create new cycle</SelectItem>
                {cycles.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDispatchOpen(false)}>Cancel</Button>
            <Button onClick={dispatch}>Dispatch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
