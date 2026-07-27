import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle, CheckCircle2, FileCode2, Loader2, ShieldCheck, Wand2, XCircle, ChevronDown,
} from "lucide-react";
import { validateSpec, summarize, type ValidationResult } from "@/lib/playwrightValidation";

interface Props {
  testPlanId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

type SpecRow = { id: string; filename: string; content: string | null; validation_status: string | null };

/**
 * Formatting + lint + syntax validation for every generated Playwright spec.
 * Nothing is executed — the checks are static and run in the browser.
 */
export function SpecValidationPanel({ testPlanId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: specs = [], isLoading } = useQuery<SpecRow[]>({
    queryKey: ["tp-spec-validation", testPlanId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_plan_specs" as any)
        .select("id, filename, content, validation_status")
        .eq("test_plan_id", testPlanId)
        .order("filename");
      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const results = useMemo(
    () => specs.map((s) => ({ spec: s, result: validateSpec(s.filename, s.content ?? "") })),
    [specs],
  );
  const totals = useMemo(() => summarize(results.map((r) => r.result)), [results]);

  const persist = useMutation({
    mutationFn: async () => {
      for (const { spec, result } of results) {
        const { error } = await supabase
          .from("test_plan_specs" as any)
          .update({
            validation_status: result.ok ? (result.warnings ? "passed_with_warnings" : "passed") : "failed",
            validation_report: {
              errors: result.errors,
              warnings: result.warnings,
              issues: result.issues,
              checked_at: new Date().toISOString(),
            } as any,
            validated_at: new Date().toISOString(),
          })
          .eq("id", spec.id);
        if (error) throw error;
      }
      return results.length;
    },
    onSuccess: (n) => {
      toast.success(`Validation recorded for ${n} file${n === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["tp-spec-validation", testPlanId] });
      qc.invalidateQueries({ queryKey: ["tp-specs", testPlanId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const applyFormatting = useMutation({
    mutationFn: async () => {
      const changed = results.filter((r) => r.result.formatChanged);
      for (const { spec, result } of changed) {
        const { error } = await supabase
          .from("test_plan_specs" as any)
          .update({ content: result.formatted })
          .eq("id", spec.id);
        if (error) throw error;
      }
      return changed.length;
    },
    onSuccess: (n) => {
      toast.success(n ? `Formatted ${n} file${n === 1 ? "" : "s"}` : "All files already formatted");
      qc.invalidateQueries({ queryKey: ["tp-spec-validation", testPlanId] });
      qc.invalidateQueries({ queryKey: ["tp-specs", testPlanId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const badge = (r: ValidationResult) =>
    r.errors
      ? <Badge className="bg-destructive/15 text-destructive border-destructive/20 text-[10px]">{r.errors} error{r.errors === 1 ? "" : "s"}</Badge>
      : r.warnings
        ? <Badge className="bg-warning/15 text-warning border-warning/20 text-[10px]">{r.warnings} warning{r.warnings === 1 ? "" : "s"}</Badge>
        : <Badge className="bg-success/15 text-success border-success/20 text-[10px]">clean</Badge>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-accent" /> Playwright code validation
          </DialogTitle>
          <DialogDescription>
            Static formatting, lint and syntax checks over every generated spec. Nothing is installed or executed.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Files", value: totals.files, cls: "text-foreground" },
            { label: "Passing", value: totals.passed, cls: "text-success" },
            { label: "Errors", value: totals.errors, cls: "text-destructive" },
            { label: "Warnings", value: totals.warnings, cls: "text-warning" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border/50 p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</p>
              <p className={`text-xl font-semibold ${s.cls}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <ScrollArea className="h-[46vh] rounded-md border border-border/50">
            <div className="divide-y divide-border/40">
              {!results.length && (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No Playwright specs generated yet.
                </p>
              )}
              {results.map(({ spec, result }) => {
                const isOpen = expanded === spec.id;
                return (
                  <div key={spec.id}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : spec.id)}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40"
                    >
                      <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                      {result.ok
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        : <XCircle className="h-3.5 w-3.5 text-destructive" />}
                      <FileCode2 className="h-3.5 w-3.5 text-amber-400" />
                      <span className="flex-1 truncate font-mono text-xs">{spec.filename}</span>
                      {result.formatChanged && (
                        <Badge variant="outline" className="text-[10px]">needs formatting</Badge>
                      )}
                      {badge(result)}
                    </button>
                    {isOpen && (
                      <ul className="space-y-1 border-t border-border/40 bg-muted/20 px-4 py-2">
                        {result.issues.length === 0 && (
                          <li className="text-[11px] text-muted-foreground">No issues found.</li>
                        )}
                        {result.issues.map((iss, i) => (
                          <li key={i} className="flex items-start gap-2 text-[11px]">
                            {iss.severity === "error"
                              ? <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                              : <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warning" />}
                            <span className="font-mono text-muted-foreground">L{iss.line}</span>
                            <span className="font-mono text-muted-foreground">[{iss.pass}/{iss.rule}]</span>
                            <span>{iss.message}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            disabled={!results.some((r) => r.result.formatChanged) || applyFormatting.isPending}
            onClick={() => applyFormatting.mutate()}
          >
            {applyFormatting.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            Apply formatting fixes
          </Button>
          <Button disabled={!results.length || persist.isPending} onClick={() => persist.mutate()}>
            {persist.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Record validation results
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
