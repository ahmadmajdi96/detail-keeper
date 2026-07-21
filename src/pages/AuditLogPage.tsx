import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Download, Search, ShieldAlert, Loader2, Activity, Users, AlertTriangle,
  Tag, X, ChevronDown, RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { Navigate } from "react-router-dom";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Row = {
  id: string; created_at: string; actor_id: string | null;
  action: string; entity_kind: string | null; entity_id: string | null;
  workspace_id: string | null; meta: Record<string, unknown> | null;
  actor?: { id: string; name: string | null; email: string | null } | null;
};

const SECURITY_KEYWORDS = ["fail", "denied", "forbidden", "unauthor", "revoke", "delete", "block", "invalid"];

export default function AuditLogPage() {
  const { currentOrganization, currentOrgRole } = useOrganization();
  const canView = currentOrgRole === "owner" || currentOrgRole === "security_admin";

  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pageSize, setPageSize] = useState(500);
  const [selActors, setSelActors] = useState<string[]>([]);
  const [selActions, setSelActions] = useState<string[]>([]);
  const [selKinds, setSelKinds] = useState<string[]>([]);
  const [selWorkspaces, setSelWorkspaces] = useState<string[]>([]);

  const rowsQ = useQuery({
    queryKey: ["audit-logs", currentOrganization?.id, from, to, pageSize],
    enabled: !!currentOrganization?.id && canView,
    queryFn: async () => {
      let qb = supabase
        .from("audit_logs")
        .select("id,created_at,actor_id,action,entity_kind,entity_id,meta,workspace_id")
        .eq("org_id", currentOrganization!.id)
        .order("created_at", { ascending: false })
        .limit(pageSize);
      if (from) qb = qb.gte("created_at", new Date(from).toISOString());
      if (to) qb = qb.lte("created_at", new Date(to).toISOString());
      const { data, error } = await qb;
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map((r) => r.actor_id).filter(Boolean))) as string[];
      let profiles: any[] = [];
      if (ids.length) {
        const { data: p } = await supabase.from("profiles").select("id,name,email").in("id", ids);
        profiles = p || [];
      }
      return (data || []).map((r) => ({ ...r, actor: profiles.find((p) => p.id === r.actor_id) || null })) as Row[];
    },
  });

  const rows = rowsQ.data || [];

  // Distinct value pools from current dataset (dynamic filters)
  const facets = useMemo(() => {
    const actorMap = new Map<string, string>();
    const actionSet = new Set<string>();
    const kindSet = new Set<string>();
    const workspaceSet = new Set<string>();
    rows.forEach((r) => {
      if (r.actor_id) actorMap.set(r.actor_id, r.actor?.name || r.actor?.email || r.actor_id.slice(0, 8));
      if (r.action) actionSet.add(r.action);
      if (r.entity_kind) kindSet.add(r.entity_kind);
      if (r.workspace_id) workspaceSet.add(r.workspace_id);
    });
    return {
      actors: Array.from(actorMap.entries()).map(([id, label]) => ({ id, label })),
      actions: Array.from(actionSet).sort(),
      kinds: Array.from(kindSet).sort(),
      workspaces: Array.from(workspaceSet).sort(),
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (selActors.length && (!r.actor_id || !selActors.includes(r.actor_id))) return false;
      if (selActions.length && !selActions.includes(r.action)) return false;
      if (selKinds.length && (!r.entity_kind || !selKinds.includes(r.entity_kind))) return false;
      if (selWorkspaces.length && (!r.workspace_id || !selWorkspaces.includes(r.workspace_id))) return false;
      if (!s) return true;
      return (
        (r.action || "").toLowerCase().includes(s) ||
        (r.entity_kind || "").toLowerCase().includes(s) ||
        (r.actor?.name || "").toLowerCase().includes(s) ||
        (r.actor?.email || "").toLowerCase().includes(s) ||
        JSON.stringify(r.meta || {}).toLowerCase().includes(s)
      );
    });
  }, [rows, q, selActors, selActions, selKinds, selWorkspaces]);

  const stats = useMemo(() => {
    const uniqueActors = new Set(filtered.map((r) => r.actor_id).filter(Boolean)).size;
    const security = filtered.filter((r) => {
      const a = (r.action || "").toLowerCase();
      return SECURITY_KEYWORDS.some((k) => a.includes(k));
    }).length;
    const counts = new Map<string, number>();
    filtered.forEach((r) => counts.set(r.action, (counts.get(r.action) || 0) + 1));
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    const today = filtered.filter((r) => new Date(r.created_at) >= day).length;
    return { total: filtered.length, uniqueActors, security, topAction: top?.[0] || "—", topCount: top?.[1] || 0, today };
  }, [filtered]);

  function exportCsv() {
    const headers = ["when", "actor_name", "actor_email", "action", "entity_kind", "entity_id", "workspace_id", "meta"];
    const dataRows = filtered.map((r) => [
      new Date(r.created_at).toISOString(),
      r.actor?.name || "",
      r.actor?.email || "",
      r.action,
      r.entity_kind || "",
      r.entity_id || "",
      r.workspace_id || "",
      JSON.stringify(r.meta || {}),
    ]);
    const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.map(esc).join(","), ...dataRows.map((r) => r.map(esc).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${currentOrganization?.slug || "org"}-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearAll() {
    setSelActors([]); setSelActions([]); setSelKinds([]); setSelWorkspaces([]);
    setQ(""); setFrom(""); setTo("");
  }

  if (currentOrganization && !canView) return <Navigate to="/organization" replace />;

  const activeFilterCount = selActors.length + selActions.length + selKinds.length + selWorkspaces.length + (q ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0);

  const statCards = [
    { label: "Total events",   value: stats.total,       hint: "Matching filters",             icon: Activity,      color: "text-accent" },
    { label: "Today",          value: stats.today,       hint: "Since midnight",               icon: RefreshCw,     color: "text-info" },
    { label: "Unique actors",  value: stats.uniqueActors,hint: "Distinct users acting",        icon: Users,         color: "text-success" },
    { label: "Security signals", value: stats.security,  hint: "Failures / revokes / denies",  icon: AlertTriangle, color: "text-warning" },
    { label: "Top action",     value: stats.topCount,    hint: stats.topAction,                icon: Tag,           color: "text-purple-400" },
  ];

  return (
    <AppLayout>
      <PageHeader title="Audit Log" description="Every security-relevant action in your organization." />

      {/* Stat cards */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5 mt-4">
        {statCards.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="rounded-lg border border-border/50 p-3 bg-gradient-to-br from-accent/5 to-transparent hover:border-accent/40 transition-all">
              <div className="flex items-center justify-between mb-2">
                <Icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</span>
              </div>
              <div className="text-2xl font-semibold truncate">{s.value}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{s.hint}</div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Filters */}
      <Card className="mt-4">
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="actor, action, target, meta…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Page size</Label>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[100, 250, 500, 1000, 2500, 5000].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dynamic filter chip rows */}
          <ChipRow label="Actor" all={facets.actors.map((a) => ({ id: a.id, label: a.label }))}
            selected={selActors} onToggle={(id) => setSelActors((s) => s.includes(id) ? s.filter(x => x !== id) : [...s, id])} />
          <ChipRow label="Action" all={facets.actions.map((a) => ({ id: a, label: a }))}
            selected={selActions} onToggle={(id) => setSelActions((s) => s.includes(id) ? s.filter(x => x !== id) : [...s, id])} />
          <ChipRow label="Entity" all={facets.kinds.map((a) => ({ id: a, label: a }))}
            selected={selKinds} onToggle={(id) => setSelKinds((s) => s.includes(id) ? s.filter(x => x !== id) : [...s, id])} />
          {facets.workspaces.length > 0 && (
            <ChipRow label="Workspace" all={facets.workspaces.map((w) => ({ id: w, label: w.slice(0, 8) }))}
              selected={selWorkspaces} onToggle={(id) => setSelWorkspaces((s) => s.includes(id) ? s.filter(x => x !== id) : [...s, id])} />
          )}

          <div className="flex justify-between items-center pt-1">
            <div className="text-sm text-muted-foreground">
              {filtered.length} of {rows.length} events{activeFilterCount > 0 && ` · ${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active`}
            </div>
            <div className="flex gap-2">
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  <X className="h-4 w-4 mr-1" /> Clear
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => rowsQ.refetch()}>
                <RefreshCw className="h-4 w-4 mr-1" /> Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
                <Download className="h-4 w-4 mr-2" />Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="pt-6">
          {rowsQ.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Context</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const isSec = SECURITY_KEYWORDS.some((k) => r.action.toLowerCase().includes(k));
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(r.created_at), "PP p")}</TableCell>
                      <TableCell className="text-sm">
                        <div>{r.actor?.name || <span className="text-muted-foreground italic">system</span>}</div>
                        <div className="text-xs text-muted-foreground">{r.actor?.email || ""}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={isSec ? "destructive" : "outline"} className="font-mono text-xs">
                          {r.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.entity_kind ? <span>{r.entity_kind}{r.entity_id ? <span className="text-muted-foreground"> · {String(r.entity_id).slice(0, 8)}</span> : null}</span> : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[420px] truncate font-mono">
                        {r.meta && Object.keys(r.meta).length ? JSON.stringify(r.meta) : ""}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!filtered.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      <ShieldAlert className="h-6 w-6 mx-auto mb-2 opacity-40" />
                      No audit events match the filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}

function ChipRow({
  label, all, selected, onToggle,
}: { label: string; all: { id: string; label: string }[]; selected: string[]; onToggle: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  if (!all.length) return null;
  const visible = expanded ? all : all.slice(0, 10);
  return (
    <div className="flex items-start gap-2 flex-wrap">
      <div className="text-xs text-muted-foreground w-16 pt-1.5 shrink-0">{label}</div>
      <div className="flex flex-wrap gap-1.5 flex-1">
        {visible.map((o) => {
          const active = selected.includes(o.id);
          return (
            <button key={o.id} onClick={() => onToggle(o.id)}
              className={`text-[11px] px-2 py-1 rounded-md border transition-all
                ${active
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-border/50 text-muted-foreground hover:border-accent/40 hover:text-foreground"}`}>
              {o.label}
              {active && <X className="inline h-3 w-3 ml-1" />}
            </button>
          );
        })}
        {all.length > 10 && (
          <button onClick={() => setExpanded((v) => !v)}
            className="text-[11px] px-2 py-1 rounded-md border border-dashed border-border/50 text-muted-foreground hover:text-accent">
            {expanded ? "Show less" : `+${all.length - 10} more`}
            <ChevronDown className={`inline h-3 w-3 ml-1 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
    </div>
  );
}
