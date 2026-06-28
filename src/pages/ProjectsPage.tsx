import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProjectWizard } from "@/components/projects/ProjectWizard";
import {
  SentinelStyles, Scanline, GridBackdrop, ML, Pill, RingProgress,
} from "@/components/sentinel/primitives";
import {
  ArrowRight, ChevronRight, Clock, FileArchive, FileText, FolderOpen,
  Github, LayoutGrid, List, Loader2, Plus, RefreshCw, Search, Trash2,
} from "lucide-react";
import { toast } from "sonner";

const SOURCE_ICON: Record<string, any> = {
  documentation: FileText,
  zip: FileArchive,
  github: Github,
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  ready:      { label: "READY",      color: "#22c55e", bg: "rgba(34,197,94,0.1)"  },
  processing: { label: "PROCESSING", color: "#eab308", bg: "rgba(234,179,8,0.1)"  },
  pending:    { label: "PENDING",    color: "#4a6a88", bg: "rgba(74,106,136,0.12)"},
  failed:     { label: "FAILED",     color: "#ff3058", bg: "rgba(255,48,88,0.1)"  },
  archived:   { label: "ARCHIVED",   color: "#4a6a88", bg: "rgba(74,106,136,0.12)"},
};

export default function ProjectsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { currentWorkspace, setCurrentProjectId, refresh } = useWorkspace();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | string>("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [wizardOpen, setWizardOpen] = useState(params.get("new") === "1");

  useEffect(() => {
    if (params.get("new") === "1") {
      setWizardOpen(true);
      params.delete("new");
      setParams(params);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return [];
      const { data } = await supabase
        .from("projects")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!currentWorkspace,
  });

  const reprocess = useMutation({
    mutationFn: async (p: any) => {
      await supabase.from("projects").update({ status: "processing", process_error: null }).eq("id", p.id);
      if (p.source_type === "github") {
        await supabase.functions.invoke("ingest-github", {
          body: { project_id: p.id, url: p.github_url, branch: p.github_branch, token: p.github_token_secret_name },
        });
      } else if (p.source_type === "zip") {
        await supabase.functions.invoke("ingest-zip", { body: { project_id: p.id } });
      }
    },
    onSuccess: () => {
      toast.success("Reprocessing started");
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project deleted");
      qc.invalidateQueries({ queryKey: ["projects"] });
      refresh();
    },
  });

  const stats = useMemo(() => {
    const t = projects.length || 0;
    const ready = projects.filter((p: any) => p.status === "ready").length;
    const proc = projects.filter((p: any) => p.status === "processing").length;
    const failed = projects.filter((p: any) => p.status === "failed").length;
    const endpoints = projects.reduce((s: number, p: any) => s + (p.endpoints_count || 0), 0);
    const tests = projects.reduce((s: number, p: any) => s + (p.test_cases_count || 0), 0);
    const files = projects.reduce((s: number, p: any) => s + (p.files_count || 0), 0);
    return { t, ready, proc, failed, endpoints, tests, files };
  }, [projects]);

  const visible = projects.filter((p: any) => {
    if (filter !== "all" && p.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
    }
    return true;
  });

  if (!currentWorkspace) {
    return (
      <AppLayout>
        <SentinelStyles />
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <FolderOpen size={36} className="text-[#1e3548]" />
          <p className="sn-mono text-xs text-[#4a6a88]">
            Select a workspace from the top bar to view projects
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <SentinelStyles />
      <Scanline />
      <div className="-mx-4 md:-mx-6 -my-6">
        {/* HERO */}
        <div
          className="relative overflow-hidden border-b border-[rgba(0,190,215,0.1)]"
          style={{ background: "linear-gradient(180deg, rgba(0,30,60,0.5) 0%, rgba(4,7,15,0.95) 100%)" }}
        >
          <GridBackdrop opacity={0.04} />
          <div className="relative px-6 md:px-8 py-6">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00cfe0] sn-glow" />
              <ML>Workspace · {currentWorkspace.name}</ML>
            </div>
            <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
              <div>
                <h1 className="font-sans text-2xl font-semibold text-[#dde8f0] tracking-tight">
                  Projects
                </h1>
                <p className="font-sans text-sm text-[#3a5870] mt-1">
                  All projects in {currentWorkspace.name}.
                </p>
              </div>
              <button
                onClick={() => setWizardOpen(true)}
                className="flex items-center gap-2 sn-mono text-[10px] tracking-widest px-4 py-2.5 rounded transition-all"
                style={{ background: "#00cfe0", color: "#04070f", boxShadow: "0 0 20px rgba(0,207,224,0.3)" }}
              >
                <Plus size={12} /> NEW PROJECT
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {[
                { v: stats.t, l: "PROJECTS", c: "#00cfe0" },
                { v: stats.ready, l: "READY", c: "#22c55e" },
                { v: stats.proc, l: "PROCESSING", c: "#eab308" },
                { v: stats.failed, l: "FAILED", c: "#ff3058" },
                { v: stats.endpoints, l: "ENDPOINTS", c: "#a855f7" },
                { v: stats.tests, l: "TEST CASES", c: "#dde8f0" },
              ].map((s, i) => (
                <div
                  key={s.l}
                  className="px-4 py-3 rounded border border-[rgba(0,190,215,0.1)] bg-[rgba(7,14,28,0.6)] sn-count-up"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="sn-mono text-2xl font-semibold mb-0.5" style={{ color: s.c }}>
                    {s.v}
                  </div>
                  <ML dim>{s.l}</ML>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TOOLBAR */}
        <div
          className="flex items-center gap-3 px-6 md:px-8 py-3 border-b border-[rgba(0,190,215,0.08)] flex-wrap"
          style={{ background: "rgba(4,8,18,0.6)" }}
        >
          <div className="relative flex-1 max-w-xs">
            <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2a4060]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…"
              className="w-full bg-[#070e1c] border border-[rgba(0,200,220,0.12)] rounded pl-8 pr-3 py-2 sn-mono text-xs text-[#dde8f0] placeholder:text-[#1e3548] outline-none focus:border-[#00cfe0] transition-all"
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {(["all", "ready", "processing", "pending", "failed"] as const).map((f) => {
              const active = filter === f;
              const meta = f === "all" ? null : STATUS_META[f];
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="sn-mono text-[9px] tracking-widest px-3 py-1.5 rounded transition-all"
                  style={{
                    background: active ? "rgba(0,207,224,0.12)" : "transparent",
                    color: active ? "#00cfe0" : meta?.color ?? "#2a4060",
                    border: active ? "1px solid rgba(0,207,224,0.25)" : "1px solid transparent",
                  }}
                >
                  {f === "all" ? "ALL" : meta!.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1 ml-auto border border-[rgba(0,190,215,0.12)] rounded p-0.5">
            {([
              ["grid", <LayoutGrid size={13} key="g" />],
              ["list", <List size={13} key="l" />],
            ] as const).map(([m, icon]) => (
              <button
                key={m}
                onClick={() => setView(m as any)}
                className="p-1.5 rounded transition-all"
                style={{
                  background: view === m ? "rgba(0,207,224,0.15)" : "transparent",
                  color: view === m ? "#00cfe0" : "#2a4060",
                }}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* BODY */}
        <div className="px-6 md:px-8 py-6" style={{ background: "rgba(5,9,18,0.98)", minHeight: "60vh" }}>
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-[#00cfe0]" />
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <FolderOpen size={36} className="text-[#1e3548]" />
              <p className="sn-mono text-xs text-[#1e3548]">
                {search || filter !== "all" ? "No projects match" : "No projects yet"}
              </p>
              {!search && filter === "all" && (
                <button
                  onClick={() => setWizardOpen(true)}
                  className="mt-2 flex items-center gap-2 sn-mono text-[10px] tracking-widest px-4 py-2 rounded border border-[rgba(0,207,224,0.3)] text-[#00cfe0] hover:bg-[rgba(0,207,224,0.08)] transition"
                >
                  <Plus size={11} /> CREATE FIRST
                </button>
              )}
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visible.map((p: any, pi: number) => {
                const sm = STATUS_META[p.status] ?? STATUS_META.pending;
                const Icon = SOURCE_ICON[p.source_type] ?? FileText;
                const totalTests = p.test_cases_count || 0;
                const passed = p.passed_count || 0;
                const failed = p.failed_count || 0;
                const defects = p.defects_count || 0;
                const progress = p.progress ?? (totalTests ? Math.round((passed / totalTests) * 100) : 0);
                return (
                  <div
                    key={p.id}
                    className="flex flex-col gap-4 p-5 rounded-lg border text-left group relative overflow-hidden transition-all duration-200 sn-slide-up"
                    style={{
                      animationDelay: `${pi * 0.05}s`,
                      borderColor: "rgba(0,190,215,0.12)",
                      background: "rgba(7,14,28,0.7)",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      el.style.borderColor = `${sm.color}40`;
                      el.style.boxShadow = `0 0 30px ${sm.color}10`;
                      el.style.background = "rgba(7,14,28,0.95)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget;
                      el.style.borderColor = "rgba(0,190,215,0.12)";
                      el.style.boxShadow = "none";
                      el.style.background = "rgba(7,14,28,0.7)";
                    }}
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-[2px]"
                      style={{ background: sm.color, opacity: 0.5 }}
                    />
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${sm.color}12`, border: `1px solid ${sm.color}30` }}
                      >
                        <Icon size={17} style={{ color: sm.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Pill label={(p.source_type || "doc").toUpperCase()} color="#4a6a88" bg="rgba(0,180,200,0.07)" />
                          <Pill label={sm.label} color={sm.color} bg={sm.bg} dot />
                        </div>
                        <h3 className="font-sans text-sm font-semibold text-[#dde8f0] truncate">
                          {p.name}
                        </h3>
                        {p.github_url && (
                          <a
                            href={p.github_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="sn-mono text-[9px] text-[#00cfe0]/70 hover:text-[#00cfe0] flex items-center gap-1 mt-0.5 truncate"
                          >
                            <Github size={9} />
                            {p.github_url.replace("https://github.com/", "")}
                          </a>
                        )}
                      </div>
                      <ChevronRight
                        size={14}
                        className="text-[#2a4060] shrink-0 mt-1 group-hover:text-[#00cfe0] transition-colors"
                      />
                    </div>

                    <p className="font-sans text-xs text-[#3a5870] leading-relaxed line-clamp-2 min-h-[2rem]">
                      {p.description || "No description"}
                    </p>

                    {p.process_error && (
                      <p className="sn-mono text-[9px] text-[#ff3058] line-clamp-2 px-2 py-1 rounded bg-[rgba(255,48,88,0.06)] border border-[rgba(255,48,88,0.15)]">
                        ⚠ {p.process_error}
                      </p>
                    )}

                    {/* progress */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <ML dim>PROGRESS</ML>
                        <span
                          className="sn-mono text-xs"
                          style={{ color: progress === 100 ? "#22c55e" : sm.color }}
                        >
                          {progress}%
                        </span>
                      </div>
                      <div className="w-full h-[3px] bg-[#0a1a2e] rounded overflow-hidden">
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${progress}%`,
                            background: sm.color,
                            boxShadow: `0 0 6px ${sm.color}`,
                            animation: "sn-progress-bar 0.8s ease-out",
                          }}
                        />
                      </div>
                    </div>

                    {/* stat strip */}
                    <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[rgba(0,180,200,0.07)]">
                      {[
                        { v: p.files_count || 0, l: "FILES", c: "#4a6a88" },
                        { v: p.endpoints_count || 0, l: "EP", c: "#a855f7" },
                        { v: totalTests, l: "TESTS", c: "#dde8f0" },
                        { v: defects, l: "DEF", c: defects > 0 ? "#f97316" : "#4a6a88" },
                      ].map((s) => (
                        <div key={s.l} className="flex flex-col items-center gap-0.5">
                          <span className="sn-mono text-sm font-semibold" style={{ color: s.c }}>
                            {s.v}
                          </span>
                          <ML dim>{s.l}</ML>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[rgba(0,180,200,0.07)] gap-2">
                      <div className="flex items-center gap-1.5">
                        <Clock size={10} className="text-[#2a4060]" />
                        <span className="sn-mono text-[9px] text-[#2a4060]">
                          {new Date(p.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setCurrentProjectId(p.id);
                            navigate("/documents");
                          }}
                          className="flex items-center gap-1 sn-mono text-[9px] tracking-widest px-2.5 py-1.5 rounded border transition-all"
                          style={{ borderColor: `${sm.color}50`, color: sm.color, background: `${sm.color}08` }}
                        >
                          OPEN <ArrowRight size={9} />
                        </button>
                        {(p.source_type === "github" || p.source_type === "zip") && (
                          <button
                            onClick={() => reprocess.mutate(p)}
                            title="Reprocess"
                            className="p-1.5 rounded text-[#2a4060] hover:text-[#00cfe0] hover:bg-[rgba(0,207,224,0.08)] transition"
                          >
                            <RefreshCw size={11} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${p.name}"?`)) del.mutate(p.id);
                          }}
                          className="p-1.5 rounded text-[#2a4060] hover:text-[#ff3058] hover:bg-[rgba(255,48,88,0.08)] transition"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // LIST VIEW
            <div className="rounded-lg border border-[rgba(0,190,215,0.12)] overflow-hidden">
              {visible.map((p: any, i: number) => {
                const sm = STATUS_META[p.status] ?? STATUS_META.pending;
                const totalTests = p.test_cases_count || 0;
                const passed = p.passed_count || 0;
                const progress = p.progress ?? (totalTests ? Math.round((passed / totalTests) * 100) : 0);
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setCurrentProjectId(p.id);
                      navigate("/documents");
                    }}
                    className="w-full flex items-center gap-5 px-6 py-4 border-b border-[rgba(0,180,200,0.07)] last:border-0 text-left hover:bg-[rgba(0,207,224,0.03)] transition-all group sn-slide-up"
                    style={{
                      animationDelay: `${i * 0.04}s`,
                      background: i % 2 === 0 ? "rgba(7,14,28,0.5)" : "rgba(5,10,20,0.4)",
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: sm.color, boxShadow: `0 0 6px ${sm.color}` }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-sm text-[#c0d0e0] truncate group-hover:text-[#dde8f0]">
                        {p.name}
                      </p>
                      <p className="sn-mono text-[9px] text-[#2a4060]">
                        {p.source_type} · {p.endpoints_count || 0} endpoints · {totalTests} tests
                      </p>
                    </div>
                    <div className="w-24">
                      <div className="w-full h-[3px] bg-[#0a1a2e] rounded overflow-hidden">
                        <div className="h-full rounded" style={{ width: `${progress}%`, background: sm.color }} />
                      </div>
                    </div>
                    <span className="sn-mono text-xs w-10 text-right" style={{ color: sm.color }}>
                      {progress}%
                    </span>
                    <Pill label={sm.label} color={sm.color} bg={sm.bg} dot />
                    <ChevronRight size={13} className="text-[#2a4060] group-hover:text-[#00cfe0] transition" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ProjectWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        workspaceId={currentWorkspace.id}
        onCreated={() => qc.invalidateQueries({ queryKey: ["projects"] })}
      />
    </AppLayout>
  );
}
