import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { logSuiteAudit } from "@/lib/suiteAudit";

const KEEP = "__keep__";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  caseIds: string[];
  workspaceId: string | null;
  onDone?: () => void;
}

/** Bulk edit of priority + shared metadata for the selected test cases. */
export function BulkEditCasesDialog({ open, onOpenChange, caseIds, workspaceId, onDone }: Props) {
  const qc = useQueryClient();
  const [priority, setPriority] = useState(KEEP);
  const [status, setStatus] = useState(KEEP);
  const [automation, setAutomation] = useState(KEEP);
  const [reviewStatus, setReviewStatus] = useState(KEEP);
  const [tags, setTags] = useState("");
  const [duration, setDuration] = useState("");
  const [step, setStep] = useState<"edit" | "preview">("edit");

  /** Current values, needed to render the before/after diff in the preview step. */
  const { data: current = [], isFetching: loadingCurrent } = useQuery({
    queryKey: ["bulk-edit-current", caseIds],
    enabled: open && caseIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_cases")
        .select("id, title, priority, status, automation_status, review_status, coverage_tags, estimated_duration_min")
        .in("id", caseIds);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const patch = useMemo(() => {
    const p: Record<string, unknown> = {};
    if (priority !== KEEP) p.priority = Number(priority);
    if (status !== KEEP) p.status = status;
    if (automation !== KEEP) p.automation_status = automation;
    if (reviewStatus !== KEEP) p.review_status = reviewStatus;
    if (duration.trim()) p.estimated_duration_min = Number(duration);
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (tagList.length) p.coverage_tags = tagList;
    return p;
  }, [priority, status, automation, reviewStatus, duration, tags]);

  const FIELD_LABEL: Record<string, string> = {
    priority: "Priority",
    status: "Status",
    automation_status: "Automation",
    review_status: "Review",
    estimated_duration_min: "Duration (min)",
    coverage_tags: "Coverage tags",
  };
  const fmt = (v: unknown) =>
    v === null || v === undefined || v === "" ? "—" : Array.isArray(v) ? v.join(", ") : String(v);

  const reset = () => {
    setPriority(KEEP); setStatus(KEEP); setAutomation(KEEP); setReviewStatus(KEEP);
    setTags(""); setDuration(""); setStep("edit");
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!Object.keys(patch).length) throw new Error("Nothing to change");

      const { error } = await supabase.from("test_cases").update(patch as any).in("id", caseIds);
      if (error) throw error;

      await logSuiteAudit({
        workspaceId,
        action: "suite.cases_bulk_updated",
        entityKind: "test_case",
        entityId: caseIds[0] ?? null,
        meta: {
          count: caseIds.length,
          changes: patch,
          case_ids: caseIds,
          before: current.map((c: any) => {
            const o: Record<string, unknown> = { id: c.id };
            Object.keys(patch).forEach((k) => { o[k] = c[k] ?? null; });
            return o;
          }),
        },
      });
      return caseIds.length;
    },
    onSuccess: (n) => {
      toast.success(`Updated ${n} test case${n === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["test-cases"] });
      onOpenChange(false);
      reset();
      onDone?.();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk edit {caseIds.length} test case{caseIds.length === 1 ? "" : "s"}</DialogTitle>
          <DialogDescription>
            {step === "edit"
              ? "Fields left on “Keep current” are not modified."
              : "Review the before/after changes for each test case, then confirm to save."}
          </DialogDescription>
        </DialogHeader>

        {step === "edit" && (
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>Keep current</SelectItem>
                <SelectItem value="1">P1 — Critical</SelectItem>
                <SelectItem value="2">P2 — Normal</SelectItem>
                <SelectItem value="3">P3 — Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>Keep current</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="deprecated">Deprecated</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Automation</Label>
            <Select value={automation} onValueChange={setAutomation}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>Keep current</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="planned">Planned</SelectItem>
                <SelectItem value="automated">Automated</SelectItem>
                <SelectItem value="obsolete">Obsolete</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Review status</Label>
            <Select value={reviewStatus} onValueChange={setReviewStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>Keep current</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="in_review">In review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Coverage tags (replaces)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="smoke, regression" />
          </div>
          <div className="space-y-1.5">
            <Label>Est. duration (min)</Label>
            <Input type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="Keep current" />
          </div>
        </div>
        )}

        {step === "preview" && (
          <ScrollArea className="max-h-[45vh] rounded-md border border-border/50">
            <div className="divide-y divide-border/40">
              {loadingCurrent && (
                <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              )}
              {current.map((c: any) => {
                const changed = Object.keys(patch).filter(
                  (k) => JSON.stringify(c[k] ?? null) !== JSON.stringify((patch as any)[k]),
                );
                return (
                  <div key={c.id} className="px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-sm font-medium">{c.title ?? "Untitled"}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {changed.length ? `${changed.length} change${changed.length === 1 ? "" : "s"}` : "no change"}
                      </Badge>
                    </div>
                    {changed.map((k) => (
                      <div key={k} className="flex items-center gap-2 text-[11px] font-mono">
                        <span className="w-28 shrink-0 text-muted-foreground">{FIELD_LABEL[k] ?? k}</span>
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive line-through">{fmt(c[k])}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="rounded bg-success/10 px-1.5 py-0.5 text-success">{fmt((patch as any)[k])}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          {step === "edit" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!Object.keys(patch).length) { toast.error("Nothing to change"); return; }
                  setStep("preview");
                }}
              >
                Preview changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("edit")}>Back</Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending || loadingCurrent}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm &amp; save {caseIds.length} case{caseIds.length === 1 ? "" : "s"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
