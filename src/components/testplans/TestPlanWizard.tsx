import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProjectScope } from "@/hooks/useProjectScope";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  ClipboardList, CheckCircle2, Loader2, ArrowRight, ArrowLeft, Check,
  Terminal, Users, FileText, Sparkles, Zap, Search, Variable, Plus, Trash2, Download,
} from "lucide-react";
import { toast } from "sonner";

type PlanVar = { key: string; value: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (planId: string) => void;
}

const STEPS = ["Identity", "Assignees", "Source Documents", "Variables", "Review"];

function MonoLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] tracking-[0.18em] text-[#4a6a88] uppercase">
      {children}
    </span>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-2"><MonoLabel>{label}</MonoLabel>{children}</div>;
}
function StyledInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input {...rest} className={
      "w-full bg-[#070e1c] border border-[rgba(0,200,220,0.14)] rounded text-[#dde8f0] " +
      "font-mono text-sm px-4 py-3 outline-none transition-all duration-200 " +
      "placeholder:text-[#1e3548] focus:border-[#00cfe0] " +
      "focus:shadow-[0_0_0_2px_rgba(0,207,224,0.12)] " + className
    } />
  );
}

export function TestPlanWizard({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const { projectId, workspaceId } = useProjectScope();

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [docs, setDocs] = useState<string[]>([]);
  const [autoAI, setAutoAI] = useState(true);
  const [userQ, setUserQ] = useState("");
  const [docQ, setDocQ] = useState("");

  const { data: users = [] } = useQuery({
    queryKey: ["wizard-users", workspaceId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, email, role")
        .order("name");
      return data || [];
    },
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["wizard-docs", projectId],
    enabled: open,
    queryFn: async () => {
      let q = supabase.from("documents").select("id, name, filename, mime_type, status").order("created_at", { ascending: false });
      if (projectId) q = q.eq("project_id", projectId);
      const { data } = await q;
      return data || [];
    },
  });

  const reset = () => {
    setStep(0); setDone(false); setName(""); setDescription(""); setObjective("");
    setAssignees([]); setDocs([]); setAutoAI(true); setUserQ(""); setDocQ("");
  };

  useEffect(() => { if (!open) reset(); }, [open]);

  const canNext = () => {
    if (step === 0) return name.trim().length > 1;
    return true;
  };

  const create = useMutation({
    mutationFn: async () => {
      const { data: plan, error } = await supabase
        .from("test_plans")
        .insert({
          name, description, objective,
          status: "draft",
          ai_status: autoAI && docs.length > 0 ? "queued" : "idle",
          created_by: user?.id,
          workspace_id: workspaceId,
          project_id: projectId,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (assignees.length) {
        await supabase.from("test_plan_assignees").insert(
          assignees.map((uid) => ({
            test_plan_id: plan.id, user_id: uid, role: "tester", assigned_by: user?.id,
          }))
        );
      }
      if (docs.length) {
        await supabase.from("test_plan_documents").insert(
          docs.map((did) => ({ test_plan_id: plan.id, document_id: did }))
        );
      }
      // Seed v1 baseline version
      await supabase.from("test_plan_versions").insert({
        test_plan_id: plan.id,
        version: 1,
        snapshot: { name, description, objective, assignees, documents: docs },
        change_summary: "Initial plan created",
        created_by: user?.id,
      });

      if (autoAI && docs.length > 0) {
        supabase.functions
          .invoke("generate-test-plan-from-docs", { body: { test_plan_id: plan.id } })
          .catch(() => {});
      }
      return plan.id;
    },
    onSuccess: (id) => {
      toast.success("Test plan created");
      setDone(true);
      setTimeout(() => {
        onCreated?.(id);
        onOpenChange(false);
      }, 1400);
    },
    onError: (e: any) => toast.error(e.message || "Failed to create plan"),
  });

  const filteredUsers = users.filter((u: any) =>
    !userQ || (u.name || "").toLowerCase().includes(userQ.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(userQ.toLowerCase()));
  const filteredDocs = documents.filter((d: any) =>
    !docQ || (d.name || d.filename || "").toLowerCase().includes(docQ.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[920px] p-0 border-0 bg-transparent shadow-none overflow-hidden">
        <DialogTitle className="sr-only">New Test Plan Wizard</DialogTitle>
        <div className="relative w-full" style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          background: "radial-gradient(ellipse 70% 50% at 50% -5%, rgba(120,60,200,0.18) 0%, transparent 65%), #04070f",
          borderRadius: 12,
        }}>
          <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden" style={{
            backgroundImage: "linear-gradient(rgba(0,200,220,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,200,220,0.03) 1px, transparent 1px)",
            backgroundSize: "52px 52px"
          }} />

          <div className="relative z-10 flex rounded-xl overflow-hidden" style={{
            background: "rgba(6,11,22,0.97)", border: "1px solid rgba(0,190,215,0.13)", boxShadow: "0 0 80px rgba(120,60,200,0.14)"
          }}>
            {/* Sidebar */}
            <div className="w-60 shrink-0 p-7 flex flex-col border-r border-[rgba(0,190,215,0.1)]" style={{ background: "rgba(4,8,18,0.7)" }}>
              <div className="mb-9">
                <div className="flex items-center gap-2 mb-1.5">
                  <Terminal size={13} className="text-[#00cfe0]" />
                  <span className="font-mono text-[9px] tracking-[0.25em] text-[#00cfe0]">TEST PLAN WIZARD</span>
                </div>
                <div className="h-px bg-gradient-to-r from-[rgba(0,207,224,0.35)] to-transparent" />
              </div>
              {STEPS.map((label, i) => {
                const isDone = done || i < step;
                const isActive = !done && i === step;
                return (
                  <div key={i} className="relative flex items-start gap-3.5 pb-7 last:pb-0">
                    {i < STEPS.length - 1 && (
                      <div className="absolute left-[14px] top-7 w-px" style={{
                        height: "calc(100% - 4px)",
                        background: isDone ? "linear-gradient(180deg, #00cfe0, rgba(0,207,224,0.2))" : "rgba(0,180,200,0.09)"
                      }} />
                    )}
                    <div className="relative z-10 w-7 h-7 rounded-full shrink-0 flex items-center justify-center border transition-all duration-300" style={{
                      background: isDone ? "#00cfe0" : isActive ? "rgba(0,207,224,0.1)" : "rgba(10,20,38,0.6)",
                      borderColor: isDone ? "#00cfe0" : isActive ? "#00cfe0" : "rgba(0,180,200,0.18)",
                      boxShadow: isActive ? "0 0 14px rgba(0,207,224,0.3)" : "none",
                    }}>
                      {isDone ? <Check size={12} className="text-[#04070f]" strokeWidth={2.8} /> :
                        <span className="font-mono text-[10px]" style={{ color: isActive ? "#00cfe0" : "#1e3548" }}>{i + 1}</span>}
                    </div>
                    <div className="pt-1">
                      <p className="font-mono text-[10px] tracking-wide" style={{
                        color: isActive ? "#00cfe0" : isDone ? "#dde8f0" : "#1e3548",
                      }}>
                        {isActive && <span className="mr-1">▶ </span>}{label.toUpperCase()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Main */}
            <div className="flex-1 flex flex-col" style={{ minHeight: 580 }}>
              <div className="flex items-center gap-3 px-7 py-3.5 border-b border-[rgba(0,190,215,0.1)]">
                <div className="flex gap-1.5">
                  {["#ff3058", "#ffaa00", "#00cfe0"].map((c, i) => (
                    <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.65 }} />
                  ))}
                </div>
                <div className="flex-1 mx-3 h-[22px] rounded px-3 flex items-center" style={{ background: "rgba(0,180,200,0.05)", border: "1px solid rgba(0,180,200,0.09)" }}>
                  <span className="font-mono text-[10px] text-[#1e3548]">setup://test-plan/{done ? "complete" : ["identity", "assignees", "documents", "review"][step]}</span>
                </div>
                {!done && <span className="font-mono text-[10px] text-[#1e3548]">{step + 1} / {STEPS.length}</span>}
              </div>

              <div className="flex-1 px-8 py-7 overflow-y-auto max-h-[60vh]">
                {done ? (
                  <div className="flex flex-col items-center justify-center h-full gap-7 py-20 text-center">
                    <div className="w-20 h-20 rounded-full border-2 border-[#00cfe0] flex items-center justify-center" style={{ boxShadow: "0 0 40px rgba(0,207,224,0.3)" }}>
                      <CheckCircle2 size={34} className="text-[#00cfe0]" />
                    </div>
                    <div>
                      <p className="font-mono text-[10px] tracking-[0.22em] text-[#4a6a88] mb-2">TEST PLAN CREATED</p>
                      <h2 className="font-sans text-2xl font-semibold text-[#dde8f0] mb-1">{name}</h2>
                      <p className="font-mono text-xs text-[#2a4860]">{autoAI && docs.length > 0 ? "AI generation queued" : "ready to populate"}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-6">
                      <h2 className="font-sans text-base font-semibold text-[#dde8f0] mb-2">{STEPS[step]}</h2>
                      <div className="h-px bg-gradient-to-r from-[rgba(0,207,224,0.25)] to-transparent" />
                    </div>

                    {step === 0 && (
                      <div className="flex flex-col gap-6">
                        <Field label="Plan Name">
                          <StyledInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sprint 24 Regression Suite" />
                        </Field>
                        <Field label="Description">
                          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                            placeholder="Goals, scope, and expectations…"
                            className="w-full bg-[#070e1c] border border-[rgba(0,200,220,0.14)] rounded text-[#dde8f0] font-mono text-sm px-4 py-3 outline-none placeholder:text-[#1e3548] focus:border-[#00cfe0] focus:shadow-[0_0_0_2px_rgba(0,207,224,0.12)]" />
                        </Field>
                        <Field label="Objective (optional)">
                          <StyledInput value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="e.g. Ensure checkout flow is regression-free" />
                        </Field>
                      </div>
                    )}

                    {step === 1 && (
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 px-3 py-2 rounded border border-[rgba(0,200,220,0.14)] bg-[#070e1c]">
                          <Search size={13} className="text-[#4a6a88]" />
                          <input value={userQ} onChange={(e) => setUserQ(e.target.value)} placeholder="search users…"
                            className="flex-1 bg-transparent font-mono text-xs text-[#dde8f0] outline-none placeholder:text-[#1e3548]" />
                          <span className="font-mono text-[10px] text-[#4a6a88]">{assignees.length} selected</span>
                        </div>
                        <div className="flex flex-col gap-1.5 max-h-[340px] overflow-y-auto pr-1">
                          {filteredUsers.map((u: any) => {
                            const active = assignees.includes(u.id);
                            return (
                              <button key={u.id} onClick={() => setAssignees(active ? assignees.filter(x => x !== u.id) : [...assignees, u.id])}
                                className="flex items-center justify-between px-4 py-3 rounded border text-left transition-all"
                                style={{ borderColor: active ? "#00cfe0" : "rgba(0,200,220,0.12)", background: active ? "rgba(0,207,224,0.07)" : "rgba(7,14,28,0.5)" }}>
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-mono text-[11px]"
                                    style={{ background: active ? "rgba(0,207,224,0.15)" : "rgba(0,180,200,0.06)", color: active ? "#00cfe0" : "#4a6a88" }}>
                                    {(u.name || u.email || "?").charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-sans text-sm" style={{ color: active ? "#dde8f0" : "#4a6a88" }}>{u.name || u.email}</div>
                                    <div className="font-mono text-[10px] text-[#2a4860]">{u.role || "qa"}</div>
                                  </div>
                                </div>
                                <div className="w-5 h-5 rounded border-2 flex items-center justify-center"
                                  style={{ borderColor: active ? "#00cfe0" : "rgba(0,180,200,0.2)", background: active ? "#00cfe0" : "transparent" }}>
                                  {active && <Check size={10} className="text-[#04070f]" strokeWidth={3} />}
                                </div>
                              </button>
                            );
                          })}
                          {filteredUsers.length === 0 && (
                            <div className="flex items-center gap-2 py-8 justify-center text-[#2a4860]">
                              <Users size={14} /><span className="font-mono text-xs">no users found</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {step === 2 && (
                      <div className="flex flex-col gap-4">
                        <p className="font-sans text-sm text-[#4a6a88]">
                          Pick zero or more documents from this project. AI will analyze them to generate test cases.
                        </p>
                        <div className="flex items-center gap-2 px-3 py-2 rounded border border-[rgba(0,200,220,0.14)] bg-[#070e1c]">
                          <Search size={13} className="text-[#4a6a88]" />
                          <input value={docQ} onChange={(e) => setDocQ(e.target.value)} placeholder="search documents…"
                            className="flex-1 bg-transparent font-mono text-xs text-[#dde8f0] outline-none placeholder:text-[#1e3548]" />
                          <span className="font-mono text-[10px] text-[#4a6a88]">{docs.length} selected</span>
                        </div>
                        <div className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto pr-1">
                          {filteredDocs.map((d: any) => {
                            const active = docs.includes(d.id);
                            return (
                              <button key={d.id} onClick={() => setDocs(active ? docs.filter(x => x !== d.id) : [...docs, d.id])}
                                className="flex items-center justify-between px-4 py-3 rounded border text-left transition-all"
                                style={{ borderColor: active ? "#00cfe0" : "rgba(0,200,220,0.12)", background: active ? "rgba(0,207,224,0.07)" : "rgba(7,14,28,0.5)" }}>
                                <div className="flex items-center gap-3">
                                  <FileText size={16} style={{ color: active ? "#00cfe0" : "#4a6a88" }} />
                                  <div>
                                    <div className="font-sans text-sm" style={{ color: active ? "#dde8f0" : "#4a6a88" }}>{d.name || d.filename}</div>
                                    <div className="font-mono text-[10px] text-[#2a4860]">{d.mime_type || "—"} · {d.status}</div>
                                  </div>
                                </div>
                                <div className="w-5 h-5 rounded border-2 flex items-center justify-center"
                                  style={{ borderColor: active ? "#00cfe0" : "rgba(0,180,200,0.2)", background: active ? "#00cfe0" : "transparent" }}>
                                  {active && <Check size={10} className="text-[#04070f]" strokeWidth={3} />}
                                </div>
                              </button>
                            );
                          })}
                          {filteredDocs.length === 0 && (
                            <div className="flex items-center gap-2 py-8 justify-center text-[#2a4860]">
                              <FileText size={14} /><span className="font-mono text-xs">no documents in this project</span>
                            </div>
                          )}
                        </div>
                        <label className="flex items-center gap-3 px-4 py-3 rounded border cursor-pointer transition-all"
                          style={{ borderColor: autoAI ? "rgba(120,60,200,0.4)" : "rgba(0,200,220,0.12)", background: autoAI ? "rgba(120,60,200,0.06)" : "rgba(7,14,28,0.5)" }}>
                          <Sparkles size={14} className="text-[#a060ff]" />
                          <div className="flex-1">
                            <div className="font-sans text-sm text-[#dde8f0]">Run AI generation after create</div>
                            <div className="font-mono text-[10px] text-[#4a6a88]">Auto-generate test cases from selected documents</div>
                          </div>
                          <input type="checkbox" checked={autoAI} onChange={(e) => setAutoAI(e.target.checked)} className="w-4 h-4 accent-[#a060ff]" />
                        </label>
                      </div>
                    )}

                    {step === 3 && (
                      <div className="flex flex-col gap-5">
                        <p className="font-sans text-sm text-[#4a6a88]">Confirm before initializing.</p>
                        <div className="rounded border border-[rgba(0,200,220,0.12)] overflow-hidden">
                          {([
                            ["Name", name || "—"],
                            ["Description", description || "—"],
                            ["Objective", objective || "—"],
                            ["Assignees", `${assignees.length} user(s)`],
                            ["Documents", `${docs.length} attached`],
                            ["AI Generation", autoAI && docs.length > 0 ? "queued after create" : "manual"],
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
                      <div key={i} className="rounded-full transition-all duration-300" style={{ width: i === step ? "18px" : "5px", height: "5px", background: i <= step ? "#00cfe0" : "rgba(0,180,200,0.18)" }} />
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
                      {create.isPending ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} INITIALIZE
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
