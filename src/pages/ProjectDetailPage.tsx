import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Loader2, Users, UserPlus, Trash2, Save, ArrowRight, Globe, Lock, FolderOpen, GitBranch,
} from "lucide-react";
import { RepoFilesPanel } from "@/components/projects/RepoFilesPanel";

type ProjectRole = "lead" | "contributor" | "viewer";
type WsRole = "owner" | "admin" | "editor" | "viewer";

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setCurrentWorkspaceId, setCurrentProjectId, refresh } = useWorkspace();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") || "overview");

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: workspace } = useQuery({
    queryKey: ["ws", project?.workspace_id],
    queryFn: async () => {
      const { data } = await supabase.from("workspaces").select("*").eq("id", project!.workspace_id).single();
      return data;
    },
    enabled: !!project?.workspace_id,
  });

  const { data: wsMembers = [] } = useQuery({
    queryKey: ["ws-members-simple", project?.workspace_id],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("workspace_members").select("user_id,role").eq("workspace_id", project!.workspace_id);
      if (!rows?.length) return [];
      const ids = rows.map((r: any) => r.user_id);
      const { data: profs } = await supabase.from("profiles").select("id,name,email").in("id", ids);
      return rows.map((r: any) => ({ ...r, profile: profs?.find((p: any) => p.id === r.user_id) }));
    },
    enabled: !!project?.workspace_id,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["project-members", id],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("project_members").select("id,role,user_id,created_at").eq("project_id", id!);
      if (!rows?.length) return [];
      const ids = rows.map((r: any) => r.user_id);
      const { data: profs } = await supabase.from("profiles").select("id,name,email,avatar").in("id", ids);
      return rows.map((r: any) => ({ ...r, profile: profs?.find((p: any) => p.id === r.user_id) }));
    },
    enabled: !!id,
  });

  const myWsRole = useMemo<WsRole | undefined>(() => {
    if (!user) return undefined;
    if (workspace?.owner_id === user.id) return "owner";
    return wsMembers.find((m: any) => m.user_id === user.id)?.role;
  }, [wsMembers, workspace, user]);

  const myProjectRole = useMemo<ProjectRole | undefined>(() => {
    return members.find((m: any) => m.user_id === user?.id)?.role;
  }, [members, user]);

  const canManage =
    myWsRole === "owner" || myWsRole === "admin" || myProjectRole === "lead";

  const leadCount = members.filter((m: any) => m.role === "lead").length;

  // form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"inherited" | "restricted">("inherited");
  useEffect(() => {
    if (project) {
      setName(project.name || "");
      setDescription(project.description || "");
      setVisibility((project.visibility as any) || "inherited");
    }
  }, [project]);

  // add-member
  const [addUserId, setAddUserId] = useState<string>("");
  const [addRole, setAddRole] = useState<ProjectRole>("contributor");

  const availableToAdd = useMemo(() => {
    const existingIds = new Set(members.map((m: any) => m.user_id));
    return wsMembers.filter((m: any) => !existingIds.has(m.user_id));
  }, [wsMembers, members]);

  const updateProject = useMutation({
    mutationFn: async (vals: any) => {
      const { error } = await supabase.from("projects").update(vals).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["ws-projects"] });
      refresh();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteProject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project deleted");
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["ws-projects"] });
      refresh();
      navigate("/projects");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addMember = useMutation({
    mutationFn: async () => {
      if (!addUserId) throw new Error("Pick a member");
      const { error } = await supabase.from("project_members").insert({
        project_id: id!, user_id: addUserId, role: addRole,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member added");
      setAddUserId("");
      setAddRole("contributor");
      qc.invalidateQueries({ queryKey: ["project-members", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMemberRole = useMutation({
    mutationFn: async ({ mid, role, prev }: { mid: string; role: ProjectRole; prev: ProjectRole }) => {
      if (prev === "lead" && role !== "lead" && leadCount <= 1) {
        throw new Error("At least one lead is required");
      }
      const { error } = await supabase.from("project_members").update({ role }).eq("id", mid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-members", id] }),
    onError: (e: any) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (m: any) => {
      if (m.role === "lead" && leadCount <= 1) {
        throw new Error("At least one lead is required");
      }
      const { error } = await supabase.from("project_members").delete().eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member removed");
      qc.invalidateQueries({ queryKey: ["project-members", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !project) {
    return <AppLayout><div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div></AppLayout>;
  }

  const openProject = () => {
    setCurrentWorkspaceId(project.workspace_id);
    setCurrentProjectId(project.id);
    navigate("/documents");
  };

  return (
    <AppLayout>
      <PageHeader
        title={project.name}
        description={project.description || "Project details"}
        breadcrumbs={[
          { label: "Workspaces", href: "/workspaces" },
          ...(workspace ? [{ label: workspace.name, href: `/workspaces/${workspace.id}` }] : []),
          { label: project.name },
        ]}
        actions={
          <Button onClick={openProject} className="ai-gradient text-white">
            Open <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setParams({ tab: v }); }}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {project.source_type === "github" && (
            <TabsTrigger value="repository"><GitBranch className="h-3.5 w-3.5 mr-1" /> Repository</TabsTrigger>
          )}
          <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Source</CardTitle></CardHeader>
              <CardContent><div className="text-lg font-semibold capitalize">{project.source_type || "—"}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Status</CardTitle></CardHeader>
              <CardContent><Badge variant="outline" className="capitalize">{project.status}</Badge></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Visibility</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {project.visibility === "restricted" ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                  <span className="capitalize font-medium">{project.visibility || "inherited"}</span>
                </div>
              </CardContent></Card>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Files</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{project.files_count || 0}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Endpoints</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{project.endpoints_count || 0}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Test cases</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{project.test_cases_count || 0}</div></CardContent></Card>
          </div>
          {project.github_url && (
            <Card><CardContent className="py-4 text-sm">
              <span className="text-muted-foreground">Repository: </span>
              <a href={project.github_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">{project.github_url}</a>
              {project.github_branch && <span className="text-muted-foreground"> · branch {project.github_branch}</span>}
            </CardContent></Card>
          )}
        </TabsContent>

        {project.source_type === "github" && (
          <TabsContent value="repository" className="space-y-4">
            <RepoFilesPanel
              projectId={project.id}
              repoJobId={(project as any).repo_job_id || null}
              repoJobStatus={(project as any).repo_job_status || null}
              repoJobProgress={(project as any).repo_job_progress ?? null}
              canEdit={canManage}
            />
          </TabsContent>
        )}

        {/* MEMBERS */}
        <TabsContent value="members" className="space-y-4">
          {canManage && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" /> Add Project Member</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Select value={addUserId} onValueChange={setAddUserId}>
                    <SelectTrigger className="flex-1 min-w-[240px]">
                      <SelectValue placeholder={availableToAdd.length ? "Select workspace member" : "All workspace members already added"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableToAdd.map((m: any) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.profile?.name || m.profile?.email || m.user_id}
                          <span className="text-xs text-muted-foreground ml-2">{m.profile?.email}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={addRole} onValueChange={(v) => setAddRole(v as ProjectRole)}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="contributor">Contributor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => addMember.mutate()}
                    disabled={addMember.isPending || !addUserId}
                    className="ai-gradient text-white"
                  >
                    {addMember.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Project members must first be workspace members. Invite new people from the workspace's Members tab.
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
                  <TableHead>Added</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canManage ? 4 : 3} className="text-center py-8 text-muted-foreground text-sm">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      No project members yet
                    </TableCell>
                  </TableRow>
                )}
                {members.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="font-medium">{m.profile?.name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{m.profile?.email}</div>
                    </TableCell>
                    <TableCell>
                      {canManage ? (
                        <Select
                          value={m.role}
                          onValueChange={(v) => updateMemberRole.mutate({ mid: m.id, role: v as ProjectRole, prev: m.role })}
                        >
                          <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lead">Lead</SelectItem>
                            <SelectItem value="contributor">Contributor</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="capitalize">{m.role}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <Button
                          size="icon" variant="ghost" className="h-8 w-8"
                          onClick={() => removeMember.mutate(m)}
                          disabled={m.role === "lead" && leadCount <= 1}
                          title={m.role === "lead" && leadCount <= 1 ? "At least one lead is required" : "Remove"}
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
        </TabsContent>

        {/* SETTINGS */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Project Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canManage} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canManage} rows={3} />
              </div>
              {canManage && (
                <Button
                  onClick={() => updateProject.mutate({ name, description })}
                  disabled={updateProject.isPending}
                  className="ai-gradient text-white"
                >
                  {updateProject.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save changes
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Visibility</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 md:grid-cols-2">
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => { setVisibility("inherited"); updateProject.mutate({ visibility: "inherited" }); }}
                  className={`text-left rounded-lg border p-4 transition-colors ${visibility === "inherited" ? "border-accent bg-accent/5" : "border-border hover:border-accent/40"} disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center gap-2 font-medium"><Globe className="h-4 w-4" /> Inherited</div>
                  <p className="text-xs text-muted-foreground mt-1">All workspace members can access this project.</p>
                </button>
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => { setVisibility("restricted"); updateProject.mutate({ visibility: "restricted" }); }}
                  className={`text-left rounded-lg border p-4 transition-colors ${visibility === "restricted" ? "border-accent bg-accent/5" : "border-border hover:border-accent/40"} disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center gap-2 font-medium"><Lock className="h-4 w-4" /> Restricted</div>
                  <p className="text-xs text-muted-foreground mt-1">Only members added on the Members tab (plus workspace owners/admins) can access.</p>
                </button>
              </div>
            </CardContent>
          </Card>

          {canManage && (
            <Card className="border-destructive/40">
              <CardHeader><CardTitle className="text-base text-destructive">Danger Zone</CardTitle></CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete project</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete "{project.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently deletes the project and all associated data. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteProject.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete permanently
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
