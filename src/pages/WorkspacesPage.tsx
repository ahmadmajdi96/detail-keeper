import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { WorkspaceWizard } from "@/components/workspaces/WorkspaceWizard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MetricCard } from "@/components/ui/metric-card";
import {
  Eye, FolderKanban, HardDrive, LayoutGrid, List, Loader2,
  Plus, Search, Settings, Shield, Trash2, Users, Database, Sparkles,
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

const ACCENTS = [
  "hsl(var(--accent))",
  "hsl(262 83% 58%)",
  "hsl(199 89% 48%)",
  "hsl(38 92% 50%)",
  "hsl(var(--success))",
];
const accentFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
};

export default function WorkspacesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setCurrentWorkspaceId } = useWorkspace();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [view, setView] = useState<"grid" | "list">("grid");
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
        .from("workspaces").select("*").order("created_at", { ascending: false });
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

  const filtered = workspaces.filter((w) => {
    const s = search.toLowerCase();
    const matchesSearch =
      w.name.toLowerCase().includes(s) ||
      (w.description || "").toLowerCase().includes(s);
    const matchesStatus = statusFilter === "all" || w.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalProjects = workspaces.reduce((s, w) => s + (w.projects_count || 0), 0);
  const totalMembers = workspaces.reduce((s, w) => s + (w.members_count || 0), 0);
  const totalStorageMb = workspaces.reduce((s, w) => s + (w.storage_used || 0), 0);
  const totalQuotaMb = workspaces.reduce((s, w) => s + (w.storage_quota || 0), 0);

  const fmtStorage = (mb: number) =>
    mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb} MB`;

  const open = (id: string) => {
    setCurrentWorkspaceId(id);
    navigate(`/workspaces/${id}`);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Workspaces"
        description="Manage your QA workspaces, members and access control"
        actions={
          hasPermission(["admin", "qa_manager"]) ? (
            <Button onClick={() => setWizardOpen(true)} className="ai-gradient text-white">
              <Plus className="h-4 w-4 mr-2" /> New workspace
            </Button>
          ) : null
        }
      />

      {/* KPI row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="grid gap-4 grid-cols-2 lg:grid-cols-4"
      >
        <MetricCard variant="accent" label="Workspaces" value={workspaces.length} icon={<Shield className="h-5 w-5" />} />
        <MetricCard label="Projects" value={totalProjects} icon={<FolderKanban className="h-5 w-5" />} />
        <MetricCard label="Members" value={totalMembers} icon={<Users className="h-5 w-5" />} />
        <MetricCard
          variant={totalQuotaMb && totalStorageMb / totalQuotaMb > 0.8 ? "warning" : "default"}
          label="Storage used" value={fmtStorage(totalStorageMb)}
          icon={<Database className="h-5 w-5" />}
          description={totalQuotaMb ? `of ${fmtStorage(totalQuotaMb)} quota` : undefined}
        />
      </motion.div>

      {/* Toolbar */}
      <Card className="mt-6 border-border/50">
        <CardContent className="p-3 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search workspaces…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 border border-border rounded-md p-0.5">
            {(["all", "active", "archived"] as const).map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2 text-xs capitalize"
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </Button>
            ))}
          </div>
            {([["grid", LayoutGrid], ["list", List]] as const).map(([m, Icon]) => (
              <Button
                key={m} variant={view === m ? "secondary" : "ghost"} size="sm"
                className="h-7 w-7 p-0" onClick={() => setView(m as any)}
              >
                <Icon className="h-3.5 w-3.5" />
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Body */}
      <div className="mt-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-border/50 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <FolderKanban className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {search ? "No workspaces match your search" : "No workspaces yet"}
              </p>
              {!search && hasPermission(["admin", "qa_manager"]) && (
                <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Create first workspace
                </Button>
              )}
            </CardContent>
          </Card>
        ) : view === "grid" ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((ws, wi) => {
              const color = accentFor(ws.id);
              const storagePct = ws.storage_quota
                ? Math.round(((ws.storage_used || 0) / ws.storage_quota) * 100)
                : 0;
              return (
                <motion.div
                  key={ws.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: wi * 0.04 }}
                >
                  <Card className="border-border/50 hover:border-accent/40 hover:shadow-elevated transition-all group relative overflow-hidden">
                    <div
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
                    />
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <div
                          className="h-11 w-11 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: `color-mix(in hsl, ${color} 12%, transparent)`, color }}
                        >
                          <Shield className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="font-semibold text-base truncate">{ws.name}</h3>
                            <Badge
                              variant="outline"
                              className={
                                ws.status === "active"
                                  ? "bg-success/10 text-success border-success/20"
                                  : "bg-muted text-muted-foreground"
                              }
                            >
                              {ws.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                            {ws.description || "No description"}
                          </p>
                        </div>
                      </div>

                      {/* Stat strip */}
                      <div className="grid grid-cols-3 gap-2 py-3 border-y border-border/50">
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-semibold tabular-nums">{ws.projects_count}</span>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Projects</span>
                        </div>
                        <div className="flex flex-col items-center border-x border-border/50">
                          <span className="text-lg font-semibold tabular-nums">{ws.members_count}</span>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Members</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-lg font-semibold tabular-nums">{storagePct}%</span>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Storage</span>
                        </div>
                      </div>

                      {ws.storage_quota > 0 && (
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <HardDrive className="h-3 w-3" />
                              {fmtStorage(ws.storage_used || 0)} / {fmtStorage(ws.storage_quota || 0)}
                            </span>
                          </div>
                          <Progress
                            value={storagePct}
                            className="h-1.5"
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <Button size="sm" className="flex-1" onClick={() => open(ws.id)}>
                          <Eye className="h-3.5 w-3.5 mr-1.5" /> Open
                        </Button>
                        <Button
                          variant="outline" size="sm"
                          onClick={() => navigate(`/workspaces/${ws.id}?tab=settings`)}
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                        {hasPermission("admin") && (
                          <Button
                            variant="outline" size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:border-destructive/40"
                            onClick={() => {
                              if (confirm(`Delete workspace "${ws.name}"?`)) deleteMutation.mutate(ws.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <Card className="border-border/50">
            <CardContent className="p-0">
              {filtered.map((ws, i) => {
                const color = accentFor(ws.id);
                const storagePct = ws.storage_quota
                  ? Math.round(((ws.storage_used || 0) / ws.storage_quota) * 100)
                  : 0;
                return (
                  <button
                    key={ws.id}
                    onClick={() => open(ws.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 border-b border-border/50 last:border-0 text-left hover:bg-accent/5 transition-all group"
                  >
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: color, boxShadow: `0 0 6px ${color}` }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{ws.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ws.projects_count} projects · {ws.members_count} members · {fmtStorage(ws.storage_used || 0)}
                      </p>
                    </div>
                    <div className="hidden md:flex items-center gap-2 w-32">
                      <Progress value={storagePct} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{storagePct}%</span>
                    </div>
                    <Badge variant="outline" className={
                      ws.status === "active"
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-muted text-muted-foreground"
                    }>{ws.status}</Badge>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      <WorkspaceWizard
        open={wizardOpen}
        onOpenChange={(o) => {
          setWizardOpen(o);
          if (!o) queryClient.invalidateQueries({ queryKey: ["workspaces"] });
        }}
      />
    </AppLayout>
  );
}
