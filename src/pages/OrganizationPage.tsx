import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useOrganization, type OrgRole } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Trash2, UserPlus, Loader2 } from "lucide-react";
import { OrgSsoPanel } from "@/components/organization/OrgSsoPanel";
import { OrgDangerZone } from "@/components/organization/OrgDangerZone";
import { useEntitlements } from "@/hooks/useEntitlements";

const ROLES: OrgRole[] = ["owner", "billing_admin", "security_admin", "member"];

export default function OrganizationPage() {
  const { currentOrganization, currentOrgRole, refresh } = useOrganization();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<OrgRole>("member");

  const isOwner = currentOrgRole === "owner";
  const orgId = currentOrganization?.id;

  // Sync form when org changes
  if (currentOrganization && name === "" && slug === "") {
    setName(currentOrganization.name);
    setSlug(currentOrganization.slug || "");
  }

  const membersQ = useQuery({
    queryKey: ["org-members", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("id,user_id,role,created_at")
        .eq("org_id", orgId!);
      if (error) throw error;
      const ids = (data || []).map((m) => m.user_id);
      let profiles: any[] = [];
      if (ids.length) {
        const { data: p } = await supabase.from("profiles").select("id,name,email,avatar").in("id", ids);
        profiles = p || [];
      }
      return (data || []).map((m) => ({ ...m, profile: profiles.find((p) => p.id === m.user_id) }));
    },
  });

  const saveGeneral = useMutation({
    mutationFn: async () => {
      if (!orgId) return;
      const { error } = await supabase
        .from("organizations")
        .update({ name, slug: slug || null })
        .eq("id", orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Organization updated");
      refresh();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addMember = useMutation({
    mutationFn: async () => {
      if (!orgId) return;
      const email = newEmail.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Invalid email");
      const { data: ok } = await supabase.rpc("within_quota", { _org_id: orgId, _kind: "seats", _additional: 1 });
      if (ok === false) throw new Error("quota_exceeded:seats");
      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("id,email")
        .ilike("email", email)
        .maybeSingle();
      if (pErr) throw pErr;
      if (!prof) throw new Error("No user with that email yet. Ask them to sign up first.");
      const { error } = await supabase
        .from("organization_members")
        .insert({ org_id: orgId, user_id: prof.id, role: newRole });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member added");
      setNewEmail("");
      qc.invalidateQueries({ queryKey: ["org-members", orgId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: OrgRole }) => {
      const { error } = await supabase.from("organization_members").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-members", orgId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("organization_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member removed");
      qc.invalidateQueries({ queryKey: ["org-members", orgId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!currentOrganization) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title={currentOrganization.name}
        description="Organization settings and members"
      />

      <Tabs defaultValue="general" className="mt-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="sso">SSO</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-w-lg">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner} />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} disabled={!isOwner} />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Your role: {currentOrgRole || "—"}</Badge>
              </div>
              {isOwner && (
                <Button onClick={() => saveGeneral.mutate()} disabled={saveGeneral.isPending}>
                  {saveGeneral.isPending ? "Saving..." : "Save changes"}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-4 space-y-4">
          {isOwner && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add member</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[220px] space-y-2">
                  <Label>Email of an existing user</Label>
                  <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as OrgRole)}>
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => addMember.mutate()} disabled={addMember.isPending}>
                  <UserPlus className="h-4 w-4 mr-2" /> Add
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Members</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(membersQ.data || []).map((m: any) => {
                    const isSelf = m.user_id === user?.id;
                    const isOrgOwner = m.user_id === currentOrganization.owner_id;
                    return (
                      <TableRow key={m.id}>
                        <TableCell>{m.profile?.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{m.profile?.email}</TableCell>
                        <TableCell>
                          {isOwner && !isOrgOwner ? (
                            <Select value={m.role} onValueChange={(v) => updateRole.mutate({ id: m.id, role: v as OrgRole })}>
                              <SelectTrigger className="w-[160px] h-8"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {ROLES.filter((r) => r !== "owner").map((r) => (
                                  <SelectItem key={r} value={r}>{r}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant={isOrgOwner ? "default" : "outline"}>{m.role}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {isOwner && !isOrgOwner && !isSelf && (
                            <Button variant="ghost" size="icon" onClick={() => removeMember.mutate(m.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!membersQ.data || membersQ.data.length === 0) && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No members</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <OrgSecurityPanel
            orgId={currentOrganization.id}
            canManage={currentOrgRole === "owner" || currentOrgRole === "security_admin"}
            initial={!!(currentOrganization as any).require_mfa}
            onSaved={refresh}
          />
        </TabsContent>

        <TabsContent value="sso" className="mt-4">
          <SsoTabBody orgId={currentOrganization.id} canManage={currentOrgRole === "owner" || currentOrgRole === "security_admin"} />
        </TabsContent>

        <TabsContent value="data" className="mt-4">
          <OrgDangerZone
            orgId={currentOrganization.id}
            orgName={currentOrganization.name}
            orgSlug={currentOrganization.slug}
            isOwner={isOwner}
          />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

function OrgSecurityPanel({ orgId, canManage, initial, onSaved }: { orgId: string; canManage: boolean; initial: boolean; onSaved: () => void }) {
  const [required, setRequired] = useState(initial);
  const [saving, setSaving] = useState(false);
  const save = async (v: boolean) => {
    setSaving(true);
    const { error } = await supabase.from("organizations").update({ require_mfa: v } as any).eq("id", orgId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setRequired(v);
    onSaved();
    toast.success(v ? "MFA now required for all members" : "MFA requirement disabled");
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-factor authentication policy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 max-w-xl">
        <div className="flex items-center justify-between rounded-md border border-border/50 p-4">
          <div>
            <div className="font-medium">Require MFA for all members</div>
            <div className="text-sm text-muted-foreground">Members without a verified authenticator app will be prompted to enroll before they can use the app.</div>
          </div>
          <Switch checked={required} disabled={!canManage || saving} onCheckedChange={save} />
        </div>
        {!canManage && <p className="text-xs text-muted-foreground">Only the org owner or a security admin can change this policy.</p>}
      </CardContent>
    </Card>
  );
}
