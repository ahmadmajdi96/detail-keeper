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
import { Download, Search, ShieldAlert, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Navigate } from "react-router-dom";

export default function AuditLogPage() {
  const { currentOrganization, currentOrgRole } = useOrganization();
  const canView = currentOrgRole === "owner" || currentOrgRole === "security_admin";

  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const rowsQ = useQuery({
    queryKey: ["audit-logs", currentOrganization?.id, from, to, action],
    enabled: !!currentOrganization?.id && canView,
    queryFn: async () => {
      let qb = supabase
        .from("audit_logs")
        .select("id,created_at,actor_id,action,entity_kind,entity_id,meta,workspace_id")
        .eq("org_id", currentOrganization!.id)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (from) qb = qb.gte("created_at", new Date(from).toISOString());
      if (to) qb = qb.lte("created_at", new Date(to).toISOString());
      if (action) qb = qb.ilike("action", `%${action}%`);
      const { data, error } = await qb;
      if (error) throw error;
      const ids = Array.from(new Set((data || []).map((r) => r.actor_id).filter(Boolean))) as string[];
      let profiles: any[] = [];
      if (ids.length) {
        const { data: p } = await supabase.from("profiles").select("id,name,email").in("id", ids);
        profiles = p || [];
      }
      return (data || []).map((r) => ({ ...r, actor: profiles.find((p) => p.id === r.actor_id) }));
    },
  });

  const filtered = useMemo(() => {
    const rows = rowsQ.data || [];
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter((r: any) =>
      (r.action || "").toLowerCase().includes(s) ||
      (r.entity_kind || "").toLowerCase().includes(s) ||
      (r.actor?.name || "").toLowerCase().includes(s) ||
      (r.actor?.email || "").toLowerCase().includes(s) ||
      JSON.stringify(r.meta || {}).toLowerCase().includes(s));
  }, [rowsQ.data, q]);

  function exportCsv() {
    const headers = ["when", "actor_name", "actor_email", "action", "entity_kind", "entity_id", "workspace_id", "meta"];
    const rows = filtered.map((r: any) => [
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
    const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${currentOrganization?.slug || "org"}-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (currentOrganization && !canView) return <Navigate to="/organization" replace />;

  return (
    <AppLayout>
      <PageHeader title="Audit Log" description="Every security-relevant action in your organization." />

      <Card className="mt-4">
        <CardContent className="pt-6 grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="actor, action, target…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Action contains</Label>
            <Input placeholder="e.g. invitation" value={action} onChange={(e) => setAction(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="md:col-span-5 flex justify-between">
            <div className="text-sm text-muted-foreground">{filtered.length} events</div>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="h-4 w-4 mr-2" />Export CSV
            </Button>
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
                {filtered.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(r.created_at), "PP p")}</TableCell>
                    <TableCell className="text-sm">
                      <div>{r.actor?.name || <span className="text-muted-foreground italic">system</span>}</div>
                      <div className="text-xs text-muted-foreground">{r.actor?.email || ""}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="font-mono text-xs">{r.action}</Badge></TableCell>
                    <TableCell className="text-xs">
                      {r.entity_kind ? <span>{r.entity_kind}{r.entity_id ? <span className="text-muted-foreground"> · {String(r.entity_id).slice(0, 8)}</span> : null}</span> : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[420px] truncate font-mono">
                      {r.meta && Object.keys(r.meta).length ? JSON.stringify(r.meta) : ""}
                    </TableCell>
                  </TableRow>
                ))}
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
