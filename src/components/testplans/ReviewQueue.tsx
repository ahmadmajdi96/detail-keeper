import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Check, X, RefreshCw, Loader2, FileText, FolderTree, FlaskConical, FileCode2, ChevronDown,
} from "lucide-react";

export type ReviewKind = "doc" | "suite" | "case" | "spec";

type Item = {
  id: string;
  kind: ReviewKind;
  label: string;
  sublabel?: string;
  state: "pending" | "accepted" | "rejected";
  note: string | null;
};

const TABLE: Record<ReviewKind, string> = {
  doc: "test_plan_documents_v2",
  suite: "test_suites",
  case: "test_cases",
  spec: "test_plan_specs",
};

const STEPS: { kind: ReviewKind; title: string; icon: JSX.Element; hint: string }[] = [
  { kind: "doc", title: "1 · QA documents", icon: <FileText className="h-4 w-4 text-violet-400" />, hint: "Markdown documentation generated from your sources" },
  { kind: "suite", title: "2 · Test suites", icon: <FolderTree className="h-4 w-4 text-cyan-400" />, hint: "Feature groupings proposed by the AI" },
  { kind: "case", title: "3 · Test cases", icon: <FlaskConical className="h-4 w-4 text-emerald-400" />, hint: "Generated cases with priority scoring" },
  { kind: "spec", title: "4 · Playwright code", icon: <FileCode2 className="h-4 w-4 text-amber-400" />, hint: "Generated spec files" },
];

interface Props {
  testPlanId: string;
  projectId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Re-runs a generation step (docs / cases / code). */
  onRegenerate?: (kind: ReviewKind) => void;
  regenerating?: boolean;
}

/**
 * Ordered review queue over every generated artifact, with per-item
 * accept / reject and per-step regenerate controls.
 */
export function ReviewQueue({ testPlanId, projectId, open, onOpenChange, onRegenerate, regenerating }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [expanded, setExpanded] = useState<ReviewKind | null>("doc");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["review-queue", testPlanId],
    enabled: open,
    queryFn: async () => {
      const out: Item[] = [];

      const { data: docs } = await supabase
        .from("test_plan_documents_v2" as any)
        .select("id, slug, title, review_state, review_note, sort_order")
        .eq("test_plan_id", testPlanId).order("sort_order");
      for (const d of (docs ?? []) as any[]) {
        out.push({ id: d.id, kind: "doc", label: d.title || d.slug, sublabel: `${d.slug}.md`, state: d.review_state ?? "pending", note: d.review_note });
      }

      const { data: caseRows } = await supabase
        .from("test_plan_test_cases")
        .select("test_case:test_cases!test_plan_test_cases_test_case_id_fkey(id, title, test_type, priority, suite_id, review_state, review_note)")
        .eq("test_plan_id", testPlanId);
      const cases = ((caseRows ?? []) as any[]).map((r) => r.test_case).filter(Boolean);
      const suiteIds = Array.from(new Set(cases.map((c: any) => c.suite_id).filter(Boolean)));
      if (suiteIds.length) {
        const { data: suites } = await supabase
          .from("test_suites")
          .select("id, name, review_state, review_note")
          .in("id", suiteIds as string[]);
        for (const s of (suites ?? []) as any[]) {
          const n = cases.filter((c: any) => c.suite_id === s.id).length;
          out.push({ id: s.id, kind: "suite", label: s.name, sublabel: `${n} case${n === 1 ? "" : "s"}`, state: s.review_state ?? "pending", note: s.review_note });
        }
      }
      for (const c of cases as any[]) {
        out.push({ id: c.id, kind: "case", label: c.title, sublabel: `${c.test_type ?? "regression"} · P${c.priority ?? "-"}`, state: c.review_state ?? "pending", note: c.review_note });
      }

      const { data: specs } = await supabase
        .from("test_plan_specs" as any)
        .select("id, filename, review_state, review_note")
        .eq("test_plan_id", testPlanId).order("filename");
      for (const s of (specs ?? []) as any[]) {
        out.push({ id: s.id, kind: "spec", label: s.filename, state: s.review_state ?? "pending", note: s.review_note });
      }

      return out;
    },
  });

  const setState = useMutation({
    mutationFn: async ({ item, state, reviewNote }: { item: Item; state: "accepted" | "rejected" | "pending"; reviewNote?: string }) => {
      const { error } = await supabase
        .from(TABLE[item.kind] as any)
        .update({
          review_state: state,
          reviewed_by: state === "pending" ? null : user?.id ?? null,
          reviewed_at: state === "pending" ? null : new Date().toISOString(),
          review_note: reviewNote ?? item.note ?? null,
        })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["review-queue", testPlanId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const bulk = useMutation({
    mutationFn: async ({ kind, state }: { kind: ReviewKind; state: "accepted" | "rejected" }) => {
      const ids = items.filter((i) => i.kind === kind).map((i) => i.id);
      if (!ids.length) return 0;
      const { error } = await supabase
        .from(TABLE[kind] as any)
        .update({ review_state: state, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["review-queue", testPlanId] });
      toast.success(`${n} artifact${n === 1 ? "" : "s"} updated`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const byKind = useMemo(() => {
    const m = new Map<ReviewKind, Item[]>();
    STEPS.forEach((s) => m.set(s.kind, []));
    items.forEach((i) => m.get(i.kind)?.push(i));
    return m;
  }, [items]);

  const reviewed = items.filter((i) => i.state !== "pending").length;
  const pct = items.length ? Math.round((reviewed / items.length) * 100) : 0;

  const regenKind = (k: ReviewKind) => (k === "suite" ? "case" : k);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Review queue</DialogTitle>
          <DialogDescription>
            Walk the generated artifacts in order and accept, reject or regenerate each step before export.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-3">
          <Progress value={pct} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground">{reviewed}/{items.length} reviewed</span>
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <ScrollArea className="h-[56vh] pr-2">
            <div className="space-y-2">
              {STEPS.map((step) => {
                const list = byKind.get(step.kind) ?? [];
                const isOpen = expanded === step.kind;
                const accepted = list.filter((i) => i.state === "accepted").length;
                const rejected = list.filter((i) => i.state === "rejected").length;
                return (
                  <div key={step.kind} className="rounded-lg border border-border/50 bg-card/50">
                    <button
                      onClick={() => setExpanded(isOpen ? null : step.kind)}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                    >
                      <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                      {step.icon}
                      <span className="text-sm font-medium">{step.title}</span>
                      <Badge variant="outline" className="text-[10px]">{list.length}</Badge>
                      {accepted > 0 && <Badge className="bg-success/15 text-success border-success/20 text-[10px]">{accepted} accepted</Badge>}
                      {rejected > 0 && <Badge className="bg-destructive/15 text-destructive border-destructive/20 text-[10px]">{rejected} rejected</Badge>}
                      <span className="ml-auto text-[11px] text-muted-foreground">{step.hint}</span>
                    </button>

                    {isOpen && (
                      <div className="border-t border-border/50">
                        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
                          <Button size="sm" variant="outline" disabled={!list.length || bulk.isPending}
                            onClick={() => bulk.mutate({ kind: step.kind, state: "accepted" })}>
                            <Check className="mr-1.5 h-3.5 w-3.5" /> Accept all
                          </Button>
                          <Button size="sm" variant="ghost" disabled={!list.length || bulk.isPending}
                            onClick={() => bulk.mutate({ kind: step.kind, state: "rejected" })}>
                            <X className="mr-1.5 h-3.5 w-3.5" /> Reject all
                          </Button>
                          {onRegenerate && step.kind !== "suite" && (
                            <Button size="sm" variant="outline" className="ml-auto" disabled={regenerating}
                              onClick={() => onRegenerate(regenKind(step.kind))}>
                              {regenerating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                              Regenerate
                            </Button>
                          )}
                        </div>

                        <ul className="divide-y divide-border/40">
                          {list.length === 0 && (
                            <li className="px-4 py-6 text-center text-xs text-muted-foreground">Nothing generated for this step yet.</li>
                          )}
                          {list.map((item) => (
                            <li key={item.id} className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="flex-1 truncate text-sm">{item.label}</span>
                                {item.sublabel && <span className="text-[10px] text-muted-foreground">{item.sublabel}</span>}
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${item.state === "accepted" ? "bg-success/15 text-success border-success/20"
                                    : item.state === "rejected" ? "bg-destructive/15 text-destructive border-destructive/20" : ""}`}
                                >
                                  {item.state}
                                </Badge>
                                <Button size="icon" variant="ghost" className="h-7 w-7"
                                  title="Accept"
                                  onClick={() => setState.mutate({ item, state: item.state === "accepted" ? "pending" : "accepted" })}>
                                  <Check className={`h-3.5 w-3.5 ${item.state === "accepted" ? "text-success" : ""}`} />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7"
                                  title="Reject with a note"
                                  onClick={() => { setNoteFor(noteFor === item.id ? null : item.id); setNote(item.note ?? ""); }}>
                                  <X className={`h-3.5 w-3.5 ${item.state === "rejected" ? "text-destructive" : ""}`} />
                                </Button>
                              </div>
                              {item.note && noteFor !== item.id && (
                                <p className="pl-1 pt-1 text-[11px] text-muted-foreground">Note: {item.note}</p>
                              )}
                              {noteFor === item.id && (
                                <div className="space-y-1.5 pt-2">
                                  <Textarea value={note} onChange={(e) => setNote(e.target.value)}
                                    placeholder="Why is this rejected? (optional)" className="min-h-[60px] text-xs" />
                                  <div className="flex gap-1.5">
                                    <Button size="sm" variant="destructive"
                                      onClick={() => { setState.mutate({ item, state: "rejected", reviewNote: note }); setNoteFor(null); }}>
                                      Reject
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => setNoteFor(null)}>Cancel</Button>
                                  </div>
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
