import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjectScope } from "@/hooks/useProjectScope";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";

type Req = { id: string; key: string | null; title: string; description: string | null; status: string; priority: number; project_id: string; created_at: string };

export default function RequirementsPage() {
  const { projectId } = useProjectScope();
  const { user } = useAuth();
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ key: "", title: "", description: "", priority: "2", status: "proposed" });

  const load = async () => {
    if (!projectId) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("requirements")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const create = async () => {
    if (!projectId) return toast.error("Select a project first");
    if (!form.title.trim()) return toast.error("Title is required");
    const { error } = await supabase.from("requirements").insert({
      project_id: projectId,
      key: form.key || null,
      title: form.title,
      description: form.description || null,
      priority: Number(form.priority),
      status: form.status as any,
      created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Requirement created");
    setOpen(false);
    setForm({ key: "", title: "", description: "", priority: "2", status: "proposed" });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this requirement?")) return;
    const { error } = await supabase.from("requirements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("requirements").update({ status: status as any }).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <AppLayout>
    <div className="space-y-6">
      <PageHeader
        title="Requirements"
        description="Traceable requirements linked to test cases and defects"
        actions={
          <Button onClick={() => setOpen(true)} disabled={!projectId}>
            <Plus className="mr-2 h-4 w-4" /> New Requirement
          </Button>
        }
      />

      {!projectId && (
        <Card><CardContent className="p-6 text-muted-foreground">Select a project to view requirements.</CardContent></Card>
      )}

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : items.length === 0 && projectId ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Target className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No requirements yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {r.key && <span className="text-xs text-muted-foreground">[{r.key}]</span>}
                    {r.title}
                  </CardTitle>
                  {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                    <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proposed">Proposed</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="obsolete">Obsolete</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant="outline">P{r.priority}</Badge>
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Requirement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Key (e.g. REQ-101)" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
            <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Textarea placeholder="Description / acceptance criteria" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">P1 (High)</SelectItem>
                  <SelectItem value="2">P2 (Medium)</SelectItem>
                  <SelectItem value="3">P3 (Low)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="proposed">Proposed</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AppLayout>
  );
}
