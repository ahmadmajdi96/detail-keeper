import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, UserPlus, Trash2, Users } from "lucide-react";

type PlanRole = "owner" | "assignee" | "reviewer" | "viewer";

interface Props {
  planId: string;
  projectId: string | null;
  workspaceId: string | null;
}

export function PlanPeoplePanel({ planId, projectId, workspaceId }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState<PlanRole>("assignee");

  // The project this plan belongs to — used to gate management + list candidate users.
  const { data: project } = useQuery({
    queryKey: ["plan-people-project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, workspace_id, visibility").eq("id", projectId!).single();
      return data;
    },
  });

  const wsId = project?.workspace_id || workspaceId;

  // Workspace -> organization link (used to widen the candidate pool)
  const { data: workspace } = useQuery({
    queryKey: ["plan-people-workspace", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase.from("workspaces").select("id, organization_id").eq("id", wsId!).single();
      return data;
    },
  });

  const { data: assignees = [] } = useQuery({
    queryKey: ["plan-people", planId],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("test_plan_assignees")
        .select("id, role, user_id, assigned_by, created_at")
        .eq("test_plan_id", planId);
      if (!rows?.length) return [];
      const ids = Array.from(new Set(rows.flatMap((r: any) => [r.user_id, r.assigned_by]).filter(Boolean)));
      const { data: profs } = await supabase.from("profiles").select("id, name, email").in("id", ids);
      return rows.map((r: any) => ({
        ...r,
        profile: profs?.find((p: any) => p.id === r.user_id),
        assigner: profs?.find((p: any) => p.id === r.assigned_by),
      }));
    },
  });

  // Candidate pool: union of project_members, workspace_members and organization_members
  // so assignees can be added dynamically even when the workspace membership table is sparse.
  const { data: projectMembers = [] } = useQuery({
    queryKey: ["plan-people-project-members", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data } = await supabase.from("project_members").select("user_id, role").eq("project_id", projectId!);
      return data || [];
    },
  });

  const { data: workspaceMembers = [] } = useQuery({
    queryKey: ["plan-people-workspace-members", wsId],
    enabled: !!wsId,
    queryFn: async () => {
      const { data } = await supabase.from("workspace_members").select("user_id, role").eq("workspace_id", wsId!);
      return data || [];
    },
  });

  const { data: orgMembers = [] } = useQuery({
    queryKey: ["plan-people-org-members", workspace?.organization_id],
    enabled: !!workspace?.organization_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("organization_members")
        .select("user_id, role")
        .eq("org_id", workspace!.organization_id!);
      return data || [];
    },
  });

  // Deduped candidate pool + profiles. For restricted projects only project_members are eligible.
  const { data: pool = [] } = useQuery({
    queryKey: ["plan-people-pool", projectId, wsId, workspace?.organization_id, project?.visibility, projectMembers.length, workspaceMembers.length, orgMembers.length],
    enabled: !!(projectMembers || workspaceMembers || orgMembers),
    queryFn: async () => {
      const raw = project?.visibility === "restricted"
        ? projectMembers
        : [...projectMembers, ...workspaceMembers, ...orgMembers];
      const map = new Map<string, { user_id: string; role?: string }>();
      raw.forEach((m: any) => { if (m?.user_id && !map.has(m.user_id)) map.set(m.user_id, m); });
      const ids = Array.from(map.keys());
      if (!ids.length) return [];
      const { data: profs } = await supabase.from("profiles").select("id, name, email").in("id", ids);
      return ids.map((uid) => ({
        user_id: uid,
        role: map.get(uid)?.role,
        profile: profs?.find((p: any) => p.id === uid),
      }));
    },
  });

  const { data: canManage = false } = useQuery({
    queryKey: ["plan-people-canmanage", planId],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("can_manage_plan_assignees", { _plan_id: planId });
      return !!data;
    },
  });

  const ownerCount = assignees.filter((a: any) => a.role === "owner").length;

  const available = useMemo(() => {
    const taken = new Set(assignees.map((a: any) => a.user_id));
    return pool.filter((m: any) => !taken.has(m.user_id));
  }, [pool, assignees]);

  const add = useMutation({
    mutationFn: async () => {
      if (!addUserId) throw new Error("Pick a person");
      const { error } = await supabase.from("test_plan_assignees").insert({
        test_plan_id: planId, user_id: addUserId, role: addRole, assigned_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assigned to test plan");
      setAddUserId(""); setAddRole("assignee");
      qc.invalidateQueries({ queryKey: ["plan-people", planId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role, prev }: { id: string; role: PlanRole; prev: PlanRole }) => {
      if (prev === "owner" && role !== "owner" && ownerCount <= 1) {
        throw new Error("At least one owner is required");
      }
      const { error } = await supabase.from("test_plan_assignees").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plan-people", planId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (a: any) => {
      if (a.role === "owner" && ownerCount <= 1) throw new Error("At least one owner is required");
      const { error } = await supabase.from("test_plan_assignees").delete().eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["plan-people", planId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Assign Person
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger className="flex-1 min-w-[240px]">
                  <SelectValue placeholder={available.length ? "Select a person" : "Everyone eligible is already assigned"} />
                </SelectTrigger>
                <SelectContent>
                  {available.map((m: any) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.profile?.name || m.profile?.email || m.user_id}
                      <span className="text-xs text-muted-foreground ml-2">{m.profile?.email}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={addRole} onValueChange={(v) => setAddRole(v as PlanRole)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="assignee">Assignee</SelectItem>
                  <SelectItem value="reviewer">Reviewer</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => add.mutate()}
                disabled={add.isPending || !addUserId}
                className="ai-gradient text-white"
              >
                {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Candidates come from {project?.visibility === "restricted" ? "the project's members" : "workspace members"}.
              Owners &amp; Reviewers can approve release sign-off for this plan.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Assigned by</TableHead>
              <TableHead>Assigned</TableHead>
              {canManage && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignees.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 5 : 4} className="text-center py-8 text-muted-foreground text-sm">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No people assigned yet
                </TableCell>
              </TableRow>
            )}
            {assignees.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell>
                  <div className="font-medium">{a.profile?.name || "Unknown"}</div>
                  <div className="text-xs text-muted-foreground">{a.profile?.email}</div>
                </TableCell>
                <TableCell>
                  {canManage ? (
                    <Select
                      value={a.role}
                      onValueChange={(v) => updateRole.mutate({ id: a.id, role: v as PlanRole, prev: a.role })}
                    >
                      <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="assignee">Assignee</SelectItem>
                        <SelectItem value="reviewer">Reviewer</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge variant="outline" className="capitalize">{a.role}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {a.assigner?.name || a.assigner?.email || "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <Button
                      size="icon" variant="ghost" className="h-8 w-8"
                      onClick={() => remove.mutate(a)}
                      disabled={a.role === "owner" && ownerCount <= 1}
                      title={a.role === "owner" && ownerCount <= 1 ? "At least one owner is required" : "Remove"}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// Hook for gating release/cycle sign-off actions elsewhere in the app.
export function useCanSignoffPlan(planId: string | null | undefined) {
  return useQuery({
    queryKey: ["plan-signoff", planId],
    enabled: !!planId,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("can_signoff_plan", { _plan_id: planId });
      return !!data;
    },
  });
}
