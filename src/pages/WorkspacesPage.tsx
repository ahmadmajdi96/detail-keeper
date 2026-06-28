import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { WorkspaceWizard } from "@/components/workspaces/WorkspaceWizard";
import {
  SentinelStyles, Scanline, GridBackdrop, ML, Pill, RingProgress, colorFor,
} from "@/components/sentinel/primitives";
import {
  Activity, Eye, FolderKanban, Globe, HardDrive, LayoutGrid, List, Loader2,
  Lock, Plus, Search, Settings, Shield, Trash2, Users,
} from "lucide-react";
import { toast } from "sonner";

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  owner_id: string | null;
  status: string;
  storage_quota: number;
  storage_used: number;
  projects_count: number;
  members_count: number;
  created_at: string;
}

export default function WorkspacesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setCurrentWorkspaceId, refresh } = useWorkspace();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(searchParams.get("new") === "1");

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setWizardOpen(true);
      searchParams.delete("new");
      setSearchParams(searchParams);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Workspace[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workspaces").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("Workspace deleted");
    },
    onError: (e: any) => toast.error("Failed: " + e.message),
  });

  const filtered = workspaces.filter(
    (w) =>
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      (w.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalProjects = workspaces.reduce((s, w) => s + (w.projects_count || 0), 0);
  const totalMembers = workspaces.reduce((s, w) => s + (w.members_count || 0), 0);
  const totalStorageMb = workspaces.reduce((s, w) => s + (w.storage_used || 0), 0);

  const fmtStorage = (mb: number) =>
    mb >= 1000 ? `${(mb / 1000).toFixed(1)}GB` : `${mb}MB`;

  const open = (id: string) => {
    setCurrentWorkspaceId(id);
    navigate(`/workspaces/${id}`);
  };

  return (
    <AppLayout>
      <SentinelStyles />
      <Scanline />
      <div className="-mx-4 md:-mx-6 -my-6">
        {/* HEADER */}
        <div
          className="relative overflow-hidden border-b border-[rgba(0,190,215,0.1)]"
          style={{ background: "linear-gradient(180deg, rgba(0,30,60,0.45) 0%, rgba(4,7,15,0.95) 100%)" }}
        >
          <GridBackdrop opacity={0.04} />
          <div className="relative px-6 md:px-8 py-6">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00cfe0] sn-glow" />
                  <ML>Organization · Workspace Management</ML>
                </div>
                <h1 className="font-sans text-2xl font-semibold text-[#dde8f0] tracking-tight">
                  Workspaces
                </h1>
                <p className="font-sans text-sm text-[#3a5870] mt-1">
                  Manage your QA workspaces, members and access control.
                </p>
              </div>
              {hasPermission(["admin", "qa_manager"]) && (
                <button
                  onClick={() => setWizardOpen(true)}
                  className="flex items-center gap-2 sn-mono text-[10px] tracking-widest px-4 py-2.5 rounded transition-all"
                  style={{ background: "#00cfe0", color: "#04070f", boxShadow: "0 0 20px rgba(0,207,224,0.3)" }}
                >
                  <Plus size={12} /> NEW WORKSPACE
                </button>
              )}
            </div>

            {/* ORG STATS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { v: workspaces.length, l: "WORKSPACES", c: "#00cfe0" },
                { v: totalProjects, l: "PROJECTS", c: "#dde8f0" },
                { v: totalMembers, l: "MEMBERS", c: "#a855f7" },
                { v: fmtStorage(totalStorageMb), l: "STORAGE USED", c: "#f97316" },
              ].map((s, i) => (
                <div
                  key={s.l}
                  className="px-4 py-3 rounded border border-[rgba(0,190,215,0.1)] bg-[rgba(7,14,28,0.6)] sn-count-up"
                  style={{ animationDelay: `${i * 0.06}s`, boxShadow: `inset 0 0 30px ${s.c}05` }}
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
          className="flex items-center gap-3 px-6 md:px-8 py-3 border-b border-[rgba(0,190,215,0.08)]"
          style={{ background: "rgba(4,8,18,0.6)" }}
        >
          <div className="relative flex-1 max-w-xs">
            <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#2a4060]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search workspaces…"
              className="w-full bg-[#070e1c] border border-[rgba(0,200,220,0.12)] rounded pl-8 pr-3 py-2 sn-mono text-xs text-[#dde8f0] placeholder:text-[#1e3548] outline-none focus:border-[#00cfe0] transition-all"
            />
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
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <FolderKanban size={36} className="text-[#1e3548]" />
              <p className="sn-mono text-xs text-[#1e3548]">
                {search ? "No workspaces match" : "No workspaces yet"}
              </p>
              {!search && hasPermission(["admin", "qa_manager"]) && (
                <button
                  onClick={() => setWizardOpen(true)}
                  className="mt-2 flex items-center gap-2 sn-mono text-[10px] tracking-widest px-4 py-2 rounded border border-[rgba(0,207,224,0.3)] text-[#00cfe0] hover:bg-[rgba(0,207,224,0.08)] transition"
                >
                  <Plus size={11} /> CREATE FIRST
                </button>
              )}
            </div>
          ) : view === "grid" ? (
            <div className="flex flex-col gap-4">
              {filtered.map((ws, wi) => {
                const color = colorFor(ws.id);
                const hovered = hoverId === ws.id;
                const storagePct = ws.storage_quota
                  ? Math.round(((ws.storage_used || 0) / ws.storage_quota) * 100)
                  : 0;
                return (
                  <div
                    key={ws.id}
                    onMouseEnter={() => setHoverId(ws.id)}
                    onMouseLeave={() => setHoverId(null)}
                    className="relative rounded-lg border overflow-hidden transition-all duration-300 sn-slide-up"
                    style={{
                      animationDelay: `${wi * 0.06}s`,
                      borderColor: hovered ? `${color}50` : "rgba(0,190,215,0.12)",
                      background: hovered ? "rgba(7,14,28,0.95)" : "rgba(7,14,28,0.6)",
                      boxShadow: hovered ? `0 0 40px ${color}12` : "none",
                    }}
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-[2px]"
                      style={{ background: color, opacity: hovered ? 1 : 0.45, transition: "opacity 0.3s" }}
                    />
                    <div className="flex flex-col lg:flex-row items-start gap-6 px-6 py-5">
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${color}12`, border: `1px solid ${color}30` }}
                      >
                        <Shield size={20} style={{ color }} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h3 className="font-sans text-base font-semibold text-[#dde8f0]">{ws.name}</h3>
                          <Pill
                            label={ws.status === "active" ? "ACTIVE" : ws.status.toUpperCase()}
                            color={ws.status === "active" ? "#22c55e" : "#4a6a88"}
                            bg={ws.status === "active" ? "rgba(34,197,94,0.1)" : "rgba(74,106,136,0.12)"}
                            dot
                          />
                          <Pill label="PRIVATE" color="#4a6a88" bg="rgba(74,106,136,0.12)" />
                        </div>
                        <p className="font-sans text-xs text-[#3a5870] mb-3 line-clamp-2 max-w-xl">
                          {ws.description || "No description"}
                        </p>
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <Users size={11} className="text-[#2a4060]" />
                            <span className="sn-mono text-[10px] text-[#4a6a88]">
                              {ws.members_count} members
                            </span>
                          </div>
                          <span className="sn-mono text-[10px] text-[#1e3548]">·</span>
                          <div className="flex items-center gap-1.5">
                            <FolderKanban size={11} className="text-[#2a4060]" />
                            <span className="sn-mono text-[10px] text-[#4a6a88]">
                              {ws.projects_count} projects
                            </span>
                          </div>
                          <span className="sn-mono text-[10px] text-[#1e3548]">·</span>
                          <div className="flex items-center gap-1.5">
                            <HardDrive size={11} className="text-[#2a4060]" />
                            <span className="sn-mono text-[10px] text-[#4a6a88]">
                              {fmtStorage(ws.storage_used || 0)} / {fmtStorage(ws.storage_quota || 0)}
                            </span>
                          </div>
                          <span className="sn-mono text-[10px] text-[#1e3548]">·</span>
                          <span className="sn-mono text-[10px] text-[#2a4060]">
                            Since {new Date(ws.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                        {ws.storage_quota > 0 && (
                          <div className="mt-3 w-full h-[3px] bg-[#0a1a2e] rounded overflow-hidden max-w-md">
                            <div
                              className="h-full transition-all"
                              style={{
                                width: `${storagePct}%`,
                                background: storagePct > 85 ? "#ff3058" : storagePct > 70 ? "#f97316" : color,
                                boxShadow: `0 0 6px ${color}`,
                              }}
                            />
                          </div>
                        )}
                      </div>

                      {/* RING */}
                      <div className="flex items-center gap-5 shrink-0">
                        <RingProgress
                          pct={storagePct}
                          size={72}
                          stroke={4}
                          color={color}
                          label="STORAGE"
                        />
                        <div className="flex flex-col gap-2">
                          <div>
                            <span className="sn-mono text-sm font-semibold text-[#dde8f0]">
                              {ws.projects_count}
                            </span>
                            <div><ML dim>PROJECTS</ML></div>
                          </div>
                          <div>
                            <span className="sn-mono text-sm font-semibold" style={{ color: "#a855f7" }}>
                              {ws.members_count}
                            </span>
                            <div><ML dim>MEMBERS</ML></div>
                          </div>
                        </div>
                      </div>

                      {/* ACTIONS */}
                      <div className="flex flex-row lg:flex-col gap-2 shrink-0">
                        <button
                          onClick={() => open(ws.id)}
                          className="flex items-center gap-1.5 sn-mono text-[9px] tracking-widest px-3 py-2 rounded border transition-all"
                          style={{ borderColor: color + "50", color, background: `${color}08` }}
                        >
                          <Eye size={11} /> OPEN
                        </button>
                        <button
                          onClick={() => navigate(`/workspaces/${ws.id}?tab=settings`)}
                          className="flex items-center gap-1.5 sn-mono text-[9px] tracking-widest px-3 py-2 rounded border border-[rgba(0,190,215,0.15)] text-[#4a6a88] hover:text-[#00cfe0] hover:border-[rgba(0,207,224,0.3)] transition-all"
                        >
                          <Settings size={11} /> SETTINGS
                        </button>
                        {hasPermission("admin") && (
                          <button
                            onClick={() => {
                              if (confirm(`Delete workspace "${ws.name}"?`)) deleteMutation.mutate(ws.id);
                            }}
                            className="flex items-center gap-1.5 sn-mono text-[9px] tracking-widest px-3 py-2 rounded border border-[rgba(255,48,88,0.2)] text-[#ff3058] hover:bg-[rgba(255,48,88,0.08)] transition-all"
                          >
                            <Trash2 size={11} /> DELETE
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // LIST VIEW
            <div className="rounded-lg border border-[rgba(0,190,215,0.12)] overflow-hidden">
              {filtered.map((ws, i) => {
                const color = colorFor(ws.id);
                return (
                  <button
                    key={ws.id}
                    onClick={() => open(ws.id)}
                    className="w-full flex items-center gap-5 px-6 py-4 border-b border-[rgba(0,180,200,0.07)] last:border-0 text-left hover:bg-[rgba(0,207,224,0.03)] transition-all group sn-slide-up"
                    style={{
                      animationDelay: `${i * 0.04}s`,
                      background: i % 2 === 0 ? "rgba(7,14,28,0.5)" : "rgba(5,10,20,0.4)",
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-sm text-[#c0d0e0] truncate group-hover:text-[#dde8f0]">
                        {ws.name}
                      </p>
                      <p className="sn-mono text-[9px] text-[#2a4060]">
                        {ws.projects_count} projects · {ws.members_count} members
                      </p>
                    </div>
                    <span className="sn-mono text-[10px] text-[#4a6a88]">
                      {fmtStorage(ws.storage_used || 0)}
                    </span>
                    <Pill
                      label={ws.status.toUpperCase()}
                      color={ws.status === "active" ? "#22c55e" : "#4a6a88"}
                      bg={ws.status === "active" ? "rgba(34,197,94,0.1)" : "rgba(74,106,136,0.12)"}
                      dot
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <WorkspaceWizard
        open={wizardOpen}
        onOpenChange={(o) => {
          setWizardOpen(o);
          if (!o) refresh();
        }}
      />
    </AppLayout>
  );
}
