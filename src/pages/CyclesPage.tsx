import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Repeat, Plus, Loader2, Rocket, Server, Layers } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  paused: "Paused",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  in_progress: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  paused: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-muted text-muted-foreground",
};

export default function CyclesPage() {
  const { currentProject } = useWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    status: "planned",
    release_id: "",
    environment_id: "",
    suite_id: "",
  });

  const projectId = currentProject?.id ?? null;

  const { data: cycles = [], isLoading } = useQuery({
    queryKey: ["cycles", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await (supabase as any)
        .from("test_cycles")
        .select("*, release:releases(name,version), environment:environments(name,type), suite:test_suites(name)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!projectId,
  });

  const { data: releases = [] } = useQuery({
    queryKey: ["releases-lite", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data } = await (supabase as any).from("releases").select("id,name,version").eq("project_id", projectId);
      return data ?? [];
    },
    enabled: !!projectId && open,
  });
  const { data: environments = [] } = useQuery({
    queryKey: ["envs-lite", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data } = await (supabase as any).from("environments").select("id,name,type").eq("project_id", projectId);
      return data ?? [];
    },
    enabled: !!projectId && open,
  });
  const { data: suites = [] } = useQuery({
    queryKey: ["suites-lite", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data } = await (supabase as any).from("test_suites").select("id,name").eq("project_id", projectId);
      return data ?? [];
    },
    enabled: !!projectId && open,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("Select a project first");
      const payload: any = {
        project_id: projectId,
        name: form.name,
        description: form.description || null,
        status: form.status,
        release_id: form.release_id || null,
        environment_id: form.environment_id || null,
        suite_id: form.suite_id || null,
        owner_id: user?.id,
        created_by: user?.id,
      };
      const { data: cycle, error } = await (supabase as any)
        .from("test_cycles").insert(payload).select().single();
      if (error) throw error;

      // Seed a run + run items from the suite cases
      if (form.suite_id) {
        const { data: run, error: runErr } = await (supabase as any)
          .from("cycle_runs")
          .insert({
            cycle_id: cycle.id,
            project_id: projectId,
            name: "Initial run",
            status: "planned",
            executor_id: user?.id,
          })
          .select()
          .single();
        if (runErr) throw runErr;

        const { data: links } = await (supabase as any)
          .from("suite_test_cases")
          .select("test_case_id")
          .eq("suite_id", form.suite_id);
        const rows = (links ?? []).map((l: any) => ({
          run_id: run.id,
          cycle_id: cycle.id,
          test_case_id: l.test_case_id,
          status: "not_run",
        }));
        if (rows.length) {
          const { error: itErr } = await (supabase as any).from("cycle_run_items").insert(rows);
          if (itErr) throw itErr;
        }
      }
    },
    onSuccess: () => {
      toast.success("Cycle created");
      setOpen(false);
      setForm({ name: "", description: "", status: "planned", release_id: "", environment_id: "", suite_id: "" });
      qc.invalidateQueries({ queryKey: ["cycles", projectId] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to create cycle"),
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Test Cycles"
          description="A time-bound execution package for a release × environment × suite. Multiple cycles can run in parallel."
          actions={
            <Button onClick={() => setOpen(true)} disabled={!projectId} className="ai-gradient text-white">
              <Plus className="mr-2 h-4 w-4" />
              New Cycle
            </Button>
          }
        />

        {!projectId && (
          <Card className="border-dashed border-border/50">
            <CardContent className="py-12 text-center text-muted-foreground">
              Select a project to view its cycles.
            </CardContent>
          </Card>
        )}

        {projectId && isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {projectId && !isLoading && cycles.length === 0 && (
          <Card className="border-dashed border-border/50">
            <CardContent className="py-12 text-center text-muted-foreground">
              No cycles yet. Create one to start executing tests against a specific release & environment.
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cycles.map((c: any) => (
            <Card key={c.id} className="border-border/50 hover:border-accent/40 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Repeat className="h-4 w-4 text-accent" />
                    <Link to={`/cycles/${c.id}`} className="hover:text-accent transition-colors">{c.name}</Link>
                  </CardTitle>
                  <Badge variant="outline" className={STATUS_COLORS[c.status] || ""}>
                    {STATUS_LABELS[c.status] || c.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                {c.release && (
                  <div className="flex items-center gap-1.5"><Rocket className="h-3.5 w-3.5" /> {c.release.name} {c.release.version && <span className="font-mono">{c.release.version}</span>}</div>
                )}
                {c.environment && (
                  <div className="flex items-center gap-1.5"><Server className="h-3.5 w-3.5" /> {c.environment.name} <span className="opacity-60">({c.environment.type})</span></div>
                )}
                {c.suite && (
                  <div className="flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> {c.suite.name}</div>
                )}
                {c.description && <p className="line-clamp-2 pt-1">{c.description}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Test Cycle</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Regression — Staging — Build 2.8.0-rc3"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Release</Label>
                  <Select value={form.release_id} onValueChange={(v) => setForm({ ...form, release_id: v })}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      {releases.map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}{r.version ? ` • ${r.version}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Environment</Label>
                  <Select value={form.environment_id} onValueChange={(v) => setForm({ ...form, environment_id: v })}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      {environments.map((e: any) => (
                        <SelectItem key={e.id} value={e.id}>{e.name} ({e.type})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Test Suite</Label>
                <Select value={form.suite_id} onValueChange={(v) => setForm({ ...form, suite_id: v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    {suites.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Selecting a suite auto-seeds an initial run with its test cases.</p>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={() => createMut.mutate()}
                disabled={!form.name || createMut.isPending}
                className="ai-gradient text-white"
              >
                {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
