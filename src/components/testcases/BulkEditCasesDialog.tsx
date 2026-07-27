import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
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

  const save = useMutation({
    mutationFn: async () => {
      const patch: Record<string, unknown> = {};
      if (priority !== KEEP) patch.priority = Number(priority);
      if (status !== KEEP) patch.status = status;
      if (automation !== KEEP) patch.automation_status = automation;
      if (reviewStatus !== KEEP) patch.review_status = reviewStatus;
      if (duration.trim()) patch.estimated_duration_min = Number(duration);
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
      if (tagList.length) patch.coverage_tags = tagList;

      if (!Object.keys(patch).length) throw new Error("Nothing to change");

      const { error } = await supabase.from("test_cases").update(patch as any).in("id", caseIds);
      if (error) throw error;

      await logSuiteAudit({
        workspaceId,
        action: "suite.cases_bulk_updated",
        entityKind: "test_case",
        entityId: caseIds[0] ?? null,
        meta: { count: caseIds.length, changes: patch, case_ids: caseIds },
      });
      return caseIds.length;
    },
    onSuccess: (n) => {
      toast.success(`Updated ${n} test case${n === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["test-cases"] });
      onOpenChange(false);
      setPriority(KEEP); setStatus(KEEP); setAutomation(KEEP); setReviewStatus(KEEP);
      setTags(""); setDuration("");
      onDone?.();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk edit {caseIds.length} test case{caseIds.length === 1 ? "" : "s"}</DialogTitle>
          <DialogDescription>Fields left on “Keep current” are not modified.</DialogDescription>
        </DialogHeader>

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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Apply changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
