import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ArrowRight, History, Loader2, RotateCcw, Undo2 } from "lucide-react";
import { logSuiteAudit } from "@/lib/suiteAudit";

export interface GroupingAssignment {
  case_id: string;
  title?: string | null;
  from_suite_id?: string | null;
  from_suite_name?: string | null;
  to_suite_id?: string | null;
  to_suite_name?: string | null;
}

interface Props {
  projectId: string | null;
  workspaceId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const label = (name?: string | null) => name || "Unassigned";

/**
 * Version history for AI suite grouping: preview each applied version,
 * compare it against what is live right now, and roll back.
 */
export function SuiteGroupingHistory({ projectId, workspaceId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: versions = [], isFetching } = useQuery({
    queryKey: ["suite-grouping-versions", projectId],
    enabled: !!projectId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suite_grouping_versions" as any)
        .select("*")
        .eq("project_id", projectId!)
        .order("version", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const active = versions.find((v) => v.id === selected) ?? versions[0] ?? null;
  const assignments: GroupingAssignment[] = (active?.assignments ?? []) as GroupingAssignment[];

  /** Live suite assignment of the cases in the selected version — used for the comparison column. */
  const { data: live = {} } = useQuery({
    queryKey: ["suite-grouping-live", active?.id],
    enabled: !!active && assignments.length > 0,
    queryFn: async () => {
      const ids = assignments.map((a) => a.case_id);
      const { data, error } = await supabase
        .from("test_cases")
        .select("id, suite_id, test_suites(name)")
        .in("id", ids);
      if (error) throw error;
      const map: Record<string, string | null> = {};
      (data ?? []).forEach((c: any) => { map[c.id] = c.test_suites?.name ?? null; });
      return map;
    },
  });

  const restore = useMutation({
    mutationFn: async (direction: "rollback" | "reapply") => {
      if (!active) throw new Error("No version selected");
      for (const a of assignments) {
        const target = direction === "rollback" ? a.from_suite_id ?? null : a.to_suite_id ?? null;
        const { error } = await supabase
          .from("test_cases")
          .update({ suite_id: target, suite_assignment_status: "confirmed", proposed_suite_name: null } as any)
          .eq("id", a.case_id);
        if (error) throw error;
      }
      await supabase
        .from("suite_grouping_versions" as any)
        .update({ is_current: false })
        .eq("project_id", projectId!);
      if (direction === "reapply") {
        await supabase
          .from("suite_grouping_versions" as any)
          .update({ is_current: true })
          .eq("id", active.id);
      }
      await logSuiteAudit({
        workspaceId,
        action: direction === "rollback" ? "suite.ai_grouping_rolled_back" : "suite.ai_grouping_reapplied",
        entityKind: "project", entityId: projectId,
        meta: { version: active.version, cases: assignments.length },
      });
      return assignments.length;
    },
    onSuccess: (n, direction) => {
      toast.success(
        direction === "rollback"
          ? `Rolled back ${n} assignment${n === 1 ? "" : "s"}`
          : `Re-applied ${n} assignment${n === 1 ? "" : "s"}`,
      );
      qc.invalidateQueries({ queryKey: ["suite-grouping-versions", projectId] });
      qc.invalidateQueries({ queryKey: ["test-suites", projectId] });
      qc.invalidateQueries({ queryKey: ["test-cases"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-accent" /> AI grouping version history
          </DialogTitle>
          <DialogDescription>
            Preview a previously applied grouping, compare it with the live assignments, and roll back.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <ScrollArea className="h-[360px] rounded-md border border-border/50">
            {isFetching && (
              <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
            )}
            {!isFetching && !versions.length && (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">
                No grouping versions recorded yet.
              </p>
            )}
            <ul className="divide-y divide-border/40">
              {versions.map((v) => (
                <li key={v.id}>
                  <button
                    onClick={() => setSelected(v.id)}
                    className={`w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/50 ${
                      active?.id === v.id ? "bg-accent/10" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">v{v.version}</span>
                      {v.is_current && <Badge variant="outline" className="text-[10px]">current</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(v.created_at).toLocaleString()}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {(v.assignments ?? []).length} assignment{(v.assignments ?? []).length === 1 ? "" : "s"}
                      {v.rules?.strategy ? ` · by ${v.rules.strategy}` : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>

          <div className="space-y-3">
            <ScrollArea className="h-[300px] rounded-md border border-border/50">
              <div className="divide-y divide-border/40">
                {assignments.map((a) => {
                  const liveName = live[a.case_id] ?? null;
                  const drifted = label(liveName) !== label(a.to_suite_name);
                  return (
                    <div key={a.case_id} className="px-3 py-2 space-y-1">
                      <p className="truncate text-sm">{a.title ?? a.case_id.slice(0, 8)}</p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">{label(a.from_suite_name)}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="rounded bg-accent/10 px-1.5 py-0.5 text-accent">{label(a.to_suite_name)}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${drifted ? "border-warning/40 text-warning" : "text-muted-foreground"}`}
                        >
                          live: {label(liveName)}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
                {!assignments.length && (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Select a version to preview its assignments.
                  </p>
                )}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={!assignments.length || restore.isPending}
                onClick={() => restore.mutate("rollback")}
              >
                {restore.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
                Roll back to before v{active?.version}
              </Button>
              <Button
                disabled={!assignments.length || restore.isPending}
                onClick={() => restore.mutate("reapply")}
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Re-apply v{active?.version}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
