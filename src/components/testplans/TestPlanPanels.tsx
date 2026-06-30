import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Server, Bug, ShieldCheck, BarChart3, Activity, Loader2, Radio,
  CheckCircle2, XCircle, Clock, ExternalLink, Monitor, Terminal,
} from "lucide-react";
import { Link } from "react-router-dom";
import { SpecRunPanel } from "./SpecRunPanel";

const RUNNER_STATUS: Record<string, string> = {
  idle: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  busy: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  offline: "bg-muted text-muted-foreground",
  disabled: "bg-red-500/15 text-red-300 border-red-500/30",
};

/* ---------- Runners ---------- */
export function PlanRunnersPanel({ projectId }: { projectId: string }) {
  const { data: runners = [], isLoading } = useQuery({
    queryKey: ["plan-runners", projectId],
    queryFn: async () => (await supabase.from("runners")
      .select("*, environment:environments(name)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })).data || [],
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4 text-accent" /> Runners</CardTitle>
          <CardDescription>Executors available to run this plan's specs.</CardDescription>
        </div>
        <Button asChild size="sm" variant="outline"><Link to="/runners"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Manage</Link></Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          : runners.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Server className="mx-auto h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">No runners registered for this project.</p>
              <Button asChild size="sm" className="mt-3"><Link to="/runners">Register a runner</Link></Button>
            </div>
          ) : (
            <div className="space-y-2">
              {runners.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Server className="h-3.5 w-3.5 text-accent" /> {r.name}
                      <Badge variant="outline" className={RUNNER_STATUS[r.status] || ""}>{r.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.kind}{r.environment?.name ? ` · env: ${r.environment.name}` : ""}
                      {r.last_seen_at ? ` · last seen ${new Date(r.last_seen_at).toLocaleString()}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
      </CardContent>
    </Card>
  );
}

/* ---------- Defects ---------- */
const SEVERITY_CLASS: Record<string, string> = {
  critical: "text-red-400 border-red-500/40",
  high: "text-orange-400 border-orange-500/40",
  medium: "text-amber-300 border-amber-500/40",
  low: "text-emerald-300 border-emerald-500/40",
};
export function PlanDefectsPanel({ testPlanId }: { testPlanId: string }) {
  const { data: defects = [], isLoading } = useQuery({
    queryKey: ["plan-defects", testPlanId],
    queryFn: async () => (await supabase.from("defects")
      .select("id, title, severity, priority, status, created_at, reporter:profiles!defects_reporter_id_fkey(name)")
      .eq("test_plan_id", testPlanId)
      .order("created_at", { ascending: false })).data || [],
  });

  const counts = useMemo(() => {
    const c: any = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
    defects.forEach((d: any) => { c[d.status] = (c[d.status] || 0) + 1; });
    return c;
  }, [defects]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><Bug className="h-4 w-4 text-accent" /> Defects</CardTitle>
          <CardDescription>Bugs raised against this test plan.</CardDescription>
        </div>
        <Button asChild size="sm" variant="outline"><Link to="/defects"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Open Defects</Link></Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {(["open", "in_progress", "resolved", "closed"] as const).map(s => (
            <div key={s} className="p-3 rounded-lg border bg-secondary/30 text-center">
              <p className="text-lg font-bold">{counts[s] || 0}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.replace("_", " ")}</p>
            </div>
          ))}
        </div>
        {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          : defects.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Bug className="mx-auto h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">No defects linked to this plan.</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[420px]">
              <div className="space-y-2">
                {defects.map((d: any) => (
                  <Link key={d.id} to={`/defects/${d.id}`} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:border-accent/50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.reporter?.name || "unknown"} · {new Date(d.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Badge variant="outline" className={SEVERITY_CLASS[d.severity] || ""}>{d.severity}</Badge>
                      <Badge variant="outline">{d.status}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </ScrollArea>
          )}
      </CardContent>
    </Card>
  );
}

/* ---------- Quality Gates ---------- */
export function PlanQualityGatesPanel({ projectId }: { projectId: string }) {
  const { data: gates = [], isLoading } = useQuery({
    queryKey: ["plan-quality-gates", projectId],
    queryFn: async () => (await (supabase as any).from("quality_gates")
      .select("*").eq("project_id", projectId).order("created_at", { ascending: false })).data || [],
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Quality Gates</CardTitle>
          <CardDescription>Pass/fail criteria evaluated against this plan's cycle runs.</CardDescription>
        </div>
        <Button asChild size="sm" variant="outline"><Link to="/quality-gates"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Manage</Link></Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          : gates.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <ShieldCheck className="mx-auto h-10 w-10 mb-2 opacity-50" />
              <p className="text-sm">No quality gates configured yet.</p>
              <Button asChild size="sm" className="mt-3"><Link to="/quality-gates">Create a gate</Link></Button>
            </div>
          ) : (
            <div className="space-y-2">
              {gates.map((g: any) => (
                <div key={g.id} className="p-3 rounded-lg border bg-card">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{g.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{g.description || "—"}</p>
                    </div>
                    <Badge variant="outline" className={g.is_active ? "border-emerald-500/40 text-emerald-300" : ""}>
                      {g.is_active ? "active" : "inactive"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
      </CardContent>
    </Card>
  );
}

/* ---------- Reports ---------- */
export function PlanReportsPanel({ testPlanId, projectId }: { testPlanId: string; projectId: string }) {
  const { data: execs = [] } = useQuery({
    queryKey: ["plan-report-execs", testPlanId],
    queryFn: async () => (await supabase.from("test_executions")
      .select("id, status, started_at, completed_at")
      .eq("test_plan_id", testPlanId)
      .order("created_at", { ascending: false }).limit(500)).data || [],
  });
  const { data: suiteRuns = [] } = useQuery({
    queryKey: ["plan-report-suites", testPlanId],
    queryFn: async () => (await (supabase as any).from("suite_runs")
      .select("id, status, total_specs, passed_specs, failed_specs, completed_specs, created_at")
      .eq("test_plan_id", testPlanId)
      .order("created_at", { ascending: false }).limit(20)).data || [],
  });
  const { data: defects = [] } = useQuery({
    queryKey: ["plan-report-defects", testPlanId],
    queryFn: async () => (await supabase.from("defects").select("id, severity, status")
      .eq("test_plan_id", testPlanId)).data || [],
  });

  const passed = execs.filter((e: any) => e.status === "passed").length;
  const failed = execs.filter((e: any) => e.status === "failed").length;
  const blocked = execs.filter((e: any) => e.status === "blocked").length;
  const passRate = execs.length ? Math.round((passed / execs.length) * 100) : 0;
  const openBugs = defects.filter((d: any) => !["resolved", "closed"].includes(d.status)).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-accent" /> Plan Report</CardTitle>
          <CardDescription>Aggregated execution and defect metrics for this test plan.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Executions", val: execs.length },
              { label: "Passed", val: passed, cls: "text-emerald-400" },
              { label: "Failed", val: failed, cls: "text-red-400" },
              { label: "Blocked", val: blocked, cls: "text-amber-400" },
              { label: "Open Defects", val: openBugs, cls: "text-orange-400" },
            ].map((m: any) => (
              <div key={m.label} className="p-3 rounded-lg border bg-secondary/30">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</p>
                <p className={`text-2xl font-bold ${m.cls || ""}`}>{m.val}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Pass Rate</span>
              <span className="font-medium">{passRate}%</span>
            </div>
            <Progress value={passRate} className="h-2" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-accent" /> Recent Suite Runs</CardTitle>
          <Button asChild size="sm" variant="outline"><Link to="/reporting"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Full Reports</Link></Button>
        </CardHeader>
        <CardContent>
          {suiteRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No suite runs yet.</p>
          ) : (
            <div className="space-y-2">
              {suiteRuns.map((s: any) => {
                const pct = s.total_specs ? Math.round((s.completed_specs / s.total_specs) * 100) : 0;
                return (
                  <div key={s.id} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="outline">{s.status}</Badge>
                        <span className="text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {s.passed_specs}✓ · {s.failed_specs}✗ · {s.total_specs} total
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Live (Chromium stream) ---------- */
export function PlanLivePanel({ testPlanId }: { testPlanId: string }) {
  const [activeSpec, setActiveSpec] = useState<string | null>(null);
  const [specs, setSpecs] = useState<any[]>([]);

  const refresh = async () => {
    const { data: rows } = await supabase.from("test_plan_specs" as any)
      .select("id, filename, status").eq("test_plan_id", testPlanId)
      .order("updated_at", { ascending: false });
    setSpecs(rows || []);
    // pick currently running, else most recent with any run
    const { data: runs } = await supabase.from("spec_runs" as any)
      .select("spec_id, status, created_at")
      .in("spec_id", (rows || []).map((r: any) => r.id))
      .order("created_at", { ascending: false }).limit(50);
    const live = (runs || []).find((r: any) => ["queued", "dispatched", "running"].includes(r.status));
    setActiveSpec(live?.spec_id || runs?.[0]?.spec_id || (rows || [])[0]?.id || null);
  };

  useEffect(() => { refresh(); }, [testPlanId]);

  useEffect(() => {
    const ch = supabase.channel(`plan-live-${testPlanId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "spec_runs" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [testPlanId]);

  if (!specs.length) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <Monitor className="mx-auto h-10 w-10 mb-3 opacity-50" />
          <p className="text-sm">No Playwright specs generated for this plan yet.</p>
          <p className="text-xs mt-1">Generate specs from the <strong>AI Workbench</strong> tab, then dispatch a Run Suite to see the live Chromium stream here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Radio className="h-4 w-4 text-red-400 animate-pulse" /> Live Chromium View
        </CardTitle>
        <CardDescription>Latest streaming run for this plan. Switch specs to inspect another stream.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {specs.map(s => (
            <button key={s.id}
              onClick={() => setActiveSpec(s.id)}
              className={`text-[11px] font-mono px-2 py-1 rounded border transition-colors ${activeSpec === s.id ? "bg-accent/20 border-accent text-accent" : "bg-card border-border hover:border-accent/40"}`}>
              {s.filename}
            </button>
          ))}
        </div>
        {activeSpec ? <SpecRunPanel specId={activeSpec} /> : <p className="text-sm text-muted-foreground">Pick a spec to view its live stream.</p>}
      </CardContent>
    </Card>
  );
}
