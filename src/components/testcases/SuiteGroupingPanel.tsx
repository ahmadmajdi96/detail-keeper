import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Wand2, Check, X, History } from "lucide-react";
import { logSuiteAudit } from "@/lib/suiteAudit";
import { SuiteGroupingHistory } from "./SuiteGroupingHistory";

export interface GroupingRules {
  strategy?: string;
  granularity?: string;
  maxSuites?: number;
  reuseExisting?: boolean;
  customInstructions?: string;
}

interface Props {
  projectId: string | null;
  workspaceId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/** AI controls: edit the grouping rules, regenerate groupings, review proposals. */
export function SuiteGroupingPanel({ projectId, workspaceId, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [rules, setRules] = useState<GroupingRules>({
    strategy: "feature",
    granularity: "balanced",
    maxSuites: 8,
    reuseExisting: true,
    customInstructions: "",
  });
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [historyOpen, setHistoryOpen] = useState(false);

  useQuery({
    queryKey: ["suite-grouping-rules", projectId],
    enabled: !!projectId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("suite_grouping_rules")
        .eq("id", projectId!)
        .maybeSingle();
      const stored = (data as any)?.suite_grouping_rules;
      if (stored && Object.keys(stored).length && !rulesLoaded) {
        setRules((p) => ({ ...p, ...stored }));
        setRulesLoaded(true);
      }
      return stored ?? {};
    },
  });

  const { data: proposals = [], isFetching } = useQuery({
    queryKey: ["suite-proposals", projectId],
    enabled: !!projectId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_cases")
        .select("id, title, suite_id, proposed_suite_name")
        .eq("project_id", projectId!)
        .eq("suite_assignment_status", "proposed")
        .order("proposed_suite_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveRules = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("projects")
        .update({ suite_grouping_rules: rules as any })
        .eq("id", projectId!);
      if (error) throw error;
      await logSuiteAudit({
        workspaceId, action: "suite.ai_rules_updated",
        entityKind: "project", entityId: projectId, meta: { rules },
      });
    },
    onSuccess: () => toast.success("Grouping rules saved"),
    onError: (e: any) => toast.error(e.message),
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("suite-grouping", {
        body: { projectId, rules },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await logSuiteAudit({
        workspaceId, action: "suite.ai_grouping_proposed",
        entityKind: "project", entityId: projectId,
        meta: { rules, proposed: (data as any)?.proposed ?? 0 },
      });
      return data as any;
    },
    onSuccess: (d) => {
      toast.success(`${d?.proposed ?? 0} suite assignments proposed — review below`);
      qc.invalidateQueries({ queryKey: ["suite-proposals", projectId] });
    },
    onError: (e: any) => toast.error(e.message ?? "AI grouping failed"),
  });

  const applyProposals = useMutation({
    mutationFn: async (ids: string[]) => {
      const rows = proposals.filter((p: any) => ids.includes(p.id));
      const names = Array.from(new Set(rows.map((r: any) => r.proposed_suite_name).filter(Boolean)));

      const { data: existing } = await supabase
        .from("test_suites")
        .select("id, name")
        .eq("project_id", projectId!);
      const byName = new Map((existing ?? []).map((s: any) => [s.name.toLowerCase(), s.id]));

      for (const name of names) {
        if (byName.has(String(name).toLowerCase())) continue;
        const { data: created, error } = await supabase
          .from("test_suites")
          .insert({ project_id: projectId!, name: String(name) })
          .select("id, name")
          .single();
        if (error) throw error;
        byName.set(String(name).toLowerCase(), created.id);
      }

      for (const row of rows as any[]) {
        const suiteId = byName.get(String(row.proposed_suite_name).toLowerCase()) ?? null;
        const { error } = await supabase
          .from("test_cases")
          .update({
            suite_id: suiteId,
            suite_assignment_status: "confirmed",
            proposed_suite_name: null,
          } as any)
          .eq("id", row.id);
        if (error) throw error;
      }

      // Snapshot this application as a rollback-able grouping version.
      const suiteNameById = new Map(
        (existing ?? []).map((s: any) => [s.id as string, s.name as string]),
      );
      names.forEach((n) => {
        const id = byName.get(String(n).toLowerCase());
        if (id) suiteNameById.set(id, String(n));
      });
      const assignments = (rows as any[]).map((row) => {
        const toId = byName.get(String(row.proposed_suite_name).toLowerCase()) ?? null;
        return {
          case_id: row.id,
          title: row.title,
          from_suite_id: row.suite_id ?? null,
          from_suite_name: row.suite_id ? suiteNameById.get(row.suite_id) ?? null : null,
          to_suite_id: toId,
          to_suite_name: row.proposed_suite_name ?? null,
        };
      });

      const { data: last } = await supabase
        .from("suite_grouping_versions" as any)
        .select("version")
        .eq("project_id", projectId!)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      await supabase.from("suite_grouping_versions" as any).update({ is_current: false }).eq("project_id", projectId!);
      const { data: auth } = await supabase.auth.getUser();
      await supabase.from("suite_grouping_versions" as any).insert({
        project_id: projectId!,
        workspace_id: workspaceId,
        version: ((last as any)?.version ?? 0) + 1,
        rules: rules as any,
        assignments: assignments as any,
        note: `Applied ${assignments.length} AI assignment(s)`,
        is_current: true,
        created_by: auth?.user?.id ?? null,
      });

      await logSuiteAudit({
        workspaceId, action: "suite.ai_grouping_applied",
        entityKind: "project", entityId: projectId,
        meta: { applied: rows.length, suites: names, version: ((last as any)?.version ?? 0) + 1 },
      });
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`Finalised ${n} suite assignment${n === 1 ? "" : "s"}`);
      setAccepted({});
      qc.invalidateQueries({ queryKey: ["suite-proposals", projectId] });
      qc.invalidateQueries({ queryKey: ["test-suites", projectId] });
      qc.invalidateQueries({ queryKey: ["test-cases"] });
      qc.invalidateQueries({ queryKey: ["suite-grouping-versions", projectId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rejectProposals = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("test_cases")
        .update({ suite_assignment_status: "confirmed", proposed_suite_name: null } as any)
        .in("id", ids);
      if (error) throw error;
      await logSuiteAudit({
        workspaceId, action: "suite.ai_grouping_applied",
        entityKind: "project", entityId: projectId,
        meta: { rejected: ids.length },
      });
    },
    onSuccess: () => {
      toast.message("Proposals discarded");
      setAccepted({});
      qc.invalidateQueries({ queryKey: ["suite-proposals", projectId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const acceptedIds = Object.keys(accepted).filter((k) => accepted[k]);
  const allIds = proposals.map((p: any) => p.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" /> AI suite grouping
          </DialogTitle>
          <DialogDescription>
            Adjust the rules the AI uses to group test cases, regenerate the grouping, and review
            proposed assignments before finalising them.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Group primarily by</Label>
              <Select value={rules.strategy} onValueChange={(v) => setRules((p) => ({ ...p, strategy: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="feature">Feature / functional area</SelectItem>
                  <SelectItem value="user journey">User journey</SelectItem>
                  <SelectItem value="api endpoint">API endpoint</SelectItem>
                  <SelectItem value="risk">Risk &amp; priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Granularity</Label>
              <Select value={rules.granularity} onValueChange={(v) => setRules((p) => ({ ...p, granularity: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="coarse">Coarse — few broad suites</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="fine">Fine — many small suites</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Max suites</Label>
              <Input
                type="number" min={1} max={40}
                value={rules.maxSuites ?? 8}
                onChange={(e) => setRules((p) => ({ ...p, maxSuites: Number(e.target.value) }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Reuse existing suites</p>
                <p className="text-xs text-muted-foreground">Prefer current suite names when they fit</p>
              </div>
              <Switch
                checked={rules.reuseExisting !== false}
                onCheckedChange={(v) => setRules((p) => ({ ...p, reuseExisting: v }))}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Extra instructions</Label>
              <Textarea
                rows={5}
                placeholder="e.g., keep all payment flows in one suite; separate smoke tests"
                value={rules.customInstructions ?? ""}
                onChange={(e) => setRules((p) => ({ ...p, customInstructions: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => saveRules.mutate()} disabled={saveRules.isPending || !projectId}>
                {saveRules.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save rules
              </Button>
              <Button className="flex-1 ai-gradient text-white" onClick={() => regenerate.mutate()} disabled={regenerate.isPending || !projectId}>
                {regenerate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                Regenerate
              </Button>
            </div>
          </div>
        </div>

        <Card className="border-border/50">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              Proposed assignments
              <Badge variant="outline">{proposals.length}</Badge>
              {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </CardTitle>
            <CardDescription className="text-xs">
              Nothing changes until you finalise. Suites that don't exist yet are created on apply.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[220px]">
              {proposals.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No pending proposals. Run “Regenerate” to get AI suggestions.
                </p>
              ) : (
                <ul className="divide-y divide-border/40">
                  {proposals.map((p: any) => (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-2">
                      <Checkbox
                        checked={!!accepted[p.id]}
                        onCheckedChange={(v) => setAccepted((s) => ({ ...s, [p.id]: !!v }))}
                      />
                      <span className="flex-1 truncate text-sm">{p.title}</span>
                      <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20 text-[10px]">
                        → {p.proposed_suite_name}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost" size="sm"
            disabled={!proposals.length}
            onClick={() => setAccepted(Object.fromEntries(allIds.map((id) => [id, true])))}
          >
            Select all
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}>
            <History className="mr-2 h-4 w-4" /> Version history
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={!acceptedIds.length || rejectProposals.isPending}
              onClick={() => rejectProposals.mutate(acceptedIds)}
            >
              <X className="mr-2 h-4 w-4" /> Reject selected
            </Button>
            <Button
              disabled={!acceptedIds.length || applyProposals.isPending}
              onClick={() => applyProposals.mutate(acceptedIds)}
            >
              {applyProposals.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Finalise selected
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <SuiteGroupingHistory
        projectId={projectId}
        workspaceId={workspaceId}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </Dialog>
  );
}
