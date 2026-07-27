import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  ChevronRight,
  FolderPlus,
  Folder,
  FolderOpen,
  Inbox,
  Loader2,
  MoreHorizontal,
  Play,
  Plus,
  Edit,
  Trash2,
  TestTube,
  Sparkles,
  ArrowRightLeft,
  GripVertical,
  Wand2,
  SlidersHorizontal,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { logSuiteAudit } from "@/lib/suiteAudit";
import { SuiteGroupingPanel } from "./SuiteGroupingPanel";
import { BulkEditCasesDialog } from "./BulkEditCasesDialog";

export interface SuiteRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  sort_order: number | null;
}

/** Generic sortable row wrapper — exposes a dedicated drag handle. */
function Sortable({
  id, disabled, children,
}: { id: string; disabled?: boolean; children: (handle: React.HTMLAttributes<HTMLElement>) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 30 : undefined }}
      className={isDragging ? "opacity-80" : undefined}
    >
      {children({ ...attributes, ...listeners } as any)}
    </div>
  );
}

interface CaseRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  ai_generated: boolean;
  suite_id: string | null;
  suite_order: number | null;
  created_at: string;
}

interface Props {
  projectId: string | null;
  workspaceId: string | null;
  testCases: any[];
  searchQuery: string;
  isLoading?: boolean;
}

const UNASSIGNED = "__unassigned__";

export function TestSuitesPanel({ projectId, workspaceId, testCases, searchQuery, isLoading }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [sortBy, setSortBy] = useState<"manual" | "name" | "priority" | "created">("manual");
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({ [UNASSIGNED]: true });
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const [suiteDialog, setSuiteDialog] = useState<{ mode: "create" | "edit"; suite?: SuiteRow } | null>(null);
  const [suiteName, setSuiteName] = useState("");
  const [suiteDesc, setSuiteDesc] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<SuiteRow | null>(null);
  const [reassignTo, setReassignTo] = useState<string>(UNASSIGNED);

  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [suiteOrder, setSuiteOrder] = useState<string[] | null>(null);
  const [caseOrder, setCaseOrder] = useState<Record<string, string[]>>({});

  const [caseDialogSuite, setCaseDialogSuite] = useState<string | null>(null);
  const [caseTitle, setCaseTitle] = useState("");
  const [caseDesc, setCaseDesc] = useState("");
  const [casePriority, setCasePriority] = useState("2");

  const { data: suites = [] } = useQuery<SuiteRow[]>({
    queryKey: ["test-suites", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("test_suites")
        .select("id, project_id, name, description, sort_order")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name");
      if (error) throw error;
      return (data ?? []) as SuiteRow[];
    },
    enabled: !!projectId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["test-suites", projectId] });
    qc.invalidateQueries({ queryKey: ["test-cases"] });
  };

  const saveSuite = useMutation({
    mutationFn: async () => {
      if (!suiteName.trim()) throw new Error("Name is required");
      if (suiteDialog?.mode === "edit" && suiteDialog.suite) {
        const { error } = await supabase
          .from("test_suites")
          .update({ name: suiteName.trim(), description: suiteDesc || null })
          .eq("id", suiteDialog.suite.id);
        if (error) throw error;
        await logSuiteAudit({
          workspaceId, action: "suite.updated", entityId: suiteDialog.suite.id,
          meta: { from: { name: suiteDialog.suite.name, description: suiteDialog.suite.description },
                  to: { name: suiteName.trim(), description: suiteDesc || null } },
        });
      } else {
        if (!projectId) throw new Error("Select a project first");
        const { data, error } = await supabase.from("test_suites").insert({
          project_id: projectId,
          name: suiteName.trim(),
          description: suiteDesc || null,
          created_by: user?.id ?? null,
          sort_order: suites.length,
        } as any).select("id").single();
        if (error) throw error;
        await logSuiteAudit({
          workspaceId, action: "suite.created", entityId: (data as any)?.id ?? null,
          meta: { name: suiteName.trim(), project_id: projectId },
        });
      }
    },
    onSuccess: () => {
      toast.success(suiteDialog?.mode === "edit" ? "Suite updated" : "Suite created");
      setSuiteDialog(null);
      setSuiteName("");
      setSuiteDesc("");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteSuite = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      // Test cases are preserved: move them first, then remove the suite.
      const { error: mErr } = await supabase
        .from("test_cases")
        .update({ suite_id: reassignTo === UNASSIGNED ? null : reassignTo } as any)
        .eq("suite_id", deleteTarget.id);
      if (mErr) throw mErr;
      const { error } = await supabase.from("test_suites").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      await logSuiteAudit({
        workspaceId, action: "suite.deleted", entityId: deleteTarget.id,
        meta: { name: deleteTarget.name, cases_moved_to: reassignTo === UNASSIGNED ? "unassigned" : reassignTo },
      });
    },
    onSuccess: () => {
      toast.success("Suite deleted — its test cases were preserved");
      setDeleteTarget(null);
      setReassignTo(UNASSIGNED);
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const moveCases = useMutation({
    mutationFn: async ({ ids, suiteId }: { ids: string[]; suiteId: string | null }) => {
      const { error } = await supabase
        .from("test_cases")
        .update({ suite_id: suiteId } as any)
        .in("id", ids);
      if (error) throw error;
      await logSuiteAudit({
        workspaceId, action: "suite.case_moved", entityKind: "test_case", entityId: ids[0] ?? null,
        meta: { case_ids: ids, count: ids.length, to_suite: suiteId ?? "unassigned" },
      });
    },
    onSuccess: (_d, v) => {
      toast.success(`Moved ${v.ids.length} test case${v.ids.length === 1 ? "" : "s"}`);
      setSelected({});
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createCase = useMutation({
    mutationFn: async () => {
      if (!caseTitle.trim()) throw new Error("Title is required");
      const { error } = await supabase.from("test_cases").insert({
        title: caseTitle.trim(),
        description: caseDesc || null,
        priority: Number(casePriority),
        status: "draft",
        project_id: projectId,
        workspace_id: workspaceId,
        created_by: user?.id ?? null,
        suite_id: caseDialogSuite === UNASSIGNED ? null : caseDialogSuite,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Test case created");
      setCaseDialogSuite(null);
      setCaseTitle("");
      setCaseDesc("");
      setCasePriority("2");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const execute = useMutation({
    mutationFn: async ({ cases, suiteId }: { cases: CaseRow[]; suiteId: string | null }) => {
      if (!cases.length) throw new Error("No test cases to execute");
      const rows = cases.map((c) => ({
        test_case_id: c.id,
        suite_id: suiteId ?? c.suite_id ?? null,
        project_id: projectId,
        workspace_id: workspaceId,
        executor_id: user?.id ?? null,
        status: "pending" as const,
      }));
      const { error } = await supabase.from("test_executions").insert(rows as any);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      toast.success(`Queued ${count} execution${count === 1 ? "" : "s"}`, {
        action: { label: "Open", onClick: () => navigate("/executions") },
      });
      setSelected({});
      qc.invalidateQueries({ queryKey: ["test-executions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const orderedSuites = useMemo(() => {
    if (!suiteOrder) return suites;
    const map = new Map(suites.map((s) => [s.id, s]));
    const out = suiteOrder.map((id) => map.get(id)).filter(Boolean) as SuiteRow[];
    suites.forEach((s) => { if (!suiteOrder.includes(s.id)) out.push(s); });
    return out;
  }, [suites, suiteOrder]);

  const grouped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = (testCases as CaseRow[]).filter(
      (c) => !q || c.title.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q),
    );
    const sorter = (a: CaseRow, b: CaseRow) =>
      sortBy === "name"
        ? a.title.localeCompare(b.title)
        : sortBy === "priority"
          ? a.priority - b.priority
          : sortBy === "manual"
            ? (a.suite_order ?? 9999) - (b.suite_order ?? 9999) ||
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

    const applyLocal = (bucketId: string, rows: CaseRow[]) => {
      const local = caseOrder[bucketId];
      if (!local) return rows;
      const map = new Map(rows.map((r) => [r.id, r]));
      const out = local.map((id) => map.get(id)).filter(Boolean) as CaseRow[];
      rows.forEach((r) => { if (!local.includes(r.id)) out.push(r); });
      return out;
    };

    const buckets: { id: string; suite: SuiteRow | null; cases: CaseRow[] }[] = orderedSuites.map((s) => ({
      id: s.id,
      suite: s,
      cases: applyLocal(s.id, filtered.filter((c) => c.suite_id === s.id).sort(sorter)),
    }));
    buckets.push({
      id: UNASSIGNED,
      suite: null,
      cases: applyLocal(
        UNASSIGNED,
        filtered.filter((c) => !c.suite_id || !suites.some((s) => s.id === c.suite_id)).sort(sorter),
      ),
    });
    return buckets;
  }, [testCases, suites, orderedSuites, searchQuery, sortBy, caseOrder]);

  /** Drag-and-drop is only enabled in manual order with no active search. */
  const dragEnabled = sortBy === "manual" && !searchQuery.trim();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const persistSuiteOrder = async (ids: string[]) => {
    setSuiteOrder(ids);
    await Promise.all(
      ids.map((id, i) => supabase.from("test_suites").update({ sort_order: i } as any).eq("id", id)),
    );
    await logSuiteAudit({
      workspaceId, action: "suite.reordered", entityId: ids[0] ?? null,
      meta: { order: ids, project_id: projectId },
    });
    qc.invalidateQueries({ queryKey: ["test-suites", projectId] });
  };

  const persistCaseOrder = async (bucketId: string, ids: string[]) => {
    setCaseOrder((p) => ({ ...p, [bucketId]: ids }));
    await Promise.all(
      ids.map((id, i) => supabase.from("test_cases").update({ suite_order: i } as any).eq("id", id)),
    );
    await logSuiteAudit({
      workspaceId, action: "suite.cases_reordered", entityKind: "test_case", entityId: ids[0] ?? null,
      meta: { suite_id: bucketId === UNASSIGNED ? null : bucketId, order: ids },
    });
    qc.invalidateQueries({ queryKey: ["test-cases"] });
  };

  const onSuiteDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = orderedSuites.map((s) => s.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    persistSuiteOrder(next).catch((err) => toast.error(err.message));
  };

  const onCaseDragEnd = (bucketId: string, rows: CaseRow[]) => (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = rows.map((r) => r.id);
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    persistCaseOrder(bucketId, next).catch((err) => toast.error(err.message));
  };

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const caseById = useMemo(() => {
    const m = new Map<string, CaseRow>();
    (testCases as CaseRow[]).forEach((c) => m.set(c.id, c));
    return m;
  }, [testCases]);

  const toggleSuite = (id: string) => setOpenIds((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Folder className="h-4 w-4 text-accent" /> Test Suites
            <Badge variant="outline" className="text-xs">{suites.length}</Badge>
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created">Newest first</SelectItem>
              <SelectItem value="name">Sort by name</SelectItem>
              <SelectItem value="priority">Sort by priority</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            disabled={!projectId}
            onClick={() => {
              setSuiteName("");
              setSuiteDesc("");
              setSuiteDialog({ mode: "create" });
            }}
          >
            <FolderPlus className="mr-2 h-4 w-4" /> New Suite
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2"
          >
            <span className="text-sm font-medium">{selectedIds.length} selected</span>
            <Select
              onValueChange={(v) => moveCases.mutate({ ids: selectedIds, suiteId: v === UNASSIGNED ? null : v })}
            >
              <SelectTrigger className="h-8 w-[190px]">
                <SelectValue placeholder="Assign to suite…" />
              </SelectTrigger>
              <SelectContent>
                {suites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={() =>
                execute.mutate({
                  cases: selectedIds.map((id) => caseById.get(id)!).filter(Boolean),
                  suiteId: null,
                })
              }
              disabled={execute.isPending}
            >
              {execute.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-2 h-3.5 w-3.5" />}
              Execute selected
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected({})}>Clear</Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suites */}
      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {grouped.map((bucket) => {
            const open = !!openIds[bucket.id];
            const isUnassigned = bucket.id === UNASSIGNED;
            if (isUnassigned && bucket.cases.length === 0 && suites.length > 0) return null;
            return (
              <Card key={bucket.id} className="border-border/50 overflow-hidden">
                <Collapsible open={open} onOpenChange={() => toggleSuite(bucket.id)}>
                  <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/40 transition-colors">
                    <CollapsibleTrigger asChild>
                      <button className="flex flex-1 items-center gap-2 text-left">
                        <ChevronRight
                          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`}
                        />
                        {isUnassigned ? (
                          <Inbox className="h-4 w-4 text-muted-foreground" />
                        ) : open ? (
                          <FolderOpen className="h-4 w-4 text-accent" />
                        ) : (
                          <Folder className="h-4 w-4 text-accent" />
                        )}
                        <span className="font-medium">{isUnassigned ? "Unassigned" : bucket.suite!.name}</span>
                        <Badge variant="outline" className="text-xs">{bucket.cases.length}</Badge>
                        {!isUnassigned && bucket.suite?.description && (
                          <span className="hidden md:inline text-xs text-muted-foreground line-clamp-1">
                            {bucket.suite.description}
                          </span>
                        )}
                      </button>
                    </CollapsibleTrigger>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      disabled={bucket.cases.length === 0 || execute.isPending}
                      onClick={() => execute.mutate({ cases: bucket.cases, suiteId: isUnassigned ? null : bucket.id })}
                    >
                      <Play className="mr-1.5 h-3.5 w-3.5" /> Run suite
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Suite actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setCaseDialogSuite(bucket.id)}>
                          <Plus className="mr-2 h-4 w-4" /> New test case here
                        </DropdownMenuItem>
                        {!isUnassigned && (
                          <>
                            <DropdownMenuItem
                              onClick={() => {
                                setSuiteName(bucket.suite!.name);
                                setSuiteDesc(bucket.suite!.description ?? "");
                                setSuiteDialog({ mode: "edit", suite: bucket.suite! });
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" /> Edit suite
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setReassignTo(UNASSIGNED);
                                setDeleteTarget(bucket.suite!);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete suite
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <CollapsibleContent>
                    <CardContent className="p-0 border-t border-border/50">
                      {bucket.cases.length === 0 ? (
                        <div className="px-6 py-6 text-center text-sm text-muted-foreground">
                          No test cases in this suite.
                          <Button variant="link" size="sm" onClick={() => setCaseDialogSuite(bucket.id)}>
                            Add one
                          </Button>
                        </div>
                      ) : (
                        <ul className="divide-y divide-border/40">
                          {bucket.cases.map((c) => (
                            <li
                              key={c.id}
                              className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors"
                            >
                              <Checkbox
                                checked={!!selected[c.id]}
                                onCheckedChange={(v) => setSelected((p) => ({ ...p, [c.id]: !!v }))}
                              />
                              <button
                                className="flex flex-1 items-center gap-3 text-left min-w-0"
                                onClick={() => navigate(`/test-cases/${c.id}/edit`)}
                              >
                                <TestTube className="h-4 w-4 text-primary shrink-0" />
                                <span className="truncate text-sm font-medium">{c.title}</span>
                                {c.ai_generated && (
                                  <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20 text-[10px]">
                                    <Sparkles className="mr-1 h-3 w-3" /> AI
                                  </Badge>
                                )}
                              </button>
                              <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  c.priority <= 1
                                    ? "bg-destructive/10 text-destructive"
                                    : c.priority <= 2
                                      ? "bg-warning/10 text-warning"
                                      : "bg-muted text-muted-foreground"
                                }`}
                              >
                                P{c.priority}
                              </Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-7 w-7">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => navigate(`/test-cases/${c.id}/edit`)}>
                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => execute.mutate({ cases: [c], suiteId: c.suite_id })}>
                                    <Play className="mr-2 h-4 w-4" /> Execute
                                  </DropdownMenuItem>
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                      <ArrowRightLeft className="mr-2 h-4 w-4" /> Move to suite
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                      {suites
                                        .filter((s) => s.id !== c.suite_id)
                                        .map((s) => (
                                          <DropdownMenuItem
                                            key={s.id}
                                            onClick={() => moveCases.mutate({ ids: [c.id], suiteId: s.id })}
                                          >
                                            {s.name}
                                          </DropdownMenuItem>
                                        ))}
                                      {c.suite_id && (
                                        <DropdownMenuItem onClick={() => moveCases.mutate({ ids: [c.id], suiteId: null })}>
                                          Unassigned
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / edit suite */}
      <Dialog open={!!suiteDialog} onOpenChange={(o) => !o && setSuiteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{suiteDialog?.mode === "edit" ? "Edit Test Suite" : "New Test Suite"}</DialogTitle>
            <DialogDescription>Group related test cases by feature or functional area.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={suiteName} onChange={(e) => setSuiteName(e.target.value)} placeholder="e.g., Authentication" />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea value={suiteDesc} onChange={(e) => setSuiteDesc(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuiteDialog(null)}>Cancel</Button>
            <Button onClick={() => saveSuite.mutate()} disabled={saveSuite.isPending || !suiteName.trim()}>
              {saveSuite.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {suiteDialog?.mode === "edit" ? "Save" : "Create suite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete suite */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{deleteTarget?.name}”</DialogTitle>
            <DialogDescription>
              Test cases are never deleted. Choose where to move the cases currently in this suite.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Move test cases to</Label>
            <Select value={reassignTo} onValueChange={setReassignTo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {suites.filter((s) => s.id !== deleteTarget?.id).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteSuite.mutate()} disabled={deleteSuite.isPending}>
              {deleteSuite.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete suite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create case inside suite */}
      <Dialog open={!!caseDialogSuite} onOpenChange={(o) => !o && setCaseDialogSuite(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New test case</DialogTitle>
            <DialogDescription>
              In suite:{" "}
              {caseDialogSuite === UNASSIGNED
                ? "Unassigned"
                : suites.find((s) => s.id === caseDialogSuite)?.name ?? "—"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={caseTitle} onChange={(e) => setCaseTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={caseDesc} onChange={(e) => setCaseDesc(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={casePriority} onValueChange={setCasePriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">P1 — Critical</SelectItem>
                  <SelectItem value="2">P2 — Normal</SelectItem>
                  <SelectItem value="3">P3 — Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCaseDialogSuite(null)}>Cancel</Button>
            <Button onClick={() => createCase.mutate()} disabled={createCase.isPending || !caseTitle.trim()}>
              {createCase.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
