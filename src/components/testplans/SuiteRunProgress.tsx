import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Clock, Rocket, StopCircle, RotateCw, Download } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";

interface Props { suiteRunId: string; projectId?: string }

const META: Record<string, { icon: any; cls: string }> = {
  queued: { icon: Clock, cls: "text-muted-foreground" },
  dispatched: { icon: Loader2, cls: "text-cyan-400 animate-spin" },
  running: { icon: Loader2, cls: "text-cyan-400 animate-spin" },
  succeeded: { icon: CheckCircle2, cls: "text-emerald-400" },
  failed: { icon: XCircle, cls: "text-red-400" },
  timeout: { icon: XCircle, cls: "text-amber-400" },
  cancelled: { icon: XCircle, cls: "text-muted-foreground" },
};

const ACTIVE = new Set(["queued", "dispatched", "running"]);

export function SuiteRunProgress({ suiteRunId, projectId }: Props) {
  const qc = useQueryClient();
  const [acting, setActing] = useState<"cancel" | "rerun" | "zip" | null>(null);

  const { data: suite } = useQuery<any>({
    queryKey: ["suite-run", suiteRunId],
    queryFn: async () => {
      const { data, error } = await supabase.from("suite_runs" as any).select("*").eq("id", suiteRunId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: runs = [] } = useQuery<any[]>({
    queryKey: ["suite-spec-runs", suiteRunId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spec_runs" as any)
        .select("id, status, spec_id, started_at, finished_at, artifacts_json, spec:test_plan_specs(filename)")
        .eq("suite_run_id", suiteRunId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Hardened realtime: unique channel name per mount + project-scoped filters,
  // explicit teardown so re-renders or suite_run swaps can't leak subscriptions.
  useEffect(() => {
    if (!suiteRunId) return;
    const tag = `${suiteRunId}-${Math.random().toString(36).slice(2, 8)}`;
    const filters: any = { event: "*", schema: "public", table: "spec_runs", filter: `suite_run_id=eq.${suiteRunId}` };
    const ch = supabase
      .channel(`suite-progress-${tag}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "suite_runs", filter: `id=eq.${suiteRunId}` },
        () => qc.invalidateQueries({ queryKey: ["suite-run", suiteRunId] }))
      .on("postgres_changes", filters,
        () => qc.invalidateQueries({ queryKey: ["suite-spec-runs", suiteRunId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [suiteRunId, projectId, qc]);

  const isActive = suite && ACTIVE.has(suite.status);

  const cancelSuite = async () => {
    if (!suite) return;
    setActing("cancel");
    try {
      // Mark active children as cancelled — rollup trigger will roll the suite up.
      const { error: e1 } = await supabase.from("spec_runs" as any)
        .update({ status: "cancelled", finished_at: new Date().toISOString() })
        .eq("suite_run_id", suiteRunId)
        .in("status", ["queued", "dispatched", "running"]);
      if (e1) throw e1;
      // Also defensively set the suite itself so UI flips immediately.
      await supabase.from("suite_runs" as any)
        .update({ status: "cancelled", finished_at: new Date().toISOString() })
        .eq("id", suiteRunId);
      // (runner_jobs are linked from spec_runs.runner_job_id and will be reconciled
      // by the spec_runs cancellation above via the sync trigger.)
      toast.success("Suite cancelled");
      qc.invalidateQueries({ queryKey: ["suite-run", suiteRunId] });
      qc.invalidateQueries({ queryKey: ["suite-spec-runs", suiteRunId] });
    } catch (e: any) {
      toast.error(e.message || "Cancel failed");
    } finally { setActing(null); }
  };

  const rerunSuite = async () => {
    if (!suite) return;
    setActing("rerun");
    try {
      // Pull the spec_ids that ran under this suite (use first run per spec).
      const seen = new Set<string>();
      const specIds = runs.map(r => r.spec_id).filter(id => { if (seen.has(id)) return false; seen.add(id); return true; });
      if (specIds.length === 0) { toast.error("Nothing to rerun"); return; }

      const { data: newSuite, error: sErr } = await supabase.from("suite_runs" as any).insert({
        test_plan_id: suite.test_plan_id,
        project_id: suite.project_id,
        browser: suite.browser, headless: suite.headless, retries: suite.retries,
        config_json: { ...(suite.config_json || {}), rerun_of: suiteRunId, spec_count: specIds.length },
        total_specs: specIds.length,
      }).select("id").single();
      if (sErr) throw sErr;
      const newId = (newSuite as any).id as string;

      let ok = 0;
      for (const spec_id of specIds) {
        const { error } = await supabase.functions.invoke("spec-run-dispatch", {
          body: { spec_id, suite_run_id: newId, browser: suite.browser, headless: suite.headless, retries: suite.retries },
        });
        if (!error) ok++;
      }
      toast.success(`Re-dispatched ${ok}/${specIds.length} specs with saved config`);
    } catch (e: any) {
      toast.error(e.message || "Rerun failed");
    } finally { setActing(null); }
  };

  const downloadZip = async () => {
    if (!suite || runs.length === 0) return;
    setActing("zip");
    try {
      const zip = new JSZip();
      const root = zip.folder(`suite-run-${suiteRunId.slice(0, 8)}`)!;
      // Manifest
      root.file("suite-run.json", JSON.stringify({
        suite_run_id: suiteRunId,
        status: suite.status,
        browser: suite.browser, headless: suite.headless, retries: suite.retries,
        total: suite.total_specs, passed: suite.passed_specs, failed: suite.failed_specs,
        captured_at: new Date().toISOString(),
      }, null, 2));
      // Use the first spec_run's snapshot for shared docs (all share the plan).
      const first = runs.find(r => r.artifacts_json?.documents?.length);
      const docs = first?.artifacts_json?.documents || [];
      const docsDir = root.folder("docs")!;
      docs.forEach((d: any) => docsDir.file(`${d.slug || d.id}.md`, d.content || ""));
      docsDir.file("_documents.json", JSON.stringify(docs, null, 2));
      // Per-test-case spec files (dedupe by filename)
      const specsDir = root.folder("specs")!;
      const seen = new Set<string>();
      runs.forEach(r => {
        const list = r.artifacts_json?.specs || (r.artifacts_json?.spec ? [r.artifacts_json.spec] : []);
        list.forEach((s: any) => {
          const name = s.filename || `${s.id}.spec.ts`;
          if (seen.has(name)) return;
          seen.add(name);
          specsDir.file(name, s.content || "");
        });
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `suite-run-${suiteRunId.slice(0, 8)}.zip`; a.click();
      URL.revokeObjectURL(url);
      toast.success("Artifacts zipped");
    } catch (e: any) {
      toast.error(e.message || "Zip failed");
    } finally { setActing(null); }
  };

  const total = suite?.total_specs || runs.length || 0;
  const done = suite?.completed_specs || runs.filter(r => !ACTIVE.has(r.status)).length || 0;
  const pct = useMemo(() => total > 0 ? Math.round((done / total) * 100) : 0, [total, done]);

  if (!suite) return null;

  const statusCls =
    suite.status === "cancelled" ? "text-muted-foreground border-muted-foreground/40" :
    suite.status === "failed" ? "text-red-300 border-red-500/40" :
    suite.status === "succeeded" ? "text-emerald-300 border-emerald-500/40" :
    "text-cyan-300 border-cyan-500/40";

  return (
    <div className="border-t border-border/50 bg-muted/10 p-3 space-y-2">
      <div className="flex items-center justify-between text-xs gap-2 flex-wrap">
        <div className="flex items-center gap-2 font-medium">
          <Rocket className="h-3.5 w-3.5 text-accent" /> Suite Run · {suite.browser}{suite.headless ? " · headless" : ""} · retries {suite.retries}
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className={statusCls}>{suite.status}</Badge>
          <Badge variant="outline" className="text-emerald-300 border-emerald-500/30">✓ {suite.passed_specs ?? 0}</Badge>
          {(suite.failed_specs ?? 0) > 0 && <Badge variant="outline" className="text-red-300 border-red-500/30">✗ {suite.failed_specs}</Badge>}
          <span className="text-muted-foreground">{done}/{total}</span>
          {isActive && (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-red-300 hover:text-red-200 hover:bg-red-500/10"
              disabled={acting !== null} onClick={cancelSuite}>
              {acting === "cancel" ? <Loader2 className="h-3 w-3 animate-spin" /> : <StopCircle className="h-3 w-3 mr-1" />}
              Stop
            </Button>
          )}
          {!isActive && (
            <Button size="sm" variant="ghost" className="h-6 px-2" disabled={acting !== null} onClick={rerunSuite}>
              {acting === "rerun" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3 mr-1" />}
              Rerun
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-6 px-2" disabled={acting !== null || runs.length === 0} onClick={downloadZip}>
            {acting === "zip" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
            .zip
          </Button>
        </div>
      </div>
      <Progress value={pct} className={`h-1.5 ${suite.status === "cancelled" ? "opacity-60" : ""}`} />
      <div className="grid grid-cols-2 gap-1 max-h-[160px] overflow-auto">
        {runs.map((r: any) => {
          const m = META[r.status] || META.queued;
          const Icon = m.icon;
          return (
            <div key={r.id} className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded bg-background/40 border border-border/30 truncate">
              <Icon className={`h-3 w-3 shrink-0 ${m.cls}`} />
              <span className="truncate">{r.spec?.filename || r.spec_id.slice(0, 8)}</span>
              <span className="ml-auto text-muted-foreground">{r.status}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
