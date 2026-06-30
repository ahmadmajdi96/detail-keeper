import { useState } from "react";
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
import { Plus, Rocket, Calendar, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { ReleaseJudgeCard } from "@/components/sentinel/ReleaseJudgeCard";
import { GateEvaluationsCard } from "@/components/sentinel/GateEvaluationsCard";

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  released: "Released",
  blocked: "Blocked",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  in_progress: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  released: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  blocked: "bg-red-500/15 text-red-300 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground",
};

export default function ReleasesPage() {
  const { currentProject } = useWorkspace();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", version: "", description: "", status: "planned", target_date: "" });

  const projectId = currentProject?.id ?? null;

  const { data: releases = [], isLoading } = useQuery({
    queryKey: ["releases", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await (supabase as any)
        .from("releases")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!projectId,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("Select a project first");
      const payload: any = {
        project_id: projectId,
        name: form.name,
        version: form.version || null,
        description: form.description || null,
        status: form.status,
        target_date: form.target_date || null,
        owner_id: user?.id,
        created_by: user?.id,
      };
      const { error } = await (supabase as any).from("releases").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Release created");
      setOpen(false);
      setForm({ name: "", version: "", description: "", status: "planned", target_date: "" });
      qc.invalidateQueries({ queryKey: ["releases", projectId] });
    },
    onError: (e: any) => toast.error(e.message || "Failed to create release"),
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Releases"
          description="Plan and govern software releases. A release links builds, environments, and test cycles."
          actions={
            <Button onClick={() => setOpen(true)} disabled={!projectId} className="ai-gradient text-white">
              <Plus className="mr-2 h-4 w-4" />
              New Release
            </Button>
          }
        />

        {!projectId && (
          <Card className="border-dashed border-border/50">
            <CardContent className="py-12 text-center text-muted-foreground">
              Select a project to view its releases.
            </CardContent>
          </Card>
        )}

        {projectId && isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {projectId && !isLoading && releases.length === 0 && (
          <Card className="border-dashed border-border/50">
            <CardContent className="py-12 text-center text-muted-foreground">
              No releases yet. Create one to begin organizing test cycles around real software delivery.
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {releases.map((r: any) => (
            <Card key={r.id} className="border-border/50">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <button className="flex items-start gap-2 text-left flex-1" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                    {expanded === r.id ? <ChevronDown className="h-4 w-4 mt-1" /> : <ChevronRight className="h-4 w-4 mt-1" />}
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Rocket className="h-4 w-4 text-accent" />
                        {r.name}
                      </CardTitle>
                      {r.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{r.description}</p>}
                    </div>
                  </button>
                  <Badge variant="outline" className={STATUS_COLORS[r.status] || ""}>
                    {STATUS_LABELS[r.status] || r.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-4 text-xs">
                  {r.version && <span className="font-mono">{r.version}</span>}
                  {r.target_date && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Target {new Date(r.target_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {expanded === r.id && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-2 border-t border-border/40">
                    <GateEvaluationsCard releaseId={r.id} />
                    <ReleaseJudgeCard releaseId={r.id} projectId={projectId} />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>


        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Release</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="June 2026 Release"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Version</Label>
                  <Input
                    value={form.version}
                    onChange={(e) => setForm({ ...form, version: e.target.value })}
                    placeholder="v2.8.0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Target date</Label>
                <Input
                  type="date"
                  value={form.target_date}
                  onChange={(e) => setForm({ ...form, target_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
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
