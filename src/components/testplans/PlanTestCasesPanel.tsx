import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronRight, Plus, Search, Trash2, Edit3, Sparkles, FolderTree, Layers,
  FolderPlus, FolderOpen, MoveRight, X, Loader2, Check,
} from "lucide-react";

export const UNASSIGNED = "__unassigned__";

const TYPE_ORDER = [
  "smoke", "regression", "integration", "e2e", "api", "ui",
  "performance", "security", "accessibility", "usability", "other",
];

const TYPE_STYLE: Record<string, string> = {
  smoke: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  regression: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10",
  integration: "text-violet-400 border-violet-400/30 bg-violet-400/10",
  e2e: "text-fuchsia-400 border-fuchsia-400/30 bg-fuchsia-400/10",
  api: "text-sky-400 border-sky-400/30 bg-sky-400/10",
  ui: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  performance: "text-orange-400 border-orange-400/30 bg-orange-400/10",
  security: "text-rose-400 border-rose-400/30 bg-rose-400/10",
  other: "text-muted-foreground border-border bg-muted/30",
};

/** Robust test-type resolution: DB column first, then coverage tags, then title. */
export function resolveTestType(tc: any): string {
  const direct = (tc?.test_type ?? "").toString().trim().toLowerCase();
  if (direct && direct !== "null") return normalize(direct);
  const tags: string[] = Array.isArray(tc?.coverage_tags) ? tc.coverage_tags : [];
  for (const raw of tags) {
    const t = normalize((raw || "").toString().toLowerCase());
    if (TYPE_ORDER.includes(t)) return t;
  }
  const title = (tc?.title || "").toLowerCase();
  const hit = TYPE_ORDER.find((t) => t !== "other" && title.includes(t));
  return hit ?? "other";
}

function normalize(t: string) {
  if (t === "end-to-end" || t === "end_to_end") return "e2e";
  if (t === "func" || t === "functional") return "regression";
  return t;
}

function typeRank(t: string) {
  const i = TYPE_ORDER.indexOf(t);
  return i === -1 ? TYPE_ORDER.length : i;
}

type Props = {
  testPlanId: string;
  projectId: string | null;
  rows: any[]; // [{ id (link id), test_case }]
  onCreate: () => void;
  onEdit: (tc: any) => void;
  onDelete: (p: { linkId: string; caseId: string; title: string }) => void;
};

export function PlanTestCasesPanel({ testPlanId, projectId, rows, onCreate, onEdit, onDelete }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [suiteFilter, setSuiteFilter] = useState("all");
  const [groupBy, setGroupBy] = useState<"type" | "suite">("type");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [newSuite, setNewSuite] = useState("");
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [deletingSuite, setDeletingSuite] = useState<{ id: string; name: string; count: number } | null>(null);

  const { data: suites = [] } = useQuery<Array<{ id: string; name: string; sort_order: number | null }>>({
    queryKey: ["plan-suites", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_suites")
        .select("id, name, sort_order")
        .eq("project_id", projectId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const suiteName = (id: string | null) =>
    (id && suites.find((s) => s.id === id)?.name) || "Unassigned";

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["plan-suites", projectId] });
    qc.invalidateQueries({ queryKey: ["test-plan-cases", testPlanId] });
    qc.invalidateQueries({ queryKey: ["tp-wb-cases", testPlanId] });
    qc.invalidateQueries({ queryKey: ["tp-wb-suites", projectId] });
  };

  const createSuite = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from("test_suites").insert({
        project_id: projectId,
        name: name.trim(),
        created_by: user?.id ?? null,
        sort_order: suites.length,
      } as any).select("id").single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Suite created"); setNewSuite(""); setCreating(false); invalidate(); },
    onError: (e: any) => toast.error(e.message || "Could not create suite"),
  });

  const renameSuite = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("test_suites").update({ name: name.trim() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Suite renamed"); setRenaming(null); invalidate(); },
    onError: (e: any) => toast.error(e.message || "Rename failed"),
  });

  const deleteSuite = useMutation({
    mutationFn: async (id: string) => {
      const { error: e1 } = await supabase.from("test_cases").update({ suite_id: null }).eq("suite_id", id);
      if (e1) throw e1;
      const { error } = await supabase.from("test_suites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Suite deleted — its cases moved to Unassigned"); setDeletingSuite(null); invalidate(); },
    onError: (e: any) => toast.error(e.message || "Delete failed"),
  });

  const assign = useMutation({
    mutationFn: async ({ caseIds, suiteId }: { caseIds: string[]; suiteId: string | null }) => {
      const { error } = await supabase.from("test_cases").update({ suite_id: suiteId }).in("id", caseIds);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.suiteId ? `Moved to ${suiteName(v.suiteId)}` : "Removed from suite");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message || "Move failed"),
  });

  const items = useMemo(() => rows
    .map((row: any) => ({ link: row, tc: row.test_case }))
    .filter((r) => r.tc)
    .map((r) => ({ ...r, type: resolveTestType(r.tc) })), [rows]);

  const availableTypes = useMemo(
    () => [...new Set(items.map((i) => i.type))].sort((a, b) => typeRank(a) - typeRank(b)),
    [items],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter(({ tc, type }) => {
      if (typeFilter !== "all" && type !== typeFilter) return false;
      if (priorityFilter !== "all" && String(tc.priority) !== priorityFilter) return false;
      if (suiteFilter !== "all") {
        const sid = tc.suite_id ?? UNASSIGNED;
        if (sid !== suiteFilter) return false;
      }
      if (needle) {
        const hay = `${tc.title} ${tc.description ?? ""} ${(tc.coverage_tags ?? []).join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [items, q, typeFilter, priorityFilter, suiteFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, { id: string; label: string; type?: string; entries: typeof filtered }>();
    if (groupBy === "type") {
      for (const it of filtered) {
        if (!map.has(it.type)) map.set(it.type, { id: it.type, label: it.type, type: it.type, entries: [] });
        map.get(it.type)!.entries.push(it);
      }
      return [...map.values()].sort((a, b) => typeRank(a.id) - typeRank(b.id));
    }
    for (const s of suites) map.set(s.id, { id: s.id, label: s.name, entries: [] });
    map.set(UNASSIGNED, { id: UNASSIGNED, label: "Unassigned", entries: [] });
    for (const it of filtered) {
      const key = it.tc.suite_id && map.has(it.tc.suite_id) ? it.tc.suite_id : UNASSIGNED;
      map.get(key)!.entries.push(it);
    }
    return [...map.values()];
  }, [filtered, groupBy, suites]);

  const isOpen = (id: string) => openGroups[id] ?? true;
  const toggle = (id: string) => setOpenGroups((p) => ({ ...p, [id]: !isOpen(id) }));
  const anyFilter = q || typeFilter !== "all" || priorityFilter !== "all" || suiteFilter !== "all";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-4 border-b border-border/50 bg-gradient-to-br from-muted/40 to-transparent">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4 text-accent" /> Test Cases
            </CardTitle>
            <CardDescription>
              {filtered.length}
              {filtered.length !== items.length ? ` of ${items.length}` : ""} case
              {items.length === 1 ? "" : "s"} · {availableTypes.length} type
              {availableTypes.length === 1 ? "" : "s"} · {suites.length} suite{suites.length === 1 ? "" : "s"}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-border/60 bg-background/60 p-0.5">
              {(["type", "suite"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGroupBy(g)}
                  className={`relative rounded px-2.5 py-1 text-xs capitalize transition-colors ${
                    groupBy === g ? "text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {groupBy === g && (
                    <motion.span layoutId="tc-groupby" className="absolute inset-0 rounded bg-accent"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }} />
                  )}
                  <span className="relative inline-flex items-center gap-1">
                    {g === "type" ? <Layers className="h-3 w-3" /> : <FolderTree className="h-3 w-3" />}
                    by {g}
                  </span>
                </button>
              ))}
            </div>
            {creating ? (
              <div className="flex items-center gap-1">
                <Input
                  autoFocus value={newSuite} onChange={(e) => setNewSuite(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newSuite.trim()) createSuite.mutate(newSuite);
                    if (e.key === "Escape") { setCreating(false); setNewSuite(""); }
                  }}
                  placeholder="Suite name" className="h-8 w-44 text-xs"
                />
                <Button size="icon" className="h-8 w-8" disabled={!newSuite.trim() || createSuite.isPending}
                  onClick={() => createSuite.mutate(newSuite)}>
                  {createSuite.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setCreating(false); setNewSuite(""); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setCreating(true)} disabled={!projectId}>
                <FolderPlus className="mr-1.5 h-4 w-4" /> New Suite
              </Button>
            )}
            <Button size="sm" onClick={onCreate}>
              <Plus className="mr-1.5 h-4 w-4" /> New Test Case
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, description or tag…"
              className="h-9 pl-8 text-xs" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue placeholder="Test type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All test types</SelectItem>
              {availableTypes.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="1">P1 — High</SelectItem>
              <SelectItem value="2">P2 — Medium</SelectItem>
              <SelectItem value="3">P3 — Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={suiteFilter} onValueChange={setSuiteFilter}>
            <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue placeholder="Suite" /></SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">All suites</SelectItem>
              {suites.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
            </SelectContent>
          </Select>
          {anyFilter && (
            <Button size="sm" variant="ghost" className="h-9 text-xs"
              onClick={() => { setQ(""); setTypeFilter("all"); setPriorityFilter("all"); setSuiteFilter("all"); }}>
              Clear filters
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {items.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Layers className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p className="mb-3 text-sm">No test cases yet. Generate with AI or add manually.</p>
            <Button variant="outline" size="sm" onClick={onCreate}>
              <Plus className="mr-1.5 h-4 w-4" /> Add first case
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No test cases match the current filters.</p>
        ) : (
          <div className="space-y-2">
            {groups.map((g) => {
              const open = isOpen(g.id);
              const isSuiteGroup = groupBy === "suite";
              const isUnassigned = g.id === UNASSIGNED;
              return (
                <Collapsible key={g.id} open={open} onOpenChange={() => toggle(g.id)}
                  className="rounded-lg border border-border/60 bg-card/40 transition-colors hover:border-accent/30">
                  <div className="flex items-center gap-2 px-3 py-2">
                    <CollapsibleTrigger className="flex flex-1 items-center gap-2 text-left">
                      <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
                      {isSuiteGroup
                        ? <FolderOpen className={`h-4 w-4 ${isUnassigned ? "text-muted-foreground" : "text-cyan-400"}`} />
                        : <span className={`h-2 w-2 rounded-full ${TYPE_STYLE[g.id]?.split(" ")[0]?.replace("text-", "bg-") ?? "bg-accent"}`} />}
                      {renaming?.id === g.id ? (
                        <Input
                          autoFocus value={renaming.name} onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setRenaming({ id: g.id, name: e.target.value })}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === "Enter" && renaming.name.trim()) renameSuite.mutate(renaming);
                            if (e.key === "Escape") setRenaming(null);
                          }}
                          className="h-7 w-56 text-xs"
                        />
                      ) : (
                        <span className={`text-xs font-semibold uppercase tracking-wider ${isSuiteGroup ? "" : "capitalize"}`}>
                          {g.label}
                        </span>
                      )}
                      <Badge variant="outline" className={`text-[10px] ${!isSuiteGroup ? TYPE_STYLE[g.id] ?? "" : ""}`}>
                        {g.entries.length}
                      </Badge>
                      <div className="ml-1 h-px flex-1 bg-border/60" />
                    </CollapsibleTrigger>
                    {isSuiteGroup && !isUnassigned && (
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => setRenaming({ id: g.id, name: g.label })} aria-label="Rename suite">
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeletingSuite({ id: g.id, name: g.label, count: g.entries.length })}
                          aria-label="Delete suite">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                    <div className="space-y-1.5 border-t border-border/40 p-2">
                      <AnimatePresence initial={false}>
                        {g.entries.length === 0 && (
                          <p className="px-2 py-3 text-xs text-muted-foreground">
                            Empty suite — move cases here from the ••• menu on any test case.
                          </p>
                        )}
                        {g.entries.map(({ link, tc, type }) => (
                          <motion.div
                            key={link.id}
                            layout
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.15 }}
                            className="group flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-card p-3 transition-all hover:border-accent/40 hover:shadow-[0_0_0_1px_hsl(var(--accent)/0.15)]"
                          >
                            <Link to={`/test-cases/${tc.id}/edit?planId=${testPlanId}`} className="min-w-0 flex-1">
                              <div className="mb-1 flex items-center gap-2">
                                <p className="truncate text-sm font-medium">{tc.title}</p>
                                {tc.ai_generated && <Sparkles className="h-3 w-3 shrink-0 text-accent" />}
                              </div>
                              {tc.description && (
                                <p className="line-clamp-2 text-xs text-muted-foreground">{tc.description}</p>
                              )}
                              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                <Badge variant="outline" className={`text-[10px] capitalize ${TYPE_STYLE[type] ?? ""}`}>{type}</Badge>
                                {groupBy === "type" && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    <FolderOpen className="mr-1 h-2.5 w-2.5" />{suiteName(tc.suite_id ?? null)}
                                  </Badge>
                                )}
                                {(tc.coverage_tags ?? []).slice(0, 4).map((t: string, i: number) => (
                                  <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>
                                ))}
                              </div>
                            </Link>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <Badge variant="outline" className="text-xs">P{tc.priority}</Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                                    aria-label="Move to suite">
                                    <MoveRight className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                                  <DropdownMenuLabel className="text-xs">Move to suite</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {suites.map((s) => (
                                    <DropdownMenuItem key={s.id} disabled={tc.suite_id === s.id}
                                      onClick={() => assign.mutate({ caseIds: [tc.id], suiteId: s.id })}>
                                      <FolderOpen className="mr-2 h-3.5 w-3.5 text-cyan-400" />{s.name}
                                    </DropdownMenuItem>
                                  ))}
                                  {suites.length === 0 && (
                                    <DropdownMenuItem disabled>No suites yet</DropdownMenuItem>
                                  )}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem disabled={!tc.suite_id}
                                    onClick={() => assign.mutate({ caseIds: [tc.id], suiteId: null })}>
                                    <X className="mr-2 h-3.5 w-3.5" /> Remove from suite
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                                onClick={() => onEdit(tc)} aria-label="Edit">
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost"
                                className="h-7 w-7 text-destructive opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                                onClick={() => onDelete({ linkId: link.id, caseId: tc.id, title: tc.title })} aria-label="Delete">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deletingSuite} onOpenChange={(o) => !o && setDeletingSuite(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete suite “{deletingSuite?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingSuite?.count
                ? `${deletingSuite.count} test case${deletingSuite.count === 1 ? "" : "s"} will move to Unassigned.`
                : "This suite is empty."} The test cases themselves are not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingSuite && deleteSuite.mutate(deletingSuite.id)}>
              Delete suite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
