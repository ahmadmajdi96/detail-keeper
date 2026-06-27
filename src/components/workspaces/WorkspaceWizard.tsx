import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  CheckCircle2, XCircle, Loader2, ArrowRight, ArrowLeft,
  Check, Terminal, Users, Mail, UserPlus, Zap, FolderKanban,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WsRole = "admin" | "editor" | "viewer";
const ROLES: { value: WsRole; label: string; tag: string }[] = [
  { value: "admin", label: "Admin", tag: "FULL" },
  { value: "editor", label: "Editor", tag: "WRITE" },
  { value: "viewer", label: "Viewer", tag: "READ" },
];

interface PendingMember { email: string; role: WsRole; user_id?: string; name?: string }

const STEPS = ["Workspace Identity", "Members", "Review"];

function MonoLabel({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[10px] tracking-[0.18em] text-[#4a6a88] uppercase">{children}</span>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-2"><MonoLabel>{label}</MonoLabel>{children}</div>;
}
function StyledInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input {...rest}
      className={"w-full bg-[#070e1c] border border-[rgba(0,200,220,0.14)] rounded text-[#dde8f0] font-mono text-sm px-4 py-3 outline-none placeholder:text-[#1e3548] focus:border-[#00cfe0] focus:shadow-[0_0_0_2px_rgba(0,207,224,0.12)] " + className} />
  );
}
function StyledTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea {...rest}
      className={"w-full bg-[#070e1c] border border-[rgba(0,200,220,0.14)] rounded text-[#dde8f0] font-mono text-sm px-4 py-3 outline-none placeholder:text-[#1e3548] focus:border-[#00cfe0] " + className} />
  );
}

export function WorkspaceWizard({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { refresh, setCurrentWorkspaceId } = useWorkspace();
  const qc = useQueryClient();

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
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
    setStep(0); setDone(false); setName(""); setDescription("");
    setMembers([]); setEmailInput(""); setPicked("");
  };

  const addEmail = () => {
    const e = emailInput.trim().toLowerCase();
    if (!e || !/^\S+@\S+\.\S+$/.test(e)) return toast.error("Enter a valid email");
    if (members.some((m) => m.email === e)) return toast.error("Already added");
    const exists = existingUsers.find((u: any) => u.email.toLowerCase() === e);
    setMembers([...members, { email: e, role: emailRole, user_id: exists?.id, name: exists?.name }]);
    setEmailInput("");
  };
  const addPicked = () => {
    const u = existingUsers.find((x: any) => x.id === picked);
    if (!u) return;
    if (members.some((m) => m.user_id === u.id)) return toast.error("Already added");
    setMembers([...members, { email: u.email, role: emailRole, user_id: u.id, name: u.name }]);
    setPicked("");
  };

  const create = useMutation({
    mutationFn: async () => {
      const { data: ws, error } = await supabase.from("workspaces").insert({ name, description, owner_id: user?.id }).select("id").single();
      if (error) throw error;
      const wsId = ws.id;
      const direct = members.filter((m) => m.user_id).map((m) => ({ workspace_id: wsId, user_id: m.user_id!, role: m.role }));
      if (direct.length) await supabase.from("workspace_members").insert(direct);
      const invites = members.filter((m) => !m.user_id).map((m) => ({ workspace_id: wsId, email: m.email, role: m.role, invited_by: user?.id }));
      if (invites.length) await supabase.from("workspace_invitations").insert(invites);
      return wsId;
    },
    onSuccess: async (wsId) => {
      toast.success("Workspace created");
      setDone(true);
      await refresh();
      setCurrentWorkspaceId(wsId);
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      setTimeout(() => { onOpenChange(false); reset(); }, 1600);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const canNext = () => {
    if (step === 0) return name.trim() !== "";
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-[920px] p-0 border-0 bg-transparent shadow-none overflow-hidden">
        <DialogTitle className="sr-only">New Workspace Setup Wizard</DialogTitle>
        <div className="relative w-full" style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "radial-gradient(ellipse 70% 50% at 50% -5%, rgba(0,60,180,0.2) 0%, transparent 65%), #04070f", borderRadius: 12 }}>
          <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden"
            style={{ backgroundImage: "linear-gradient(rgba(0,200,220,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,200,220,0.03) 1px, transparent 1px)", backgroundSize: "52px 52px" }} />

          <div className="relative z-10 flex rounded-xl overflow-hidden" style={{ background: "rgba(6,11,22,0.97)", border: "1px solid rgba(0,190,215,0.13)", boxShadow: "0 0 80px rgba(0,60,180,0.14)" }}>
            <div className="w-60 shrink-0 p-7 flex flex-col border-r border-[rgba(0,190,215,0.1)]" style={{ background: "rgba(4,8,18,0.7)" }}>
              <div className="mb-9">
                <div className="flex items-center gap-2 mb-1.5">
                  <Terminal size={13} className="text-[#00cfe0]" />
                  <span className="font-mono text-[9px] tracking-[0.25em] text-[#00cfe0]">WORKSPACE WIZARD</span>
                </div>
                <div className="h-px bg-gradient-to-r from-[rgba(0,207,224,0.35)] to-transparent" />
              </div>
              {STEPS.map((label, i) => {
                const isDone = done || i < step;
                const isActive = !done && i === step;
                return (
                  <div key={i} className="relative flex items-start gap-3.5 pb-7 last:pb-0">
                    {i < STEPS.length - 1 && (
                      <div className="absolute left-[14px] top-7 w-px" style={{ height: "calc(100% - 4px)", background: isDone ? "linear-gradient(180deg, #00cfe0, rgba(0,207,224,0.2))" : "rgba(0,180,200,0.09)" }} />
                    )}
                    <div className="relative z-10 w-7 h-7 rounded-full shrink-0 flex items-center justify-center border"
                      style={{ background: isDone ? "#00cfe0" : isActive ? "rgba(0,207,224,0.1)" : "rgba(10,20,38,0.6)", borderColor: isDone ? "#00cfe0" : isActive ? "#00cfe0" : "rgba(0,180,200,0.18)", boxShadow: isActive ? "0 0 14px rgba(0,207,224,0.3)" : "none" }}>
                      {isDone ? <Check size={12} className="text-[#04070f]" strokeWidth={2.8} /> : <span className="font-mono text-[10px]" style={{ color: isActive ? "#00cfe0" : "#1e3548" }}>{i + 1}</span>}
                    </div>
                    <div className="pt-1">
                      <p className="font-mono text-[10px] tracking-wide" style={{ color: isActive ? "#00cfe0" : isDone ? "#dde8f0" : "#1e3548" }}>
                        {isActive && <span className="mr-1">▶ </span>}{label.toUpperCase()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex-1 flex flex-col" style={{ minHeight: 580 }}>
              <div className="flex items-center gap-3 px-7 py-3.5 border-b border-[rgba(0,190,215,0.1)]">
                <div className="flex gap-1.5">
                  {["#ff3058", "#ffaa00", "#00cfe0"].map((c, i) => (
                    <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.65 }} />
                  ))}
                </div>
                <div className="flex-1 mx-3 h-[22px] rounded px-3 flex items-center" style={{ background: "rgba(0,180,200,0.05)", border: "1px solid rgba(0,180,200,0.09)" }}>
                  <span className="font-mono text-[10px] text-[#1e3548]">setup://workspace/{done ? "complete" : ["identity", "members", "review"][step]}</span>
                </div>
                {!done && <span className="font-mono text-[10px] text-[#1e3548]">{step + 1} / {STEPS.length}</span>}
              </div>

              <div className="flex-1 px-8 py-7 overflow-y-auto max-h-[60vh]">
                {done ? (
                  <div className="flex flex-col items-center justify-center h-full gap-7 py-20 text-center">
                    <div className="w-20 h-20 rounded-full border-2 border-[#00cfe0] flex items-center justify-center" style={{ boxShadow: "0 0 40px rgba(0,207,224,0.3)" }}>
                      <FolderKanban size={34} className="text-[#00cfe0]" />
                    </div>
                    <div>
                      <p className="font-mono text-[10px] tracking-[0.22em] text-[#4a6a88] mb-2">WORKSPACE READY</p>
                      <h2 className="font-sans text-2xl font-semibold text-[#dde8f0] mb-1">{name}</h2>
                      <p className="font-mono text-xs text-[#2a4860]">welcome aboard</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-6">
                      <h2 className="font-sans text-base font-semibold text-[#dde8f0] mb-2">{STEPS[step]}</h2>
                      <div className="h-px bg-gradient-to-r from-[rgba(0,207,224,0.25)] to-transparent" />
                    </div>

                    {step === 0 && (
                      <div className="flex flex-col gap-7">
                        <Field label="Workspace Name">
                          <StyledInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Payments Platform QA" />
                        </Field>
                        <Field label="Description">
                          <StyledTextarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="What's this workspace for?" />
                        </Field>
                      </div>
                    )}

                    {step === 1 && (
                      <div className="flex flex-col gap-5">
                        <div className="rounded border border-[rgba(0,200,220,0.12)] bg-[rgba(7,14,28,0.5)] p-4 space-y-3">
                          <MonoLabel>Pick existing user</MonoLabel>
                          <div className="flex gap-2">
                            <select value={picked} onChange={(e) => setPicked(e.target.value)}
                              className="flex-1 bg-[#070e1c] border border-[rgba(0,200,220,0.14)] rounded text-[#dde8f0] font-mono text-xs px-3 py-2.5 outline-none focus:border-[#00cfe0]">
                              <option value="">— choose user —</option>
                              {existingUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                            </select>
                            <select value={emailRole} onChange={(e) => setEmailRole(e.target.value as WsRole)}
                              className="w-28 bg-[#070e1c] border border-[rgba(0,200,220,0.14)] rounded text-[#00cfe0] font-mono text-xs px-3 py-2.5 outline-none focus:border-[#00cfe0]">
                              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                            <button onClick={addPicked} disabled={!picked}
                              className="px-3 rounded border border-[rgba(0,207,224,0.3)] text-[#00cfe0] hover:bg-[rgba(0,207,224,0.1)] disabled:opacity-30 disabled:cursor-not-allowed">
                              <UserPlus size={14} />
                            </button>
                          </div>
                        </div>

                        <div className="rounded border border-[rgba(0,200,220,0.12)] bg-[rgba(7,14,28,0.5)] p-4 space-y-3">
                          <MonoLabel>Invite by email</MonoLabel>
                          <div className="flex gap-2">
                            <StyledInput type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                              placeholder="teammate@company.com" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())} />
                            <select value={emailRole} onChange={(e) => setEmailRole(e.target.value as WsRole)}
                              className="w-28 bg-[#070e1c] border border-[rgba(0,200,220,0.14)] rounded text-[#00cfe0] font-mono text-xs px-3 py-2.5 outline-none focus:border-[#00cfe0]">
                              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                            <button onClick={addEmail}
                              className="px-3 rounded border border-[rgba(0,207,224,0.3)] text-[#00cfe0] hover:bg-[rgba(0,207,224,0.1)]">
                              <Mail size={14} />
                            </button>
                          </div>
                        </div>

                        {members.length > 0 && (
                          <div className="space-y-2">
                            <MonoLabel>Pending — {members.length} {members.length === 1 ? "person" : "people"}</MonoLabel>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {members.map((m, i) => (
                                <div key={i} className="flex items-center gap-2 rounded border border-[rgba(0,180,200,0.1)] px-3 py-2 text-sm bg-[#050b16]">
                                  {m.user_id ? <Users size={12} className="text-[#00cfe0]" /> : <Mail size={12} className="text-[#4a6a88]" />}
                                  <span className="flex-1 truncate font-mono text-xs text-[#dde8f0]">{m.name || m.email}</span>
                                  <span className="font-mono text-[9px] tracking-widest px-2 py-0.5 rounded bg-[rgba(0,207,224,0.1)] text-[#00cfe0]">{m.role.toUpperCase()}</span>
                                  <span className="font-mono text-[9px] tracking-widest text-[#4a6a88]">{m.user_id ? "ADD" : "INVITE"}</span>
                                  <button onClick={() => setMembers(members.filter((_, idx) => idx !== i))}
                                    className="text-[#ff3058] hover:opacity-80"><XCircle size={12} /></button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {step === 2 && (
                      <div className="flex flex-col gap-5">
                        <p className="font-sans text-sm text-[#4a6a88]">Confirm your configuration before creating.</p>
                        <div className="rounded border border-[rgba(0,200,220,0.12)] overflow-hidden">
                          {([
                            ["Workspace Name", name || "—"],
                            ["Description", description || "—"],
                            ["Members", members.length ? `${members.length} (${members.filter((m) => m.user_id).length} direct, ${members.filter((m) => !m.user_id).length} invited)` : "Owner only"],
                          ] as [string, string][]).map(([k, v], i) => (
                            <div key={i} className="flex items-start gap-4 px-5 py-3 border-b border-[rgba(0,180,200,0.07)] last:border-0"
                              style={{ background: i % 2 === 0 ? "rgba(7,14,28,0.5)" : "rgba(5,10,20,0.4)" }}>
                              <span className="font-mono text-[10px] text-[#2a4860] w-32 shrink-0 pt-0.5 tracking-wide">{k}</span>
                              <span className="font-mono text-xs break-all text-[#dde8f0]">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!done && (
                <div className="flex items-center justify-between px-8 py-5 border-t border-[rgba(0,190,215,0.1)]">
                  <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
                    className="flex items-center gap-2 font-mono text-[10px] tracking-widest px-4 py-2.5 rounded border border-[rgba(0,190,215,0.18)] text-[#4a6a88] hover:text-[#00cfe0] hover:border-[rgba(0,207,224,0.3)] disabled:opacity-20 disabled:cursor-not-allowed">
                    <ArrowLeft size={12} /> BACK
                  </button>
                  <div className="flex items-center gap-1.5">
                    {STEPS.map((_, i) => (
                      <div key={i} className="rounded-full" style={{ width: i === step ? "18px" : "5px", height: "5px", background: i <= step ? "#00cfe0" : "rgba(0,180,200,0.18)" }} />
                    ))}
                  </div>
                  {step < STEPS.length - 1 ? (
                    <button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}
                      className="flex items-center gap-2 font-mono text-[10px] tracking-widest px-5 py-2.5 rounded disabled:opacity-25 disabled:cursor-not-allowed"
                      style={{ background: canNext() ? "#00cfe0" : "rgba(0,207,224,0.08)", color: canNext() ? "#04070f" : "#2a4860", boxShadow: canNext() ? "0 0 18px rgba(0,207,224,0.28)" : "none" }}>
                      CONTINUE <ArrowRight size={12} />
                    </button>
                  ) : (
                    <button onClick={() => create.mutate()} disabled={create.isPending}
                      className="flex items-center gap-2 font-mono text-[10px] tracking-widest px-5 py-2.5 rounded"
                      style={{ background: "#00cfe0", color: "#04070f", boxShadow: "0 0 22px rgba(0,207,224,0.35)" }}>
                      {create.isPending ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} CREATE
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
