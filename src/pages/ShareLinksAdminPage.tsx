import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Link2,
  Copy,
  Ban,
  Loader2,
  Search,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

type Status = "active" | "revoked" | "expired" | "rate_limited";

const RATE_LIMIT = 60; // per minute per token — must mirror resolve_share_link

function statusOf(row: any, recentViewCount: number): Status {
  if (row.revoked_at) return "revoked";
  if (row.expires_at && new Date(row.expires_at) < new Date()) return "expired";
  if (recentViewCount >= RATE_LIMIT) return "rate_limited";
  return "active";
}

const STATUS_META: Record<Status, { label: string; icon: any; className: string }> = {
  active: { label: "Active", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" },
  revoked: { label: "Revoked", icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/30" },
  expired: { label: "Expired", icon: Clock, className: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  rate_limited: { label: "Rate-limited", icon: Zap, className: "bg-orange-500/10 text-orange-500 border-orange-500/30" },
};

export default function ShareLinksAdminPage() {
  const { currentOrganization, currentOrgRole } = useOrganization();
  const canManage = currentOrgRole === "owner" || currentOrgRole === "security_admin";
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");

  const linksQ = useQuery({
    queryKey: ["share-links-admin", currentOrganization?.id],
    enabled: !!currentOrganization?.id && canManage,
    queryFn: async () => {
      const { data: workspaces } = await supabase
        .from("workspaces")
        .select("id,name")
        .eq("organization_id", currentOrganization!.id);
      const wsIds = (workspaces || []).map((w) => w.id);
      if (!wsIds.length) return [];

      const { data: links, error } = await supabase
        .from("share_links")
        .select("*")
        .in("workspace_id", wsIds)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const linkIds = (links || []).map((l: any) => l.id);
      let recentByLink: Record<string, number> = {};
      if (linkIds.length) {
        const sinceIso = new Date(Date.now() - 60_000).toISOString();
        const { data: views } = await supabase
          .from("share_link_views")
          .select("share_link_id")
          .in("share_link_id", linkIds)
          .gte("created_at", sinceIso);
        for (const v of views || []) {
          if (!v.share_link_id) continue;
          recentByLink[v.share_link_id] = (recentByLink[v.share_link_id] || 0) + 1;
        }
      }

      const creatorIds = Array.from(new Set((links || []).map((l: any) => l.created_by).filter(Boolean)));
      let profiles: any[] = [];
      if (creatorIds.length) {
        const { data: p } = await supabase.from("profiles").select("id,name,email").in("id", creatorIds);
        profiles = p || [];
      }

      const wsById: Record<string, string> = {};
      for (const w of workspaces || []) wsById[w.id] = w.name;

      return (links || []).map((l: any) => ({
        ...l,
        workspace_name: l.workspace_id ? wsById[l.workspace_id] : null,
        recent_views: recentByLink[l.id] || 0,
        creator: profiles.find((p) => p.id === l.created_by),
      }));
    },
  });

  const revokeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("share_links")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Share link revoked");
      qc.invalidateQueries({ queryKey: ["share-links-admin"] });
    },
    onError: (e: any) => toast.error(e.message || "Could not revoke"),
  });

  const rows = useMemo(() => {
    const list = (linksQ.data || []).map((l: any) => ({ ...l, status: statusOf(l, l.recent_views) as Status }));
    return list.filter((l: any) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (q.trim()) {
        const s = q.toLowerCase();
        return (
          l.resource_type.toLowerCase().includes(s) ||
          l.resource_id.toLowerCase().includes(s) ||
          l.token.toLowerCase().includes(s) ||
          (l.workspace_name || "").toLowerCase().includes(s) ||
          (l.creator?.name || "").toLowerCase().includes(s) ||
          (l.creator?.email || "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [linksQ.data, statusFilter, q]);

  const summary = useMemo(() => {
    const c = { active: 0, revoked: 0, expired: 0, rate_limited: 0 };
    for (const r of linksQ.data || []) {
      const s = statusOf(r, r.recent_views) as Status;
      c[s] += 1;
    }
    return c;
  }, [linksQ.data]);

  const copyUrl = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/share/${token}`);
    toast.success("Copied share URL");
  };

  if (currentOrganization && !canManage) return <Navigate to="/organization" replace />;

  return (
    <AppLayout>
      <PageHeader
        title="Share Links"
        description="Every public share link across your organization. Revoke abuse instantly."
      />

      <div className="grid gap-3 md:grid-cols-4 mt-4">
        {(Object.keys(STATUS_META) as Status[]).map((s) => {
          const Icon = STATUS_META[s].icon;
          return (
            <Card key={s} className="border-border/50">
              <CardContent className="pt-5 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-md border flex items-center justify-center ${STATUS_META[s].className}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-2xl font-semibold tabular-nums">{summary[s]}</div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{STATUS_META[s].label}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4">
        <CardContent className="pt-6 grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="token, resource, workspace, creator…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="rate_limited">Rate-limited</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-4 text-sm text-muted-foreground">{rows.length} of {linksQ.data?.length ?? 0} links</div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="pt-6">
          {linksQ.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Resource</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-[110px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any) => {
                  const meta = STATUS_META[r.status as Status];
                  const Icon = meta.icon;
                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                          <div>
                            <div className="text-sm font-medium capitalize">{r.resource_type.replace(/_/g, " ")}</div>
                            <div className="text-[11px] text-muted-foreground font-mono">{String(r.resource_id).slice(0, 8)}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{r.workspace_name || <span className="text-muted-foreground italic">org-wide</span>}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${meta.className} gap-1`}>
                          <Icon className="h-3 w-3" />
                          {meta.label}
                          {r.status === "rate_limited" && (
                            <span className="ml-1 text-[10px] opacity-80">{r.recent_views}/min</span>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">{r.view_count ?? 0}</TableCell>
                      <TableCell className="text-xs">
                        <div>{r.creator?.name || <span className="text-muted-foreground italic">unknown</span>}</div>
                        <div className="text-muted-foreground">{r.creator?.email}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.expires_at ? format(new Date(r.expires_at), "PP") : <span className="italic">never</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => copyUrl(r.token)} title="Copy URL">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          {!r.revoked_at && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                if (confirm("Revoke this share link? Anyone using it will lose access immediately.")) {
                                  revokeMut.mutate(r.id);
                                }
                              }}
                              disabled={revokeMut.isPending}
                              title="Revoke"
                              className="text-destructive hover:text-destructive"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                      <ShieldAlert className="h-6 w-6 mx-auto mb-2 opacity-40" />
                      No share links match the filters.
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
