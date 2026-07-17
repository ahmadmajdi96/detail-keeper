import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import {
  ArrowRight, ArrowLeft, Check, Loader2, Building2, FolderKanban,
  Sparkles, Rocket, SkipForward, FileText, TestTube,
} from "lucide-react";

const STEPS = [
  { key: "org", label: "Organization", icon: Building2 },
  { key: "workspace", label: "Workspace", icon: FolderKanban },
  { key: "project", label: "First project", icon: Rocket },
  { key: "done", label: "You're set", icon: Check },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { currentOrganization, refresh: refreshOrg } = useOrganization();
  const { refresh: refreshWs, setCurrentWorkspaceId, setCurrentProjectId } = useWorkspace();
  const qc = useQueryClient();

  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState("");
  const [wsName, setWsName] = useState("My Workspace");
  const [wsId, setWsId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (currentOrganization && !orgName) setOrgName(currentOrganization.name);
  }, [currentOrganization, orgName]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/login");
  }, [isLoading, isAuthenticated, navigate]);

  async function markComplete() {
    if (!user?.id) return;
    await supabase.from("profiles").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", user.id);
  }

  async function skipAll() {
    setBusy(true);
    try {
      await markComplete();
      toast.success("You can finish setup anytime from the sidebar");
      navigate("/dashboard");
    } finally {
      setBusy(false);
    }
  }

  async function saveOrg() {
    if (!currentOrganization) return;
    if (!orgName.trim()) return toast.error("Give your organization a name");
    setBusy(true);
    try {
      const { error } = await supabase.from("organizations").update({ name: orgName.trim() }).eq("id", currentOrganization.id);
      if (error) throw error;
      await refreshOrg();
      setStep(1);
    } catch (e: any) {
      toast.error(e.message || "Could not save organization");
    } finally {
      setBusy(false);
    }
  }

  async function createWorkspace() {
    if (!wsName.trim() || !user?.id || !currentOrganization) return;
    setBusy(true);
    try {
      const { data: ws, error } = await supabase
        .from("workspaces")
        .insert({ name: wsName.trim(), owner_id: user.id, organization_id: currentOrganization.id })
        .select("id")
        .single();
      if (error) throw error;
      setWsId(ws.id);
      await refreshWs();
      setCurrentWorkspaceId(ws.id);
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      setStep(2);
    } catch (e: any) {
      toast.error(e.message || "Could not create workspace");
    } finally {
      setBusy(false);
    }
  }

  async function seedSampleProject() {
    if (!wsId || !user?.id) return toast.error("Create a workspace first");
    setBusy(true);
    try {
      const { data: proj, error } = await supabase
        .from("projects")
        .insert({
          workspace_id: wsId,
          name: "Sample — Demo Project",
          description: "A pre-seeded sample so you can explore the platform. Feel free to delete.",
          status: "ready",
          source_type: "documentation",
          created_by: user.id,
        } as any)
        .select("id")
        .single();
      if (error) throw error;

      // Sample test plan (best-effort)
      const { data: plan } = await supabase
        .from("test_plans")
        .insert({
          project_id: proj.id,
          workspace_id: wsId,
          name: "Sample — Smoke Suite",
          description: "A tiny demo test plan.",
          status: "draft",
          created_by: user.id,
        } as any)
        .select("id")
        .maybeSingle();

      if (plan?.id) {
        const cases = [
          { title: "Sample — User can log in", priority: "high" },
          { title: "Sample — Dashboard loads", priority: "medium" },
          { title: "Sample — Create a workspace", priority: "medium" },
        ];
        for (const c of cases) {
          await supabase.from("test_cases").insert({
            project_id: proj.id,
            workspace_id: wsId,
            test_plan_id: plan.id,
            title: c.title,
            priority: c.priority,
            status: "draft",
            created_by: user.id,
          } as any);
        }
      }

      await refreshWs();
      setCurrentProjectId(proj.id);
      qc.invalidateQueries();
      toast.success("Sample project created");
      setStep(3);
    } catch (e: any) {
      toast.error(e.message || "Could not seed sample project");
    } finally {
      setBusy(false);
    }
  }


  async function finish() {
    setBusy(true);
    try {
      await markComplete();
      navigate("/dashboard");
    } finally {
      setBusy(false);
    }
  }

  const StepIcon = STEPS[step].icon;

  return (
    <div className="min-h-screen bg-[#04070f] text-[#dde8f0] flex flex-col" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] rounded-full bg-[hsl(187,92%,50%)] opacity-[0.07] blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] rounded-full bg-[hsl(262,83%,58%)] opacity-[0.07] blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 md:px-10 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <span className="font-semibold tracking-tight">Qualixa</span>
        </div>
        <button
          onClick={skipAll}
          disabled={busy}
          className="text-xs text-[#7a96b0] hover:text-[#dde8f0] flex items-center gap-1.5 transition-colors"
        >
          <SkipForward className="h-3.5 w-3.5" /> Skip setup
        </button>
      </header>

      <div className="relative z-10 flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-3xl">
          {/* Stepper */}
          <div className="mb-10 flex items-center justify-between gap-2">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              const Icon = s.icon;
              return (
                <div key={s.key} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center border transition-all"
                      style={{
                        background: done ? "#00cfe0" : active ? "rgba(0,207,224,0.12)" : "rgba(10,20,38,0.6)",
                        borderColor: done ? "#00cfe0" : active ? "#00cfe0" : "rgba(0,180,200,0.18)",
                        boxShadow: active ? "0 0 20px rgba(0,207,224,0.35)" : "none",
                      }}
                    >
                      {done ? <Check className="h-4 w-4 text-[#04070f]" strokeWidth={3} /> : <Icon className={`h-4 w-4 ${active ? "text-[#00cfe0]" : "text-[#2a4860]"}`} />}
                    </div>
                    <span className={`text-[10px] font-mono tracking-wider uppercase ${active ? "text-[#00cfe0]" : done ? "text-[#dde8f0]" : "text-[#2a4860]"}`}>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="flex-1 h-px mx-2 mt-[-14px]" style={{ background: done ? "linear-gradient(90deg,#00cfe0,rgba(0,207,224,0.15))" : "rgba(0,180,200,0.12)" }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-8 md:p-12 border"
            style={{
              background: "rgba(6,11,22,0.85)",
              borderColor: "rgba(0,190,215,0.14)",
              boxShadow: "0 0 80px rgba(0,60,180,0.14)",
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
              >
                <div className="mb-8 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[rgba(0,207,224,0.08)] border border-[rgba(0,207,224,0.2)]">
                    <StepIcon className="h-5 w-5 text-[#00cfe0]" />
                  </div>
                  <div>
                    <p className="font-mono text-[10px] tracking-[0.22em] text-[#4a6a88] uppercase">Step {step + 1} of {STEPS.length}</p>
                    <h1 className="text-2xl font-semibold">{
                      step === 0 ? "Name your organization" :
                      step === 1 ? "Create your first workspace" :
                      step === 2 ? "Add your first project" :
                      "You're all set"
                    }</h1>
                  </div>
                </div>

                {step === 0 && (
                  <div className="space-y-5">
                    <p className="text-sm text-[#7a96b0]">
                      Your organization is where billing lives and where all workspaces, projects, and teammates roll up. You can rename it later in <span className="text-[#dde8f0]">Organization settings</span>.
                    </p>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[#7a96b0] uppercase tracking-wider">Organization name</label>
                      <input
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="Acme Inc."
                        className="w-full h-12 px-4 rounded-lg bg-[#070e1c] border border-[rgba(0,207,224,0.18)] text-[#dde8f0] text-sm outline-none focus:border-[#00cfe0] focus:ring-2 focus:ring-[rgba(0,207,224,0.2)] transition-all"
                      />
                    </div>
                  </div>
                )}

                {step === 1 && (
                  <div className="space-y-5">
                    <p className="text-sm text-[#7a96b0]">
                      A workspace groups related projects — a product line, a team, or a business unit. You can create more later.
                    </p>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[#7a96b0] uppercase tracking-wider">Workspace name</label>
                      <input
                        value={wsName}
                        onChange={(e) => setWsName(e.target.value)}
                        placeholder="Platform"
                        className="w-full h-12 px-4 rounded-lg bg-[#070e1c] border border-[rgba(0,207,224,0.18)] text-[#dde8f0] text-sm outline-none focus:border-[#00cfe0] focus:ring-2 focus:ring-[rgba(0,207,224,0.2)] transition-all"
                      />
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5">
                    <p className="text-sm text-[#7a96b0]">
                      Get up and running fast. Load a sample project to explore the app, or skip and create one yourself from the Projects page.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        onClick={seedSampleProject}
                        disabled={busy}
                        className="text-left group p-5 rounded-xl border transition-all hover:border-[#00cfe0]"
                        style={{ background: "rgba(0,207,224,0.06)", borderColor: "rgba(0,207,224,0.25)" }}
                      >
                        <Sparkles className="h-5 w-5 text-[#00cfe0] mb-3" />
                        <div className="font-medium text-[#dde8f0] mb-1">Add a sample project</div>
                        <p className="text-xs text-[#7a96b0]">Seeds a demo project with a PRD, a small test plan, and a few test cases — labeled "Sample".</p>
                      </button>
                      <button
                        onClick={() => setStep(3)}
                        disabled={busy}
                        className="text-left group p-5 rounded-xl border transition-all hover:border-[rgba(255,255,255,0.35)]"
                        style={{ background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.1)" }}
                      >
                        <FileText className="h-5 w-5 text-[#7a96b0] mb-3" />
                        <div className="font-medium text-[#dde8f0] mb-1">Skip for now</div>
                        <p className="text-xs text-[#7a96b0]">Create a project yourself from the Projects page — import docs, a zip, or a GitHub repo.</p>
                      </button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-5 text-center py-6">
                    <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center border-2 border-[#00cfe0]" style={{ boxShadow: "0 0 40px rgba(0,207,224,0.3)" }}>
                      <Check className="h-8 w-8 text-[#00cfe0]" strokeWidth={2.5} />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold mb-2">You're all set 🎉</h2>
                      <p className="text-sm text-[#7a96b0]">
                        Head to the dashboard to explore. You're on a <span className="text-[#00cfe0]">14-day Pro trial</span> — no credit card required.
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-10 flex items-center justify-between">
                  <button
                    onClick={() => step > 0 && setStep(step - 1)}
                    disabled={step === 0 || busy}
                    className="text-sm text-[#7a96b0] hover:text-[#dde8f0] disabled:opacity-30 flex items-center gap-1.5"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                  <div className="flex items-center gap-3">
                    {step < 3 && (
                      <button onClick={skipAll} disabled={busy} className="text-xs text-[#7a96b0] hover:text-[#dde8f0]">
                        Skip
                      </button>
                    )}
                    {step === 0 && (
                      <PrimaryBtn onClick={saveOrg} busy={busy}>Continue</PrimaryBtn>
                    )}
                    {step === 1 && (
                      <PrimaryBtn onClick={createWorkspace} busy={busy}>Create workspace</PrimaryBtn>
                    )}
                    {step === 2 && null}
                    {step === 3 && (
                      <PrimaryBtn onClick={finish} busy={busy}>
                        <TestTube className="h-4 w-4 mr-1" /> Go to dashboard
                      </PrimaryBtn>
                    )}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrimaryBtn({ onClick, busy, children }: { onClick: () => void; busy: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="h-10 px-5 rounded-lg flex items-center gap-2 text-sm font-medium text-[#04070f] transition-all disabled:opacity-60"
      style={{ background: "linear-gradient(135deg,#00cfe0,#38bdf8)", boxShadow: "0 8px 24px -8px rgba(0,207,224,0.6)" }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
      {!busy && <ArrowRight className="h-4 w-4" />}
    </button>
  );
}
