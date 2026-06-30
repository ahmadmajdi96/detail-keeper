import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProjectScope } from "@/hooks/useProjectScope";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, ShieldCheck, Loader2, Trash2, Edit, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

type Rules = {
  min_pass_rate?: number;
  max_failed?: number;
  max_flaky_rate?: number;
  max_critical_defects?: number;
  max_major_defects?: number;
};

const EMPTY: any = {
  name: "",
  description: "",
  scope: "cycle_run",
  enabled: true,
  blocks_release: true,
  rules: { min_pass_rate: 0.95, max_failed: 0, max_flaky_rate: 0.05, max_critical_defects: 0 } as Rules,
};

export default function QualityGatesPage() {
  const { user } = useAuth();
  const { projectId, workspaceId } = useProjectScope();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY);

  const { data: gates = [], isLoading } = useQuery({
    queryKey: ["quality-gates", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await (supabase as any)
        .from("quality_gates").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId,
  });

  const { data: recent = [] } = useQuery({
    queryKey: ["gate-evals-recent", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data } = await (supabase as any)
        .from("gate_evaluations").select("*, gate:quality_gates(name)")
        .eq("project_id", projectId).order("evaluated_at", { ascending: false }).limit(20);
      return data || [];
    },
    enabled: !!projectId,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = { ...form, project_id: projectId, workspace_id: workspaceId, created_by: user?.id };
      if (editing) {
        const { error } = await (supabase as any).from("quality_gates").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("quality_gates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Gate updated" : "Gate created");
      setOpen(false); setEditing(null); setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ["quality-gates"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("quality_gates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Gate deleted"); qc.invalidateQueries({ queryKey: ["quality-gates"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (g: any) => {
    setEditing(g);
    setForm({ name: g.name, description: g.description || "", scope: g.scope, enabled: g.enabled, blocks_release: g.blocks_release, rules: g.rules || {} });
    setOpen(true);
  };

  const statusIcon = (s: string) => s === "passed" ? <CheckCircle2 className="h-4 w-4 text-emerald-400"/> :
    s === "failed" ? <XCircle className="h-4 w-4 text-red-400"/> : <AlertTriangle className="h-4 w-4 text-amber-400"/>;

  if (!projectId) return (
    <AppLayout><div className="p-8 text-muted-foreground">Select a project to manage quality gates.</div></AppLayout>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Quality Gates"
          description="Configurable rules that block or approve releases automatically"
          actions={
            <Button className="ai-gradient text-white" onClick={() => { setEditing(null); setForm(EMPTY); setOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" /> New Gate
            </Button>
          }
        />

        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : gates.length === 0 ? (
          <Card className="border-border/50"><CardContent className="py-10 text-center text-muted-foreground">
            <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-50" />
            No quality gates yet. Create one to start auto-evaluating cycle runs.
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gates.map((g: any) => (
              <Card key={g.id} className="border-border/50">
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-accent" />
                      {g.name}
                      {!g.enabled && <Badge variant="outline" className="text-xs">disabled</Badge>}
                      {g.blocks_release && <Badge variant="outline" className="text-xs bg-red-500/10 text-red-300 border-red-500/30">blocks release</Badge>}
                    </CardTitle>
                    {g.description && <p className="text-xs text-muted-foreground mt-1">{g.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(g)}><Edit className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(g.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-xs text-muted-foreground">
                  {Object.entries(g.rules || {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between"><span>{k}</span><code className="text-foreground">{String(v)}</code></div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {recent.length > 0 && (
          <Card className="border-border/50">
            <CardHeader><CardTitle className="text-base">Recent evaluations</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {recent.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between text-sm p-2 rounded border border-border/40">
                  <div className="flex items-center gap-2">
                    {statusIcon(e.status)}
                    <span className="font-medium">{e.gate?.name || "Gate"}</span>
                    {e.blocks_release && <Badge variant="outline" className="bg-red-500/10 text-red-300 border-red-500/30 text-xs">blocked</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(e.evaluated_at).toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit gate" : "New quality gate"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Block on critical failures" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Scope</Label>
                <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cycle_run">Cycle run</SelectItem>
                    <SelectItem value="build">Build</SelectItem>
                    <SelectItem value="release">Release</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between pt-6">
                <Label>Enabled</Label>
                <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
              </div>
              <div className="flex items-center justify-between col-span-2">
                <Label>Blocks release on failure</Label>
                <Switch checked={form.blocks_release} onCheckedChange={(v) => setForm({ ...form, blocks_release: v })} />
              </div>
            </div>
            <div className="border-t border-border/40 pt-3">
              <Label className="text-xs uppercase text-muted-foreground">Rules (leave blank to skip)</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {[
                  ["min_pass_rate", "Min pass rate (0-1)"],
                  ["max_failed", "Max failed tests"],
                  ["max_flaky_rate", "Max flaky rate (0-1)"],
                  ["max_critical_defects", "Max open critical defects"],
                  ["max_major_defects", "Max open major defects"],
                ].map(([k, label]) => (
                  <div key={k}>
                    <Label className="text-xs">{label}</Label>
                    <Input type="number" step="0.01"
                      value={form.rules[k] ?? ""}
                      onChange={(e) => setForm({ ...form, rules: { ...form.rules, [k]: e.target.value === "" ? undefined : Number(e.target.value) } })} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!form.name || saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
