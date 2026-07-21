import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Server, Bug, ShieldCheck, BarChart3, Activity, Loader2, Radio,
  ExternalLink, Monitor, Plus, Trash2, Edit3, BookOpen,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { SpecRunPanel } from "./SpecRunPanel";

const RUNNER_STATUS: Record<string, string> = {
  idle: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  busy: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  offline: "bg-muted text-muted-foreground",
  disabled: "bg-red-500/15 text-red-300 border-red-500/30",
};

/* ---------- Runners (dynamic / inline) ---------- */
export function PlanRunnersPanel({ projectId, workspaceId }: { projectId: string; workspaceId?: string | null }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", kind: "local", labels: "", status: "idle" });

  const { data: runners = [], isLoading } = useQuery({
    queryKey: ["plan-runners", projectId],
    queryFn: async () => (await supabase.from("runners")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })).data || [],
  });

  const reset = () => { setForm({ name: "", kind: "local", labels: "", status: "idle" }); setEditing(null); };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name required");
      const labels = form.labels.split(",").map((s) => s.trim()).filter(Boolean);
      if (editing) {
        const { error } = await (supabase as any).from("runners")
          .update({ name: form.name, kind: form.kind, labels, status: form.status })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("runners").insert({
          name: form.name, kind: form.kind, labels, status: form.status as any,
          project_id: projectId, workspace_id: workspaceId || null, created_by: user?.id,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Runner saved"); setOpen(false); reset(); qc.invalidateQueries({ queryKey: ["plan-runners", projectId] }); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("runners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Runner removed"); qc.invalidateQueries({ queryKey: ["plan-runners", projectId] }); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const openEdit = (r: any) => {
    setEditing(r);
    setForm({ name: r.name || "", kind: r.kind || "local", labels: (r.labels || []).join(", "), status: r.status || "idle" });
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4 text-accent" /> Runners</CardTitle>
          <CardDescription>Executors managed inline for this plan's project.</CardDescription>
        </div>
        <Button size="sm" onClick={() => { reset(); setOpen(true); }}><Plus className="h-3.5 w-3.5 mr-1" /> New Runner</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          : runners.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Server className="mx-auto h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">No runners yet — add one to run this plan's specs.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {runners.map((r: any) => (
                <div key={r.id} className="group flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Server className="h-3.5 w-3.5 text-accent" /> {r.name}
                      <Badge variant="outline" className={RUNNER_STATUS[r.status] || ""}>{r.status}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{r.kind}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(r.labels || []).join(", ") || "no labels"}
                      {r.last_seen_at ? ` · last seen ${new Date(r.last_seen_at).toLocaleString()}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(r)}><Edit3 className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </CardContent>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Runner" : "New Runner"}</DialogTitle>
            <DialogDescription>Runners pick up jobs dispatched for this plan's project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ci-runner-01" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kind</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["local", "docker", "k8s", "cloud", "self_hosted"].map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["idle", "busy", "offline", "disabled"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Labels (comma separated)</Label><Input value={form.labels} onChange={(e) => setForm({ ...form, labels: e.target.value })} placeholder="linux, chromium" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------- Defects (with quick add) ---------- */
const SEVERITY_CLASS: Record<string, string> = {
  critical: "text-red-400 border-red-500/40",
  high: "text-orange-400 border-orange-500/40",
  medium: "text-amber-300 border-amber-500/40",
  low: "text-emerald-300 border-emerald-500/40",
};
export function PlanDefectsPanel({ testPlanId, projectId, workspaceId }: { testPlanId: string; projectId?: string | null; workspaceId?: string | null }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", severity: "medium", priority: "medium" });

  const { data: defects = [], isLoading } = useQuery({
    queryKey: ["plan-defects", testPlanId],
    queryFn: async () => (await supabase.from("defects")
      .select("id, title, severity, priority, status, created_at, reporter:profiles!defects_reported_by_fkey(name)")
      .eq("test_plan_id", testPlanId)
      .order("created_at", { ascending: false })).data || [],
  });

  const counts = useMemo(() => {
    const c: any = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
    defects.forEach((d: any) => { c[d.status] = (c[d.status] || 0) + 1; });
    return c;
  }, [defects]);

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Title required");
      const { error } = await supabase.from("defects").insert({
        title: form.title, description: form.description, severity: form.severity as any, priority: form.priority as any,
        status: "open", test_plan_id: testPlanId, project_id: projectId || null, workspace_id: workspaceId || null,
        reported_by: user?.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Defect raised"); setOpen(false); setForm({ title: "", description: "", severity: "medium", priority: "medium" }); qc.invalidateQueries({ queryKey: ["plan-defects", testPlanId] }); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><Bug className="h-4 w-4 text-accent" /> Defects</CardTitle>
          <CardDescription>Bugs raised against this test plan.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Raise Defect</Button>
          <Button asChild size="sm" variant="outline"><Link to="/defects"><ExternalLink className="h-3.5 w-3.5 mr-1" /> All</Link></Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {(["open", "in_progress", "resolved", "closed"] as const).map(s => (
            <div key={s} className="p-3 rounded-lg border bg-secondary/30 text-center">
              <p className="text-lg font-bold">{counts[s] || 0}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.replace("_", " ")}</p>
            </div>
          ))}
        </div>
        {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          : defects.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Bug className="mx-auto h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">No defects linked to this plan.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[420px]">
              <div className="space-y-2">
                {defects.map((d: any) => (
                  <Link key={d.id} to={`/defects/${d.id}`} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:border-accent/50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.reporter?.name || "unknown"} · {new Date(d.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Badge variant="outline" className={SEVERITY_CLASS[d.severity] || ""}>{d.severity}</Badge>
                      <Badge variant="outline">{d.status}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </ScrollArea>
          )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise Defect</DialogTitle>
            <DialogDescription>Will be linked to this test plan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["low", "medium", "high", "critical"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["low", "medium", "high", "critical"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------- Quality Gates (dynamic) ---------- */
export function PlanQualityGatesPanel({ projectId, workspaceId }: { projectId: string; workspaceId?: string | null }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", description: "", metric: "pass_rate", op: "gte", threshold: "90", is_active: true });

  const { data: gates = [], isLoading } = useQuery({
    queryKey: ["plan-quality-gates", projectId],
    queryFn: async () => (await (supabase as any).from("quality_gates")
      .select("*").eq("project_id", projectId).order("created_at", { ascending: false })).data || [],
  });

  const reset = () => { setForm({ name: "", description: "", metric: "pass_rate", op: "gte", threshold: "90", is_active: true }); setEditing(null); };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name required");
      const rules = [{ metric: form.metric, op: form.op, threshold: Number(form.threshold) }];
      const payload: any = {
        name: form.name, description: form.description, rules,
        is_active: form.is_active, project_id: projectId, workspace_id: workspaceId || null,
      };
      if (editing) {
        const { error } = await (supabase as any).from("quality_gates").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { error } = await (supabase as any).from("quality_gates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Gate saved"); setOpen(false); reset(); qc.invalidateQueries({ queryKey: ["plan-quality-gates", projectId] }); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("quality_gates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Gate removed"); qc.invalidateQueries({ queryKey: ["plan-quality-gates", projectId] }); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const openEdit = (g: any) => {
    setEditing(g);
    const r = Array.isArray(g.rules) && g.rules[0] ? g.rules[0] : {};
    setForm({
      name: g.name || "", description: g.description || "",
      metric: r.metric || "pass_rate", op: r.op || "gte", threshold: String(r.threshold ?? 90),
      is_active: !!g.is_active,
    });
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Quality Gates</CardTitle>
          <CardDescription>Pass/fail criteria evaluated against this plan's runs.</CardDescription>
        </div>
        <Button size="sm" onClick={() => { reset(); setOpen(true); }}><Plus className="h-3.5 w-3.5 mr-1" /> New Gate</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          : gates.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <ShieldCheck className="mx-auto h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">No quality gates configured yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {gates.map((g: any) => {
                const r = Array.isArray(g.rules) && g.rules[0] ? g.rules[0] : null;
                return (
                  <div key={g.id} className="group p-3 rounded-lg border bg-card flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{g.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{g.description || "—"}</p>
                      {r && <p className="text-[11px] font-mono text-accent mt-1">{r.metric} {r.op} {r.threshold}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className={g.is_active ? "border-emerald-500/40 text-emerald-300" : ""}>
                        {g.is_active ? "active" : "inactive"}
                      </Badge>
                      <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => openEdit(g)}><Edit3 className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => remove.mutate(g.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </CardContent>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Quality Gate" : "New Quality Gate"}</DialogTitle>
            <DialogDescription>Evaluated automatically when cycle runs complete.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Block on critical bugs" /></div>
            <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Metric</Label>
                <Select value={form.metric} onValueChange={(v) => setForm({ ...form, metric: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["pass_rate", "failed_count", "open_critical_defects", "blocked_count", "coverage"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Operator</Label>
                <Select value={form.op} onValueChange={(v) => setForm({ ...form, op: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["gte", "lte", "gt", "lt", "eq"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Threshold</Label><Input type="number" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2">
              <input id="ga" type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              <Label htmlFor="ga" className="text-sm">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------- Requirements (dynamic / inline) ---------- */
export function PlanRequirementsPanel({ projectId, workspaceId }: { projectId: string; workspaceId?: string | null }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ key: "", title: "", description: "", priority: "2", status: "draft", tags: "" });

  const { data: requirements = [], isLoading } = useQuery({
    queryKey: ["plan-requirements", projectId],
    queryFn: async () => (await supabase.from("requirements")
      .select("id, key, title, description, status, priority, tags, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })).data || [],
  });

  const reset = () => { setForm({ key: "", title: "", description: "", priority: "2", status: "draft", tags: "" }); setEditing(null); };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Title required");
      const tags = form.tags.split(",").map((s) => s.trim()).filter(Boolean);
      const payload: any = {
        key: form.key || null, title: form.title, description: form.description || null,
        priority: Number(form.priority), status: form.status, tags,
        project_id: projectId,
      };
      if (editing) {
        const { error } = await supabase.from("requirements").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from("requirements").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Requirement saved"); setOpen(false); reset(); qc.invalidateQueries({ queryKey: ["plan-requirements", projectId] }); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("requirements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["plan-requirements", projectId] }); },
    onError: (e: any) => toast.error(e.message || "Failed"),
  });

  const openEdit = (r: any) => {
    setEditing(r);
    setForm({
      key: r.key || "", title: r.title || "", description: r.description || "",
      priority: String(r.priority || 2), status: r.status || "draft",
      tags: (r.tags || []).join(", "),
    });
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><BookOpen className="h-4 w-4 text-accent" /> Requirements</CardTitle>
          <CardDescription>Manage project requirements inline — no leaving this page.</CardDescription>
        </div>
        <Button size="sm" onClick={() => { reset(); setOpen(true); }}><Plus className="h-3.5 w-3.5 mr-1" /> New Requirement</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          : requirements.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <BookOpen className="mx-auto h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">No requirements yet for this project.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {requirements.map((r: any) => (
                <div key={r.id} className="group flex items-start justify-between gap-3 p-3 rounded-lg border bg-card">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {r.key && <Badge variant="outline" className="text-[10px] font-mono">{r.key}</Badge>}
                      <p className="text-sm font-medium truncate">{r.title}</p>
                    </div>
                    {r.description && <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>}
                    {r.tags?.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {r.tags.slice(0, 5).map((t: string, i: number) => <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-xs">P{r.priority}</Badge>
                    <StatusBadge variant={r.status === "approved" ? "success" : r.status === "draft" ? "warning" : "muted"} size="sm">{r.status}</StatusBadge>
                    <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => openEdit(r)}><Edit3 className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => remove.mutate(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </CardContent>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Requirement" : "New Requirement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Key</Label><Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="REQ-001" /></div>
              <div className="col-span-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            </div>
            <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["1", "2", "3", "4"].map((p) => <SelectItem key={p} value={p}>P{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["draft", "approved", "in_review", "deprecated"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Tags</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="auth, api" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ---------- Reports ---------- */
export function PlanReportsPanel({ testPlanId, projectId }: { testPlanId: string; projectId: string }) {
  const { data: execs = [] } = useQuery({
    queryKey: ["plan-report-execs", testPlanId],
    queryFn: async () => (await supabase.from("test_executions")
      .select("id, status, started_at, completed_at")
      .eq("test_plan_id", testPlanId)
      .order("created_at", { ascending: false }).limit(500)).data || [],
  });
  const { data: suiteRuns = [] } = useQuery({
    queryKey: ["plan-report-suites", testPlanId],
    queryFn: async () => (await (supabase as any).from("suite_runs")
      .select("id, status, total_specs, passed_specs, failed_specs, completed_specs, created_at")
      .eq("test_plan_id", testPlanId)
      .order("created_at", { ascending: false }).limit(50)).data || [],
  });
  const { data: defects = [] } = useQuery({
    queryKey: ["plan-report-defects", testPlanId],
    queryFn: async () => (await supabase.from("defects").select("id, severity, status")
      .eq("test_plan_id", testPlanId)).data || [],
  });
  const { data: cases = [] } = useQuery({
    queryKey: ["plan-report-cases", testPlanId],
    queryFn: async () => (await supabase.from("test_plan_test_cases")
      .select("test_case_id").eq("test_plan_id", testPlanId)).data || [],
  });

  // Aggregate executions + suite specs into a unified view
  const suiteTotal = suiteRuns.reduce((acc: number, s: any) => acc + (s.total_specs || 0), 0);
  const suitePassed = suiteRuns.reduce((acc: number, s: any) => acc + (s.passed_specs || 0), 0);
  const suiteFailed = suiteRuns.reduce((acc: number, s: any) => acc + (s.failed_specs || 0), 0);

  const passed = execs.filter((e: any) => e.status === "passed").length + suitePassed;
  const failed = execs.filter((e: any) => e.status === "failed").length + suiteFailed;
  const blocked = execs.filter((e: any) => e.status === "blocked").length;
  const totalRuns = execs.length + suiteTotal;
  const passRate = totalRuns ? Math.round((passed / totalRuns) * 100) : 0;
  const openBugs = defects.filter((d: any) => !["resolved", "closed"].includes(d.status)).length;
  const criticalBugs = defects.filter((d: any) => d.severity === "critical" && !["resolved", "closed"].includes(d.status)).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-accent" /> Plan Report</CardTitle>
          <CardDescription>Live aggregated metrics across executions, suite runs and defects.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {[
              { label: "Cases", val: cases.length },
              { label: "Runs", val: totalRuns },
              { label: "Passed", val: passed, cls: "text-emerald-400" },
              { label: "Failed", val: failed, cls: "text-red-400" },
              { label: "Blocked", val: blocked, cls: "text-amber-400" },
              { label: "Open Defects", val: openBugs, cls: "text-orange-400" },
            ].map((m: any) => (
              <div key={m.label} className="p-3 rounded-lg border bg-secondary/30">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</p>
                <p className={`text-2xl font-bold ${m.cls || ""}`}>{m.val}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Pass Rate</span>
              <span className="font-medium">{passRate}%</span>
            </div>
            <Progress value={passRate} className="h-2" />
          </div>
          {criticalBugs > 0 && (
            <p className="text-xs text-red-400 mt-3">⚠ {criticalBugs} critical defect{criticalBugs === 1 ? "" : "s"} still open</p>
          )}
          {totalRuns === 0 && (
            <p className="text-xs text-muted-foreground mt-3">No executions yet — dispatch a suite from the AI Workbench tab or run manually to populate this report.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-accent" /> Recent Suite Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {suiteRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No suite runs yet.</p>
          ) : (
            <div className="space-y-2">
              {suiteRuns.slice(0, 10).map((s: any) => {
                const pct = s.total_specs ? Math.round(((s.completed_specs || 0) / s.total_specs) * 100) : 0;
                return (
                  <div key={s.id} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline">{s.status}</Badge>
                        <span className="text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
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
    </div>
  );
}

/* ---------- Live (Forge test-runs) ---------- */
import { ForgeRunProgress } from "./ForgeRunProgress";

export function PlanLivePanel({ testPlanId }: { testPlanId: string }) {
  const qc = useQueryClient();
  const { data: runs = [] } = useQuery<any[]>({
    queryKey: ["plan-test-runs", testPlanId],
    queryFn: async () => {
      const { data } = await supabase.from("plan_test_runs" as any)
        .select("id, status, base_url, total_tests, passed_tests, failed_tests, created_at, finished_at")
        .eq("test_plan_id", testPlanId)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data as any[]) || [];
    },
    refetchInterval: 5000,
  });

  const [selected, setSelected] = useState<string | null>(null);
  const activeId = selected || runs[0]?.id || null;

  useEffect(() => {
    const ch = supabase.channel(`plan-live-${testPlanId}-${Math.random().toString(36).slice(2, 6)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_test_runs", filter: `test_plan_id=eq.${testPlanId}` },
        () => qc.invalidateQueries({ queryKey: ["plan-test-runs", testPlanId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [testPlanId, qc]);

  if (!runs.length) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <Monitor className="mx-auto h-10 w-10 mb-3 opacity-50" />
          <p className="text-sm">No Forge test runs yet for this plan.</p>
          <p className="text-xs mt-1">Generate Playwright code in <strong>AI Workbench</strong>, set a Base URL, and press <strong>Run Suite</strong> to dispatch to TestCase Forge.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Radio className="h-4 w-4 text-red-400 animate-pulse" /> Forge Live Runs
          </CardTitle>
          <CardDescription>Every dispatched Forge suite for this plan. Select a run to inspect live events and artifacts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {runs.map((r: any) => {
              const isActive = activeId === r.id;
              const live = ["queued", "running"].includes(r.status);
              return (
                <button key={r.id} onClick={() => setSelected(r.id)}
                  className={`text-[11px] px-2 py-1 rounded border transition-colors flex items-center gap-1.5 ${isActive ? "bg-accent/20 border-accent text-accent" : "bg-card border-border hover:border-accent/40"}`}>
                  {live && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span className="font-mono">{r.id.slice(0, 8)}</span>
                  <span className="uppercase text-[10px] opacity-80">{r.status}</span>
                  <span className="opacity-60">{(r.passed_tests || 0)}✓/{(r.failed_tests || 0)}✗</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
      {activeId && <Card className="overflow-hidden"><ForgeRunProgress planRunId={activeId} compact /></Card>}
    </div>
  );
}

