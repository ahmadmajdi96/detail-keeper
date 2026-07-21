import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useEntitlements, useOrgUsage } from "@/hooks/useEntitlements";
import { SentinelStyles, Scanline, GridBackdrop, ML, Pill } from "@/components/sentinel/primitives";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Bell, Bug, Check, CheckCheck, FileText, FolderOpen, Loader2, Mail,
  Play, ShieldCheck, Smartphone, Sparkles, Trash2, Users, Zap, BellOff,
  Activity, Gauge, HardDrive, Layers,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

type ChannelKey = "inApp" | "email" | "push";
interface NotifCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  events: string[];
  roles: string[];
  color: string;
}

const CATEGORIES: NotifCategory[] = [
  { id: "defects", title: "Defects", description: "New defects, assignments and status changes",
    icon: Bug, events: ["defect_assigned", "defect_created", "defect_status"],
    roles: ["admin","qa_manager","qa_engineer"], color: "#ff3058" },
  { id: "executions", title: "Test Executions", description: "Test runs that pass, fail or get blocked",
    icon: Play, events: ["execution_completed"],
    roles: ["admin","qa_manager","qa_engineer"], color: "#22c55e" },
  { id: "projects", title: "Projects", description: "Project creation, processing and ingestion status",
    icon: FolderOpen, events: ["project_created","project_ready","project_failed"],
    roles: ["admin","qa_manager"], color: "#00cfe0" },
  { id: "documents", title: "Documents", description: "AI extraction results from PRDs and repos",
    icon: FileText, events: ["document_ready","document_failed"],
    roles: ["admin","qa_manager","qa_engineer"], color: "#a855f7" },
  { id: "members", title: "Workspace Members", description: "Invitations and new members joining",
    icon: Users, events: ["workspace_invite","member_added"],
    roles: ["admin","qa_manager","qa_engineer","viewer"], color: "#eab308" },
  { id: "plans", title: "Test Plans", description: "New plans and AI-generated coverage",
    icon: Sparkles, events: ["test_plan_created"],
    roles: ["admin","qa_manager"], color: "#f97316" },
];

const PREF_KEY = "qx_notif_prefs_v1";

const ICON_FOR_TYPE: Record<string, React.ElementType> = {
  defect_assigned: Bug, defect_created: Bug, defect_status: Bug,
  execution_completed: Play, project_created: FolderOpen,
  project_ready: FolderOpen, project_failed: FolderOpen,
  document_ready: FileText, document_failed: FileText,
  workspace_invite: Users, member_added: Users, test_plan_created: Sparkles,
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll } =
    useNotifications();

  // Filter categories by user role (role/access-based)
  const visibleCategories = useMemo(
    () => CATEGORIES.filter((c) => user && c.roles.includes(user.role)),
    [user],
  );

  const [prefs, setPrefs] = useState<Record<string, Record<ChannelKey, boolean>>>(() => {
    if (typeof window === "undefined") return {};
    try { return JSON.parse(localStorage.getItem(PREF_KEY) || "{}"); } catch { return {}; }
  });
  const [saving, setSaving] = useState(false);

  const getPref = (id: string, ch: ChannelKey) =>
    prefs[id]?.[ch] ?? (ch === "email" ? false : true);

  const update = (id: string, ch: ChannelKey, v: boolean) => {
    setPrefs((p) => ({ ...p, [id]: { ...(p[id] || { inApp: true, email: false, push: true }), [ch]: v } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
      await new Promise((r) => setTimeout(r, 300));
      toast.success("Preferences saved");
    } finally { setSaving(false); }
  };

  const enableAll = () => {
    const next: typeof prefs = {};
    visibleCategories.forEach((c) => (next[c.id] = { inApp: true, email: true, push: true }));
    setPrefs(next);
  };
  const disableAll = () => {
    const next: typeof prefs = {};
    visibleCategories.forEach((c) => (next[c.id] = { inApp: false, email: false, push: false }));
    setPrefs(next);
  };

  const recent = notifications.slice(0, 12);

  const handleOpen = (n: any) => {
    if (!n.read) markAsRead(n.id);
    const d = n.data || {};
    if (d.defect_id) navigate("/defects");
    else if (d.project_id && !d.document_id) navigate("/projects");
    else if (d.document_id) navigate("/documents");
    else if (d.test_plan_id) navigate("/test-plans");
    else if (d.workspace_id) navigate(`/workspaces/${d.workspace_id}`);
  };

  return (
    <AppLayout>
      <SentinelStyles />
      <Scanline />
      <div className="-mx-3 md:-mx-6 lg:-mx-8 -my-6">
        {/* HERO */}
        <div
          className="relative overflow-hidden border-b border-[rgba(0,190,215,0.1)]"
          style={{ background: "linear-gradient(180deg, rgba(0,30,60,0.45) 0%, rgba(4,7,15,0.95) 100%)" }}
        >
          <GridBackdrop opacity={0.04} />
          <div className="relative px-6 md:px-8 py-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00cfe0] sn-glow" />
                  <ML>Inbox · Role: {user?.role}</ML>
                </div>
                <h1 className="font-sans text-2xl font-semibold text-[#dde8f0] tracking-tight">
                  Notifications
                </h1>
                <p className="font-sans text-sm text-[#3a5870] mt-1 max-w-xl">
                  Real-time alerts scoped to your role and workspaces. Choose how each event reaches you.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={disableAll}>
                  <BellOff className="h-3.5 w-3.5 mr-1.5" /> Disable all
                </Button>
                <Button variant="outline" size="sm" onClick={enableAll}>
                  <Bell className="h-3.5 w-3.5 mr-1.5" /> Enable all
                </Button>
                <Button size="sm" onClick={save} disabled={saving} className="bg-[#00cfe0] text-[#04070f] hover:bg-[#00b5c4]">
                  {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                  Save
                </Button>
              </div>
            </div>

            {/* Stat strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
              {[
                { v: notifications.length, l: "TOTAL", c: "#00cfe0" },
                { v: unreadCount, l: "UNREAD", c: unreadCount ? "#f97316" : "#4a6a88" },
                { v: visibleCategories.length, l: "CATEGORIES", c: "#a855f7" },
                { v: user?.role?.toUpperCase().replace("_"," ") ?? "—", l: "YOUR ROLE", c: "#22c55e" },
              ].map((s, i) => (
                <div key={s.l} className="px-4 py-3 rounded border border-[rgba(0,190,215,0.1)] bg-[rgba(7,14,28,0.6)] sn-count-up"
                  style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="sn-mono text-lg font-semibold mb-0.5 truncate" style={{ color: s.c as string }}>{s.v as any}</div>
                  <ML dim>{s.l}</ML>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* USAGE — replaces mentions area with real usage telemetry */}
        <UsageStrip />

        {/* BODY */}
        <div className="px-6 md:px-8 py-6 grid grid-cols-1 lg:grid-cols-5 gap-6" style={{ background: "rgba(5,9,18,0.98)", minHeight: "60vh" }}>
          {/* Preferences */}
          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={13} className="text-[#00cfe0]" />
              <ML>Delivery Channels — role: {user?.role}</ML>
            </div>

            <div className="hidden md:grid grid-cols-[1fr,72px,72px,72px] gap-3 px-4 pb-1">
              <span />
              <div className="flex items-center justify-center gap-1 text-[#4a6a88]"><Bell size={11}/><ML dim>IN-APP</ML></div>
              <div className="flex items-center justify-center gap-1 text-[#4a6a88]"><Mail size={11}/><ML dim>EMAIL</ML></div>
              <div className="flex items-center justify-center gap-1 text-[#4a6a88]"><Smartphone size={11}/><ML dim>PUSH</ML></div>
            </div>

            {visibleCategories.map((c, i) => {
              const Icon = c.icon;
              return (
                <div key={c.id}
                  className="grid grid-cols-1 md:grid-cols-[1fr,72px,72px,72px] gap-3 items-center px-4 py-3 rounded-lg border border-[rgba(0,190,215,0.12)] bg-[rgba(7,14,28,0.6)] transition-all hover:border-[rgba(0,207,224,0.25)] sn-slide-up"
                  style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${c.color}12`, border: `1px solid ${c.color}30` }}>
                      <Icon size={15} style={{ color: c.color }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-sans text-sm text-[#dde8f0]">{c.title}</p>
                      <p className="text-xs text-[#3a5870] truncate">{c.description}</p>
                    </div>
                  </div>
                  {(["inApp","email","push"] as ChannelKey[]).map((ch) => (
                    <div key={ch} className="flex items-center md:justify-center gap-2">
                      <span className="md:hidden text-[10px] uppercase text-[#4a6a88] w-12">{ch}</span>
                      <Switch checked={getPref(c.id, ch)} onCheckedChange={(v) => update(c.id, ch, v)} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Live feed */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap size={13} className="text-[#00cfe0]" />
                <ML>Live feed</ML>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button onClick={() => markAllAsRead()}
                    className="sn-mono text-[9px] tracking-widest text-[#4a6a88] hover:text-[#00cfe0] flex items-center gap-1 px-2 py-1">
                    <CheckCheck size={11}/> READ ALL
                  </button>
                )}
                {notifications.length > 0 && (
                  <button onClick={() => clearAll()}
                    className="sn-mono text-[9px] tracking-widest text-[#4a6a88] hover:text-[#ff3058] flex items-center gap-1 px-2 py-1">
                    <Trash2 size={11}/> CLEAR
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-[rgba(0,190,215,0.12)] bg-[rgba(7,14,28,0.6)] overflow-hidden divide-y divide-[rgba(0,180,200,0.07)]">
              {recent.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-2">
                  <Bell size={28} className="text-[#1e3548]" />
                  <p className="sn-mono text-[10px] text-[#2a4060]">No notifications yet</p>
                </div>
              ) : recent.map((n, i) => {
                const Icon = ICON_FOR_TYPE[n.type] ?? Bell;
                return (
                  <div key={n.id} role="button" tabIndex={0}
                    onClick={() => handleOpen(n)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleOpen(n); }}
                    className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-[rgba(0,207,224,0.04)] transition-colors group sn-slide-up cursor-pointer"
                    style={{ animationDelay: `${i * 0.03}s` }}>
                    <div className="h-8 w-8 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: "rgba(0,207,224,0.08)", border: "1px solid rgba(0,207,224,0.2)" }}>
                      <Icon size={13} className="text-[#00cfe0]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-sans text-sm truncate ${n.read ? "text-[#7a96b0]" : "text-[#dde8f0]"}`}>
                          {n.title}
                        </p>
                        {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-[#00cfe0] shrink-0" />}
                      </div>
                      <p className="text-xs text-[#3a5870] line-clamp-2">{n.message}</p>
                      <p className="sn-mono text-[9px] text-[#2a4060] mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-[#4a6a88] hover:text-[#ff3058] p-1"
                      aria-label="delete">
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
