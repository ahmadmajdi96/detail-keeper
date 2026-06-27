import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, X, Mail, UserPlus, ArrowRight, Check, FolderPlus, Users } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WsRole = "owner" | "admin" | "editor" | "viewer";

interface PendingMember {
  email: string;
  role: WsRole;
  user_id?: string;
}

export function WorkspaceWizard({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { refresh, setCurrentWorkspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<PendingMember[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [emailRole, setEmailRole] = useState<WsRole>("editor");
  const [picked, setPicked] = useState<string>("");

  const { data: existingUsers = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,email,name").neq("id", user?.id || "");
      return data || [];
    },
    enabled: open,
  });

  const reset = () => {
    setStep(1);
    setName("");
    setDescription("");
    setMembers([]);
    setEmailInput("");
    setPicked("");
  };

  const addEmailMember = () => {
    const e = emailInput.trim().toLowerCase();
    if (!e || !/^\S+@\S+\.\S+$/.test(e)) {
      toast.error("Enter a valid email");
      return;
    }
    if (members.some((m) => m.email === e)) {
      toast.error("Already added");
      return;
    }
    const existing = existingUsers.find((u: any) => u.email.toLowerCase() === e);
    setMembers([...members, { email: e, role: emailRole, user_id: existing?.id }]);
    setEmailInput("");
  };

  const addPickedMember = () => {
    const u = existingUsers.find((x: any) => x.id === picked);
    if (!u) return;
    if (members.some((m) => m.user_id === u.id)) {
      toast.error("Already added");
      return;
    }
    setMembers([...members, { email: u.email, role: emailRole, user_id: u.id }]);
    setPicked("");
  };

  const create = useMutation({
    mutationFn: async () => {
      const { data: ws, error } = await supabase
        .from("workspaces")
        .insert({ name, description, owner_id: user?.id })
        .select("id")
        .single();
      if (error) throw error;
      const wsId = ws.id;

      // direct members (existing users)
      const directMembers = members
        .filter((m) => m.user_id)
        .map((m) => ({ workspace_id: wsId, user_id: m.user_id!, role: m.role }));
      if (directMembers.length) {
        await supabase.from("workspace_members").insert(directMembers);
      }

      // email invitations (for users not yet registered or by email choice)
      const inviteRows = members
        .filter((m) => !m.user_id)
        .map((m) => ({
          workspace_id: wsId,
          email: m.email,
          role: m.role,
          invited_by: user?.id,
        }));
      if (inviteRows.length) {
        await supabase.from("workspace_invitations").insert(inviteRows);
      }
      return wsId;
    },
    onSuccess: async (wsId) => {
      toast.success("Workspace created");
      await refresh();
      setCurrentWorkspaceId(wsId);
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      onOpenChange(false);
      reset();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-accent" />
            New Workspace
          </DialogTitle>
          <DialogDescription>
            Step {step} of 2 — {step === 1 ? "Workspace details" : "Invite members"}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 my-2">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${
                step >= s ? "bg-accent" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Workspace name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Payments Platform QA"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this workspace for?"
                rows={3}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border/60 p-4 space-y-3">
              <Label className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" /> Pick existing user
              </Label>
              <div className="flex gap-2">
                <Select value={picked} onValueChange={setPicked}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Choose user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {existingUsers.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={emailRole} onValueChange={(v) => setEmailRole(v as WsRole)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={addPickedMember} disabled={!picked} size="icon">
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 p-4 space-y-3">
              <Label className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4" /> Invite by email
              </Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="teammate@company.com"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmailMember())}
                  className="flex-1"
                />
                <Select value={emailRole} onValueChange={(v) => setEmailRole(v as WsRole)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={addEmailMember} size="icon">
                  <UserPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {members.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Pending — {members.length} {members.length === 1 ? "person" : "people"}
                </Label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {members.map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-md border border-border/40 px-3 py-2 text-sm bg-card/40"
                    >
                      {m.user_id ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="flex-1 truncate">{m.email}</span>
                      <Badge variant="outline" className="text-xs">
                        {m.role}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {m.user_id ? "Add now" : "Invite"}
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => setMembers(members.filter((_, idx) => idx !== i))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {step === 1 ? (
            <Button
              onClick={() => setStep(2)}
              disabled={!name.trim()}
              className="ai-gradient text-white"
            >
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending}
              className="ai-gradient text-white"
            >
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create workspace
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
