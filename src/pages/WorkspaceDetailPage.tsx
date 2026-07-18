import { useState, useEffect } from "react";
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
import { ProjectWizard } from "@/components/projects/ProjectWizard";
import { toast } from "sonner";
import {
  Plus, Trash2, Users, FolderOpen, Mail, UserPlus, Save, Loader2,
  Github, FileArchive, FileText, ArrowRight, Link2, Copy,
} from "lucide-react";

function inviteLinkFor(token: string) {
  return `${window.location.origin}/invitations/accept?token=${token}`;
}
async function copyInviteLink(token: string) {
  const link = inviteLinkFor(token);
  try {
    await navigator.clipboard.writeText(link);
    toast.success("Invite link copied", { description: link });
  } catch {
    toast.message("Copy failed", { description: link });
  }
}

type WsRole = "owner" | "admin" | "editor" | "viewer";

const sourceIcon = { documentation: FileText, zip: FileArchive, github: Github } as const;

export default function WorkspaceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refresh, setCurrentWorkspaceId, setCurrentProjectId } = useWorkspace();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") || "projects");
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: workspace, isLoading } = useQuery({
    queryKey: ["ws", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["ws-projects", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects").select("*").eq("workspace_id", id!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["ws-members", id],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("workspace_members")
        .select("id,role,user_id,created_at")
        .eq("workspace_id", id!);
      if (!rows?.length) return [];
      const userIds = rows.map((r: any) => r.user_id);
      const { data: profs } = await supabase
        .from("profiles").select("id,name,email,avatar").in("id", userIds);
      return rows.map((r: any) => ({
        ...r,
        profile: profs?.find((p: any) => p.id === r.user_id),
      }));
    },
    enabled: !!id,
  });

  const { data: invites = [] } = useQuery({
    queryKey: ["ws-invites", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_invitations")
        .select("*").eq("workspace_id", id!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!id,
  });

  const myRole = (members.find((m: any) => m.user_id === user?.id)?.role || (workspace?.owner_id === user?.id ? "owner" : "viewer")) as WsRole;
  const canManage = myRole === "owner" || myRole === "admin";

  // mutations
  const updateWs = useMutation({
    mutationFn: async (vals: any) => {
      const { error } = await supabase.from("workspaces").update(vals).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["ws", id] });
      refresh();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteWs = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("workspaces").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Workspace deleted");
      setCurrentWorkspaceId(null);
      refresh();
      navigate("/workspaces");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteProject = useMutation({
    mutationFn: async (pid: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", pid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project deleted");
      qc.invalidateQueries({ queryKey: ["ws-projects", id] });
      refresh();
    },
  });

  const updateMemberRole = useMutation({
    mutationFn: async ({ mid, role }: { mid: string; role: WsRole }) => {
      const { error } = await supabase.from("workspace_members").update({ role }).eq("id", mid);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ws-members", id] }),
  });

  const removeMember = useMutation({
    mutationFn: async (mid: string) => {
      const { error } = await supabase.from("workspace_members").delete().eq("id", mid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member removed");
      qc.invalidateQueries({ queryKey: ["ws-members", id] });
    },
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WsRole>("editor");

  const invite = useMutation({
    mutationFn: async () => {
      const email = inviteEmail.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Invalid email");
      // if user exists, add directly
      const { data: existing } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
      if (existing) {
        // Already a member? update role. Otherwise insert.
        const { data: prev } = await supabase.from("workspace_members")
          .select("id").eq("workspace_id", id!).eq("user_id", existing.id).maybeSingle();
        if (prev) {
          const { error } = await supabase.from("workspace_members")
            .update({ role: inviteRole }).eq("id", prev.id);
          if (error) throw error;
          return { kind: "existing" as const };
        }
        const { error } = await supabase.from("workspace_members").insert({
          workspace_id: id, user_id: existing.id, role: inviteRole,
        });
        if (error) throw error;
        return { kind: "member" as const };
      }
      const { data: created, error } = await supabase.from("workspace_invitations").insert({
        workspace_id: id, email, role: inviteRole, invited_by: user?.id,
      }).select("id,token").single();
      if (error) throw error;
      // Optional email delivery — no-ops gracefully when RESEND_API_KEY is unset.
      supabase.functions.invoke("send-invitation-email", {
        body: {
          invitation_id: created.id,
          accept_url: inviteLinkFor(created.token),
        },
      }).catch(() => {});
      return { kind: "invite" as const, token: created.token };
    },
    onSuccess: async (result) => {
      if (result.kind === "existing") {
        toast.success("Role updated for existing member");
      } else if (result.kind === "member") {
        toast.success("Added to workspace");
      } else {
        toast.success("Invitation created");
        await copyInviteLink(result.token);
      }
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["ws-members", id] });
      qc.invalidateQueries({ queryKey: ["ws-invites", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revokeInvite = useMutation({
    mutationFn: async (iid: string) => {
      const { error } = await supabase.from("workspace_invitations").delete().eq("id", iid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invitation revoked");
      qc.invalidateQueries({ queryKey: ["ws-invites", id] });
    },
  });

  // settings local state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  useEffect(() => {
    if (workspace) {
      setName(workspace.name);
      setDescription(workspace.description || "");
      setSlackWebhookUrl((workspace as any).slack_webhook_url || "");
    }
  }, [workspace]);

  if (isLoading || !workspace) {
    return <AppLayout><div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="mb-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/workspaces")} className="h-8 px-2 -ml-2">
          <ArrowRight className="h-4 w-4 mr-1 rotate-180" /> Back to workspaces
        </Button>
      </div>
      <PageHeader
        title={workspace.name}
        description={`${workspace.description || "Workspace overview"} · Created ${new Date(workspace.created_at).toLocaleString()}`}
        breadcrumbs={[{ label: "Workspaces", href: "/workspaces" }, { label: workspace.name }]}
        actions={
          canManage && (
            <Button className="ai-gradient text-white" onClick={() => setWizardOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New Project
            </Button>
          )
        }
      />

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setParams({ tab: v }); }}>
        <TabsList>
          <TabsTrigger value="projects">Projects ({projects.length})</TabsTrigger>
          <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
          <TabsTrigger value="invites">Invitations ({invites.length})</TabsTrigger>
          {canManage && <TabsTrigger value="settings">Settings</TabsTrigger>}
        </TabsList>

        {/* PROJECTS */}
        <TabsContent value="projects" className="space-y-4">
          {projects.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">No projects yet</p>
              {canManage && (
                <Button onClick={() => setWizardOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Create first project
                </Button>
              )}
            </CardContent></Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p: any) => {
                const Icon = sourceIcon[p.source_type as keyof typeof sourceIcon] || FileText;
                return (
                  <Card key={p.id} className="hover:border-accent/40 transition-colors group">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                            <Icon className="h-4 w-4 text-accent" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-sm truncate">{p.name}</CardTitle>
                            <Badge variant="outline" className="text-xs mt-1">{p.status}</Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{p.description || "No description"}</p>
                      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                        <div><div className="font-semibold">{p.files_count || 0}</div><div className="text-muted-foreground">Files</div></div>
                        <div><div className="font-semibold">{p.endpoints_count || 0}</div><div className="text-muted-foreground">Endpoints</div></div>
                        <div><div className="font-semibold">{p.test_cases_count || 0}</div><div className="text-muted-foreground">Tests</div></div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => { setCurrentWorkspaceId(p.workspace_id); setCurrentProjectId(p.id); navigate("/documents"); }}>
                          Open <ArrowRight className="ml-2 h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/projects/${p.id}`)}>
                          Manage
                        </Button>
                        {canManage && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete project?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently delete "{p.name}".</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteProject.mutate(p.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* MEMBERS */}
        <TabsContent value="members" className="space-y-4">
          {canManage && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserPlus className="h-4 w-4" /> Add Member</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input placeholder="email@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="flex-1" />
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as WsRole)}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => invite.mutate()} disabled={invite.isPending} className="ai-gradient text-white">
                    {invite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">If the email matches an existing user, they're added immediately. Otherwise an invitation is created.</p>
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
                {members.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="font-medium">{m.profile?.name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{m.profile?.email}</div>
                    </TableCell>
                    <TableCell>
                      {canManage && m.role !== "owner" ? (
                        <Select value={m.role} onValueChange={(v) => updateMemberRole.mutate({ mid: m.id, role: v as WsRole })}>
                          <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline">{m.role}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString()}</TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        {m.role !== "owner" && (
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeMember.mutate(m.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* INVITATIONS */}
        <TabsContent value="invites">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                  {canManage && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No invitations</TableCell></TableRow>
                )}
                {invites.map((iv: any) => (
                  <TableRow key={iv.id}>
                    <TableCell className="flex items-center gap-2"><Mail className="h-3 w-3 text-muted-foreground" />{iv.email}</TableCell>
                    <TableCell><Badge variant="outline">{iv.role}</Badge></TableCell>
                    <TableCell><Badge variant={iv.status === "pending" ? "secondary" : "outline"}>{iv.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(iv.expires_at).toLocaleDateString()}</TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {iv.status === "pending" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 gap-1.5"
                              onClick={() => copyInviteLink(iv.token)}
                              title="Copy invite link"
                            >
                              <Link2 className="h-3.5 w-3.5" />
                              <span className="text-xs">Copy link</span>
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => revokeInvite.mutate(iv.id)} title="Revoke">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* SETTINGS */}
        {canManage && (
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Workspace Settings</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
                <div className="space-y-2">
                  <Label>Slack incoming-webhook URL (workspace fallback)</Label>
                  <Input
                    value={slackWebhookUrl}
                    onChange={(e) => setSlackWebhookUrl(e.target.value)}
                    placeholder="https://hooks.slack.com/services/…"
                  />
                  <p className="text-xs text-muted-foreground">
                    Used for members who enable Slack notifications but haven't set a personal webhook.
                  </p>
                </div>
                <Button
                  onClick={() =>
                    updateWs.mutate({ name, description, slack_webhook_url: slackWebhookUrl.trim() || null })
                  }
                  className="ai-gradient text-white"
                >
                  <Save className="mr-2 h-4 w-4" /> Save changes
                </Button>
              </CardContent>
            </Card>
            <Card className="border-destructive/40">
              <CardHeader><CardTitle className="text-base text-destructive">Danger Zone</CardTitle></CardHeader>
              <CardContent>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete workspace</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently removes the workspace, its projects, members, and invitations.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteWs.mutate()}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <ProjectWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        workspaceId={id}
        onCreated={() => qc.invalidateQueries({ queryKey: ["ws-projects", id] })}
      />
    </AppLayout>
  );
}
