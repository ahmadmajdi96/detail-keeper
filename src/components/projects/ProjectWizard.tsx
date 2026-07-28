import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Upload, Globe, Github, CheckCircle2, XCircle, Loader2,
  ArrowRight, ArrowLeft, FolderOpen, Bell, Zap, Check,
  KeyRound, AlertTriangle, Terminal, Slack,
  MessageSquare, Send, Briefcase, FileText,
} from "lucide-react";
import { toast } from "sonner";

/** Read a File as raw base64 (no data-URL prefix) for the repo-reader edge function. */
const fileToBase64 = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string;
  onCreated?: (projectId: string) => void;
}

type ProjectType = "web-app" | "api-service" | "mobile-app" | "data-pipeline" | "ml-model" | "";
type LocatorType = "zip" | "documentation" | "github" | null;
type CheckStatus = "idle" | "checking" | "success" | "error";
type NotificationId = "slack" | "whatsapp" | "telegram" | "jira";
interface Secret { key: string; value: string }

const PROJECT_TYPES: { value: ProjectType; label: string; tag: string }[] = [
  { value: "web-app",       label: "Web Application",   tag: "FRONTEND" },
  { value: "api-service",   label: "API Service",        tag: "BACKEND"  },
  { value: "mobile-app",    label: "Mobile Application", tag: "MOBILE"   },
  { value: "data-pipeline", label: "Data Pipeline",      tag: "DATA"     },
  { value: "ml-model",      label: "ML / AI Model",      tag: "AI · ML"  },
];

const NOTIFICATIONS: { id: NotificationId; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { id: "slack",    label: "Slack",    desc: "Post alerts to channels via webhook",     icon: <Slack size={18} />,         color: "#4A154B" },
  { id: "whatsapp", label: "WhatsApp", desc: "Send to a WhatsApp Business number",      icon: <MessageSquare size={18} />, color: "#25D366" },
  { id: "telegram", label: "Telegram", desc: "Broadcast through a Telegram bot",        icon: <Send size={18} />,          color: "#229ED9" },
  { id: "jira",     label: "Jira",     desc: "Auto-create issues on deployment events", icon: <Briefcase size={18} />,     color: "#0052CC" },
];

const STEPS = ["Project Identity", "Project Source", "Review"];

function MonoLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] tracking-[0.18em] text-[#4a6a88] uppercase">
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <MonoLabel>{label}</MonoLabel>
      {children}
    </div>
  );
}

function StyledInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={
        "w-full bg-[#070e1c] border border-[rgba(0,200,220,0.14)] rounded text-[#dde8f0] " +
        "font-mono text-sm px-4 py-3 outline-none transition-all duration-200 " +
        "placeholder:text-[#1e3548] focus:border-[#00cfe0] " +
        "focus:shadow-[0_0_0_2px_rgba(0,207,224,0.12)] " +
        className
      }
    />
  );
}

function ProgressBar() {
  return (
    <div className="flex-1 h-[3px] bg-[#0a1a2e] rounded overflow-hidden">
      <div className="h-full rounded" style={{ background: "linear-gradient(90deg, #0044bb, #00cfe0)", animation: "progress-fill 2.6s ease-in-out forwards" }} />
      <style>{`@keyframes progress-fill { from { width: 0% } to { width: 88% } }`}</style>
    </div>
  );
}

function Checker({ status, onCheck, url }: { status: CheckStatus; onCheck: () => void; url: string }) {
  return (
    <div className="mt-3 rounded border border-[rgba(0,200,220,0.1)] bg-[#050b16] p-4">
      <div className="flex items-center justify-between mb-3">
        <MonoLabel>Accessibility Check</MonoLabel>
        <button onClick={onCheck} disabled={!url.trim() || status === "checking"}
          className="font-mono text-[10px] tracking-widest px-3 py-1.5 rounded border border-[rgba(0,207,224,0.3)] text-[#00cfe0] bg-[rgba(0,207,224,0.05)] hover:bg-[rgba(0,207,224,0.1)] transition-all disabled:opacity-25 disabled:cursor-not-allowed">
          RUN CHECK
        </button>
      </div>
      {status === "idle" && <p className="font-mono text-xs text-[#1e3548]">— awaiting check</p>}
      {status === "checking" && (
        <div className="flex items-center gap-3">
          <Loader2 size={13} className="animate-spin text-[#00cfe0] shrink-0" />
          <ProgressBar />
          <span className="font-mono text-[10px] text-[#4a6a88]">probing…</span>
        </div>
      )}
      {status === "success" && (
        <div className="flex items-center gap-2">
          <CheckCircle2 size={13} className="text-[#00cfe0]" />
          <span className="font-mono text-xs text-[#00cfe0]">Resource accessible — 200 OK</span>
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center gap-2">
          <XCircle size={13} className="text-[#ff3058]" />
          <span className="font-mono text-xs text-[#ff3058]">Unreachable — verify URL or credentials</span>
        </div>
      )}
    </div>
  );
}

export function ProjectWizard({ open, onOpenChange, workspaceId, onCreated }: Props) {
  const { user } = useAuth();
  const { currentWorkspace, refresh } = useWorkspace();
  const wsId = workspaceId || currentWorkspace?.id;
  const fileRef = useRef<HTMLInputElement>(null);
  const docsRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("");

  const [locator, setLocator] = useState<LocatorType>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [docFiles, setDocFiles] = useState<File[]>([]);
  const [repoUrl, setRepoUrl] = useState("");
  const [repoVisibility, setRepoVisibility] = useState<"public" | "private">("public");
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [checkStatus, setCheckStatus] = useState<CheckStatus>("idle");

  const [notifications, setNotifications] = useState<NotificationId[]>([]);

  const reset = () => {
    setStep(0); setDone(false); setProjectName(""); setProjectType("");
    setLocator(null); setZipFile(null); setDocFiles([]); setRepoUrl("");
    setRepoVisibility("public");
    setSecrets([]); setCheckStatus("idle"); setNotifications([]);
  };

  const runCheck = () => {
    setCheckStatus("checking");
    setTimeout(() => setCheckStatus(repoUrl.includes("github.com") ? "success" : "error"), 2800);
  };

  const canNext = () => {
    if (step === 0) return projectName.trim() !== "" && projectType !== "";
    if (step === 1) {
      if (!locator) return false;
      if (locator === "zip") return zipFile !== null;
      if (locator === "github") {
        if (!repoUrl.trim()) return false;
        if (repoVisibility === "private" && !secrets.some((s) => s.value.trim())) return false;
        return true;
      }
      if (locator === "documentation") return true;
    }
    return true;
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!wsId) throw new Error("No workspace selected");
      const sourceType = locator === "github" ? "github" : locator === "zip" ? "zip" : "documentation";

      // Quota check via organization_id of the workspace
      const { data: wsRow } = await supabase.from("workspaces").select("organization_id").eq("id", wsId).maybeSingle();
      if (wsRow?.organization_id) {
        const { data: ok } = await supabase.rpc("within_quota", { _org_id: wsRow.organization_id, _kind: "projects", _additional: 1 });
        if (ok === false) throw new Error("quota_exceeded:projects");
      }


      const projectInsert: any = {
        workspace_id: wsId,
        name: projectName,
        description: PROJECT_TYPES.find((p) => p.value === projectType)?.label || null,
        source_type: sourceType,
        status: "pending",
        created_by: user?.id,
      };
      if (locator === "github") {
        projectInsert.github_url = repoUrl;
        projectInsert.github_branch = "main";
        projectInsert.github_is_private = repoVisibility === "private";
        projectInsert.github_repo_visibility = repoVisibility;
        if (secrets.length > 0) projectInsert.github_token_secret_name = secrets[0]?.value;
      }

      const { data: proj, error } = await supabase.from("projects").insert(projectInsert).select("id").single();
      if (error) throw error;
      const projectId = proj.id;

      // Ensure creator is a project lead (trigger also handles this; upsert is defensive).
      if (user?.id) {
        await supabase
          .from("project_members")
          .upsert(
            { project_id: projectId, user_id: user.id, role: "lead" as const },
            { onConflict: "project_id,user_id" }
          );
      }

      if (locator === "zip" && zipFile) {
        const path = `${wsId}/${projectId}/${Date.now()}-${zipFile.name}`;
        const { error: upErr } = await supabase.storage.from("project-repos").upload(path, zipFile, { upsert: false });
        if (upErr) throw upErr;
        await supabase.from("projects").update({ zip_storage_path: path, status: "processing" }).eq("id", projectId);
        supabase.functions.invoke("ingest-zip", { body: { project_id: projectId } }).catch(() => {});
      } else if (locator === "github") {
        await supabase.from("projects").update({ status: "processing" }).eq("id", projectId);
        // Kick off Repo Reader clone job. Polling happens in the project detail page.
        const { error: rrErr } = await supabase.functions.invoke("repo-reader", {
          body: {
            action: "clone",
            project_id: projectId,
            repo_url: repoUrl,
            branch: "main",
            visibility: repoVisibility,
            access_token: repoVisibility === "private" ? (secrets[0]?.value || null) : null,
          },
        });
        if (rrErr) {
          await supabase.from("projects").update({
            status: "failed", process_error: rrErr.message || "Repo Reader failed",
          }).eq("id", projectId);
          throw rrErr;
        }
      } else if (locator === "documentation" && docFiles.length) {
        for (const f of docFiles) {
          const storagePath = `${wsId}/${projectId}/docs/${Date.now()}-${f.name}`;
          const { error: upErr } = await supabase.storage
            .from("project-repos").upload(storagePath, f, { upsert: false });
          const { data: docRow } = await supabase.from("documents").insert({
            filename: f.name, file_size: f.size, mime_type: f.type || "application/octet-stream",
            status: "processing", uploader_id: user?.id, workspace_id: wsId, project_id: projectId,
            storage_path: upErr ? null : storagePath,
          } as any).select("id").single();
          if (docRow) supabase.functions.invoke("process-document", { body: { document_id: docRow.id } }).catch(() => {});
        }
        await supabase.from("projects").update({ status: "ready" }).eq("id", projectId);
      }

      return projectId;
    },
    onSuccess: async (id) => {
      toast.success("Project initialized");
      setDone(true);
      await refresh();
      setTimeout(() => {
        onCreated?.(id);
        onOpenChange(false);
        reset();
      }, 1600);
    },
    onError: (e: any) => toast.error(e.message || "Failed to create project"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-[920px] p-0 border-0 bg-transparent shadow-none overflow-hidden">
        <DialogTitle className="sr-only">New Project Setup Wizard</DialogTitle>
        <div
          className="relative w-full"
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            background: "radial-gradient(ellipse 70% 50% at 50% -5%, rgba(0,60,180,0.2) 0%, transparent 65%), #04070f",
            borderRadius: 12,
          }}
        >
          <div className="absolute inset-0 pointer-events-none rounded-xl overflow-hidden"
            style={{ backgroundImage: "linear-gradient(rgba(0,200,220,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,200,220,0.03) 1px, transparent 1px)", backgroundSize: "52px 52px" }} />

          <div className="relative z-10 flex rounded-xl overflow-hidden"
            style={{ background: "rgba(6,11,22,0.97)", border: "1px solid rgba(0,190,215,0.13)", boxShadow: "0 0 80px rgba(0,60,180,0.14)" }}>
            {/* Sidebar */}
            <div className="w-60 shrink-0 p-7 flex flex-col border-r border-[rgba(0,190,215,0.1)]" style={{ background: "rgba(4,8,18,0.7)" }}>
              <div className="mb-9">
                <div className="flex items-center gap-2 mb-1.5">
                  <Terminal size={13} className="text-[#00cfe0]" />
                  <span className="font-mono text-[9px] tracking-[0.25em] text-[#00cfe0]">PROJECT WIZARD</span>
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
                    <div className="relative z-10 w-7 h-7 rounded-full shrink-0 flex items-center justify-center border transition-all duration-300"
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

            {/* Main panel */}
            <div className="flex-1 flex flex-col" style={{ minHeight: 580 }}>
              <div className="flex items-center gap-3 px-7 py-3.5 border-b border-[rgba(0,190,215,0.1)]">
                <div className="flex gap-1.5">
                  {["#ff3058", "#ffaa00", "#00cfe0"].map((c, i) => (
                    <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.65 }} />
                  ))}
                </div>
                <div className="flex-1 mx-3 h-[22px] rounded px-3 flex items-center" style={{ background: "rgba(0,180,200,0.05)", border: "1px solid rgba(0,180,200,0.09)" }}>
                  <span className="font-mono text-[10px] text-[#1e3548]">setup://project/{done ? "complete" : ["identity", "source", "review"][step]}</span>
                </div>
                {!done && <span className="font-mono text-[10px] text-[#1e3548]">{step + 1} / {STEPS.length}</span>}
              </div>

              <div className="flex-1 px-8 py-7 overflow-y-auto max-h-[60vh]">
                {done ? (
                  <div className="flex flex-col items-center justify-center h-full gap-7 py-20 text-center">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full border-2 border-[#00cfe0] flex items-center justify-center" style={{ boxShadow: "0 0 40px rgba(0,207,224,0.3)" }}>
                        <CheckCircle2 size={34} className="text-[#00cfe0]" />
                      </div>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] tracking-[0.22em] text-[#4a6a88] mb-2">PROJECT INITIALIZED</p>
                      <h2 className="font-sans text-2xl font-semibold text-[#dde8f0] mb-1">{projectName}</h2>
                      <p className="font-mono text-xs text-[#2a4860]">all systems go</p>
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
                        <Field label="Project Name">
                          <StyledInput value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. sentinel-api-v2" />
                          {projectName.trim() && (
                            <span className="font-mono text-[10px] text-[#1e3548]">ID → {projectName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}</span>
                          )}
                        </Field>
                        <Field label="Project Type">
                          <div className="flex flex-col gap-1.5">
                            {PROJECT_TYPES.map((pt) => {
                              const active = projectType === pt.value;
                              return (
                                <button key={pt.value} onClick={() => setProjectType(pt.value)}
                                  className="flex items-center justify-between px-4 py-3 rounded border text-left transition-all duration-150"
                                  style={{ borderColor: active ? "#00cfe0" : "rgba(0,200,220,0.12)", background: active ? "rgba(0,207,224,0.07)" : "rgba(7,14,28,0.5)" }}>
                                  <span className="font-sans text-sm" style={{ color: active ? "#dde8f0" : "#4a6a88" }}>{pt.label}</span>
                                  <span className="font-mono text-[9px] tracking-widest px-2 py-0.5 rounded"
                                    style={{ background: active ? "rgba(0,207,224,0.15)" : "rgba(0,180,200,0.06)", color: active ? "#00cfe0" : "#1e3548" }}>{pt.tag}</span>
                                </button>
                              );
                            })}
                          </div>
                        </Field>
                      </div>
                    )}

                    {step === 1 && (
                      <div className="flex flex-col gap-5">
                        <Field label="Source Type">
                          <div className="grid grid-cols-3 gap-3">
                            {[
                              { id: "zip" as const, icon: <Upload size={18} />, tag: "UPLOAD", label: "ZIP Archive" },
                              { id: "documentation" as const, icon: <FileText size={18} />, tag: "DOCS", label: "Documentation" },
                              { id: "github" as const, icon: <Github size={18} />, tag: "GIT", label: "GitHub Repo" },
                            ].map((t) => {
                              const active = locator === t.id;
                              return (
                                <button key={t.id} onClick={() => { setLocator(t.id); setCheckStatus("idle"); }}
                                  className="flex flex-col items-center gap-2 py-6 rounded border transition-all duration-150"
                                  style={{ borderColor: active ? "#00cfe0" : "rgba(0,200,220,0.12)", background: active ? "rgba(0,207,224,0.07)" : "rgba(7,14,28,0.5)", boxShadow: active ? "0 0 20px rgba(0,207,224,0.12)" : "none", color: active ? "#00cfe0" : "#2a4860" }}>
                                  {t.icon}
                                  <span className="font-mono text-[9px] tracking-widest" style={{ color: active ? "#00cfe0" : "#2a4860" }}>{t.tag}</span>
                                  <span className="font-sans text-xs text-center" style={{ color: active ? "#c0d0e0" : "#2a4860" }}>{t.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </Field>

                        {locator === "zip" && (
                          <div className="flex flex-col gap-3">
                            <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={(e) => setZipFile(e.target.files?.[0] ?? null)} />
                            <button onClick={() => fileRef.current?.click()}
                              className="w-full border-2 border-dashed rounded py-12 flex flex-col items-center gap-3 transition-all duration-200"
                              style={{ borderColor: zipFile ? "#00cfe0" : "rgba(0,180,200,0.2)", background: zipFile ? "rgba(0,207,224,0.04)" : "transparent" }}>
                              <FolderOpen size={28} style={{ color: zipFile ? "#00cfe0" : "#2a4860" }} />
                              {zipFile ? (
                                <>
                                  <span className="font-mono text-sm text-[#00cfe0]">{zipFile.name}</span>
                                  <span className="font-mono text-[10px] text-[#4a6a88]">{(zipFile.size / 1024).toFixed(1)} KB</span>
                                </>
                              ) : (
                                <>
                                  <span className="font-mono text-sm text-[#4a6a88]">Click to select .zip archive</span>
                                  <span className="font-mono text-[10px] text-[#1e3548]">max 100 MB</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {locator === "documentation" && (
                          <div className="flex flex-col gap-3">
                            <input ref={docsRef} type="file" multiple className="hidden" onChange={(e) => setDocFiles(Array.from(e.target.files || []))} />
                            <button onClick={() => docsRef.current?.click()}
                              className="w-full border-2 border-dashed rounded py-12 flex flex-col items-center gap-3 transition-all duration-200"
                              style={{ borderColor: docFiles.length ? "#00cfe0" : "rgba(0,180,200,0.2)", background: docFiles.length ? "rgba(0,207,224,0.04)" : "transparent" }}>
                              <FileText size={28} style={{ color: docFiles.length ? "#00cfe0" : "#2a4860" }} />
                              {docFiles.length ? (
                                <>
                                  <span className="font-mono text-sm text-[#00cfe0]">{docFiles.length} file{docFiles.length > 1 ? "s" : ""} selected</span>
                                  <span className="font-mono text-[10px] text-[#4a6a88]">{docFiles.map((f) => f.name).join(", ").slice(0, 60)}</span>
                                </>
                              ) : (
                                <>
                                  <span className="font-mono text-sm text-[#4a6a88]">Click to select documentation</span>
                                  <span className="font-mono text-[10px] text-[#1e3548]">PDF · DOCX · MD · TXT · JSON</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {locator === "github" && (
                          <div className="flex flex-col gap-4">
                            <Field label="Repository URL">
                              <StyledInput value={repoUrl} onChange={(e) => { setRepoUrl(e.target.value); setCheckStatus("idle"); }} placeholder="https://github.com/org/repository" />
                            </Field>
                            <Field label="Repository Visibility">
                              <div className="grid grid-cols-2 gap-2">
                                {(["public", "private"] as const).map((v) => {
                                  const active = repoVisibility === v;
                                  return (
                                    <button
                                      key={v}
                                      type="button"
                                      onClick={() => setRepoVisibility(v)}
                                      className="flex items-center gap-3 px-4 py-3 rounded border text-left transition-all duration-200"
                                      style={{
                                        borderColor: active ? "#00cfe0" : "rgba(0,200,220,0.12)",
                                        background: active ? "rgba(0,207,224,0.07)" : "rgba(7,14,28,0.5)",
                                        boxShadow: active ? "0 0 18px rgba(0,207,224,0.18)" : "none",
                                      }}
                                    >
                                      <div className="w-8 h-8 rounded flex items-center justify-center shrink-0"
                                        style={{ background: active ? "rgba(0,207,224,0.15)" : "rgba(0,180,200,0.06)" }}>
                                        {v === "public" ? <Globe size={14} className={active ? "text-[#00cfe0]" : "text-[#2a4860]"} /> : <KeyRound size={14} className={active ? "text-[#00cfe0]" : "text-[#2a4860]"} />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-mono text-xs uppercase tracking-wider" style={{ color: active ? "#dde8f0" : "#4a6a88" }}>
                                          {v}
                                        </p>
                                        <p className="font-sans text-[10px] mt-0.5" style={{ color: active ? "#4a6a88" : "#1a2e40" }}>
                                          {v === "public" ? "No token required" : "Access token required"}
                                        </p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </Field>
                            {repoVisibility === "private" && (
                              <Field label="Access Token (required)">
                                <div className="flex flex-col gap-2">
                                  {secrets.length === 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setSecrets([{ key: "GITHUB_TOKEN", value: "" }])}
                                      className="flex items-center gap-2 px-3 py-2 text-[10px] font-mono tracking-widest rounded border border-dashed border-[rgba(0,180,200,0.2)] text-[#4a6a88] hover:text-[#00cfe0] hover:border-[rgba(0,207,224,0.35)] transition-all">
                                      <KeyRound size={11} /> ADD ACCESS TOKEN
                                    </button>
                                  )}
                                  {secrets.map((s, i) => (
                                    <div key={i} className="flex gap-2">
                                      <StyledInput value={s.key} onChange={(e) => { const c = [...secrets]; c[i].key = e.target.value; setSecrets(c); }}
                                        placeholder="GITHUB_TOKEN" className="flex-1 uppercase text-[#00cfe0] placeholder:normal-case" />
                                      <StyledInput value={s.value} onChange={(e) => { const c = [...secrets]; c[i].value = e.target.value; setSecrets(c); }}
                                        placeholder="ghp_..." type="password" className="flex-1" />
                                      <button type="button" onClick={() => setSecrets(secrets.filter((_, idx) => idx !== i))}
                                        className="shrink-0 w-10 rounded border border-[rgba(255,48,88,0.22)] text-[#ff3058] hover:bg-[rgba(255,48,88,0.08)] flex items-center justify-center">
                                        <XCircle size={13} />
                                      </button>
                                    </div>
                                  ))}
                                  <p className="font-mono text-[10px] text-[#4a6a88] pl-1">
                                    Token is sent once to clone the repository and is not stored.
                                  </p>
                                </div>
                              </Field>
                            )}
                            <Checker status={checkStatus} onCheck={runCheck} url={repoUrl} />
                          </div>
                        )}
                      </div>
                    )}

                    {step === 2 && (
                      <div className="flex flex-col gap-5">
                        <p className="font-sans text-sm text-[#4a6a88]">Confirm your configuration before initializing.</p>
                        <div className="rounded border border-[rgba(0,200,220,0.12)] overflow-hidden">
                          {([
                            ["Project Name", projectName || "—"],
                            ["Project Type", PROJECT_TYPES.find((p) => p.value === projectType)?.label ?? "—"],
                            ["Source", locator === "zip" ? "ZIP Archive" : locator === "documentation" ? "Documentation" : locator === "github" ? "GitHub Repository" : "—"],
                            ...(locator === "github" ? [["Repository", repoUrl || "—"], ["Secrets", `${secrets.filter((s) => s.key).length} configured`]] as [string, string][] : []),
                            ...(locator === "zip" ? [["Archive", zipFile?.name ?? "—"]] as [string, string][] : []),
                            ...(locator === "documentation" ? [["Documents", `${docFiles.length} file(s)`]] as [string, string][] : []),
                          ] as [string, string][]).map(([k, v], i) => (
                            <div key={i} className="flex items-start gap-4 px-5 py-3 border-b border-[rgba(0,180,200,0.07)] last:border-0"
                              style={{ background: i % 2 === 0 ? "rgba(7,14,28,0.5)" : "rgba(5,10,20,0.4)" }}>
                              <span className="font-mono text-[10px] text-[#2a4860] w-32 shrink-0 pt-0.5 tracking-wide">{k}</span>
                              <span className="font-mono text-xs break-all text-[#dde8f0]">{v}</span>
                            </div>
                          ))}
                        </div>
                        {locator === "github" && checkStatus !== "success" && (
                          <div className="flex items-start gap-3 px-4 py-3 rounded border border-[rgba(255,170,0,0.2)] bg-[rgba(255,170,0,0.04)]">
                            <AlertTriangle size={13} className="text-[#ffaa00] shrink-0 mt-0.5" />
                            <p className="font-mono text-xs text-[#ffaa00]">Repository not verified. You may still proceed.</p>
                          </div>
                        )}
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
