import { useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  PlayCircle, CheckCircle2, XCircle, Bot, Bug, Timer, Zap, ListOrdered, Loader2,
} from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  projectId?: string | null;
  workspaceId?: string | null;
  scopeKey: string;
  rangeDays: number;
  /** total test cases in scope, used for automation coverage + defect density */
  totalCases: number;
  automatedCases: number;
  defectCount: number;
}

type CaseStat = { title: string; runs: number; failed: number; passed: number; durationMs: number };

const COLORS = {
  passed: "hsl(var(--success))",
  failed: "hsl(var(--destructive))",
  skipped: "hsl(var(--muted-foreground))",
};

function statusOf(v: unknown) {
  return String(v ?? "").toLowerCase();
}

export function ExecutionDashboard({
  projectId, workspaceId, scopeKey, rangeDays, totalCases, automatedCases, defectCount,
}: Props) {
  const since = useMemo(
    () => startOfDay(subDays(new Date(), rangeDays)).toISOString(),
    [rangeDays],
  );

  const runsQ = useQuery({
    queryKey: ["exec-dash-runs", scopeKey, rangeDays],
    enabled: !!workspaceId || !!projectId,
    queryFn: async () => {
      let qb = supabase
        .from("plan_test_runs")
        .select("id,status,created_at,started_at,finished_at,total_tests,passed_tests,failed_tests,skipped_tests,environment,test_case_progress")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (projectId) qb = qb.eq("project_id", projectId);
      else if (workspaceId) qb = qb.eq("workspace_id", workspaceId);
      const { data, error } = await qb;
      if (error) throw error;
      return data || [];
    },
  });

  const sessionsQ = useQuery({
    queryKey: ["exec-dash-sessions", scopeKey, rangeDays],
    enabled: !!workspaceId || !!projectId,
    queryFn: async () => {
      let qb = supabase
        .from("manual_execution_sessions")
        .select("id,status,created_at,started_at,finished_at,environment,summary")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (projectId) qb = qb.eq("project_id", projectId);
      else if (workspaceId) qb = qb.eq("workspace_id", workspaceId);
      const { data, error } = await qb;
      if (error) throw error;
      return data || [];
    },
  });

  const manualItemsQ = useQuery({
    queryKey: ["exec-dash-manual-items", scopeKey, rangeDays],
    enabled: !!workspaceId || !!projectId,
    queryFn: async () => {
      let qb = supabase
        .from("manual_execution_items")
        .select("id,status,executed_at,duration_seconds,test_case_id,created_at,test_cases(title)")
        .gte("created_at", since)
        .limit(3000);
      if (projectId) qb = qb.eq("project_id", projectId);
      const { data, error } = await qb;
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const runs = runsQ.data || [];
  const sessions = sessionsQ.data || [];
  const manualItems = manualItemsQ.data || [];

  /** Per test-case aggregation across automated runs + manual items */
  const caseStats = useMemo(() => {
    const map = new Map<string, CaseStat>();
    const bump = (title: string, status: string, durationMs: number) => {
      const key = title.trim();
      if (!key) return;
      const cur = map.get(key) ?? { title: key, runs: 0, failed: 0, passed: 0, durationMs: 0 };
      cur.runs++;
      cur.durationMs += durationMs;
      if (["failed", "timedout", "timed_out", "error"].includes(status)) cur.failed++;
      else if (["passed", "pass", "ok"].includes(status)) cur.passed++;
      map.set(key, cur);
    };

    for (const r of runs as any[]) {
      const tcp = r.test_case_progress ?? {};
      const cases: any[] = Array.isArray(tcp?.test_cases) ? tcp.test_cases : Array.isArray(tcp) ? tcp : [];
      for (const c of cases) {
        bump(
          String(c.title ?? c.name ?? c.id ?? ""),
          statusOf(c.status),
          Number(c.duration_ms ?? c.duration ?? 0) || 0,
        );
      }
    }
    for (const it of manualItems) {
      bump(
        String(it.test_cases?.title ?? it.test_case_id ?? ""),
        statusOf(it.status),
        (Number(it.duration_seconds) || 0) * 1000,
      );
    }
    return [...map.values()];
  }, [runs, manualItems]);

  const metrics = useMemo(() => {
    const automatedRuns = runs.length;
    const manualRuns = sessions.length;
    const totalExecutions = automatedRuns + manualRuns;

    let passed = 0, failed = 0, skipped = 0;
    for (const r of runs as any[]) {
      passed += Number(r.passed_tests) || 0;
      failed += Number(r.failed_tests) || 0;
      skipped += Number(r.skipped_tests) || 0;
    }
    for (const it of manualItems) {
      const s = statusOf(it.status);
      if (s === "passed") passed++;
      else if (s === "failed") failed++;
      else if (s === "skipped" || s === "blocked") skipped++;
    }
    const graded = passed + failed;
    const passRate = graded ? Math.round((passed / graded) * 100) : 0;
    const failureRate = graded ? 100 - passRate : 0;

    // Average execution time across finished runs + sessions
    const durations: number[] = [];
    const push = (a?: string | null, b?: string | null) => {
      if (!a || !b) return;
      const d = new Date(b).getTime() - new Date(a).getTime();
      if (d > 0 && d < 24 * 3600 * 1000) durations.push(d);
    };
    (runs as any[]).forEach((r) => push(r.started_at ?? r.created_at, r.finished_at));
    (sessions as any[]).forEach((s) => push(s.started_at ?? s.created_at, s.finished_at));
    const avgMs = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    const automationPct = totalCases ? Math.round((automatedCases / totalCases) * 100) : 0;
    const defectDensity = totalCases ? +(defectCount / totalCases).toFixed(2) : 0;

    const flaky = caseStats
      .filter((c) => c.passed > 0 && c.failed > 0 && c.runs > 1)
      .map((c) => ({ ...c, flakiness: Math.round((Math.min(c.passed, c.failed) / c.runs) * 200) }))
      .sort((a, b) => b.flakiness - a.flakiness || b.runs - a.runs)
      .slice(0, 10);

    const topFailed = caseStats
      .filter((c) => c.failed > 0)
      .sort((a, b) => b.failed - a.failed || b.runs - a.runs)
      .slice(0, 10);

    return {
      totalExecutions, automatedRuns, manualRuns, passed, failed, skipped,
      passRate, failureRate, avgMs, automationPct, defectDensity, flaky, topFailed,
    };
  }, [runs, sessions, manualItems, caseStats, totalCases, automatedCases, defectCount]);

  const trend = useMemo(() => {
    const days: Record<string, { date: string; automated: number; manual: number; passed: number; failed: number }> = {};
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "MMM d");
      days[d] = { date: d, automated: 0, manual: 0, passed: 0, failed: 0 };
    }
    (runs as any[]).forEach((r) => {
      const k = format(new Date(r.created_at), "MMM d");
      if (!days[k]) return;
      days[k].automated++;
      days[k].passed += Number(r.passed_tests) || 0;
      days[k].failed += Number(r.failed_tests) || 0;
    });
    (sessions as any[]).forEach((s) => {
      const k = format(new Date(s.created_at), "MMM d");
      if (days[k]) days[k].manual++;
    });
    return Object.values(days);
  }, [runs, sessions, rangeDays]);

  const loading = runsQ.isLoading || sessionsQ.isLoading || manualItemsQ.isLoading;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        <Tile label="Total executions" value={metrics.totalExecutions} icon={PlayCircle} tone="text-accent"
          hint={`${metrics.automatedRuns} automated · ${metrics.manualRuns} manual`} />
        <Tile label="Pass rate" value={`${metrics.passRate}%`} icon={CheckCircle2} tone="text-success"
          hint={`${metrics.passed} passed tests`} />
        <Tile label="Failure rate" value={`${metrics.failureRate}%`} icon={XCircle} tone="text-destructive"
          hint={`${metrics.failed} failed · ${metrics.skipped} skipped`} />
        <Tile label="Automation coverage" value={`${metrics.automationPct}%`} icon={Bot} tone="text-info"
          hint={`${automatedCases}/${totalCases} cases`} />
        <Tile label="Defect density" value={metrics.defectDensity} icon={Bug} tone="text-warning"
          hint={`${defectCount} defects / ${totalCases} cases`} />
        <Tile label="Avg execution time" value={fmtDuration(metrics.avgMs)} icon={Timer} tone="text-purple-400"
          hint="finished runs & sessions" />
        <Tile label="Flaky tests" value={metrics.flaky.length} icon={Zap} tone="text-amber-400"
          hint="passed and failed in range" />
      </motion.div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Execution trend</CardTitle>
          <CardDescription>Automated runs, manual sessions and test outcomes per day</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="execPassed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.passed} stopOpacity={0.45} />
                  <stop offset="95%" stopColor={COLORS.passed} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="execFailed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.failed} stopOpacity={0.45} />
                  <stop offset="95%" stopColor={COLORS.failed} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Legend />
              <Area type="monotone" dataKey="passed" stroke={COLORS.passed} fill="url(#execPassed)" />
              <Area type="monotone" dataKey="failed" stroke={COLORS.failed} fill="url(#execFailed)" />
              <Area type="monotone" dataKey="automated" stroke="hsl(var(--accent))" fillOpacity={0.12} fill="hsl(var(--accent))" />
              <Area type="monotone" dataKey="manual" stroke="hsl(var(--muted-foreground))" fillOpacity={0.08} fill="hsl(var(--muted-foreground))" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ListOrdered className="h-4 w-4 text-destructive" /> Top failed test cases
            </CardTitle>
            <CardDescription>Ranked by number of failures in range</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.topFailed.length === 0 ? (
              <Empty label="No failures recorded in this range" />
            ) : (
              <ScrollArea className="max-h-[320px]">
                <div className="space-y-2 pr-2">
                  {metrics.topFailed.map((c, i) => {
                    const pct = c.runs ? Math.round((c.failed / c.runs) * 100) : 0;
                    return (
                      <div key={c.title} className="rounded-md border border-border/50 p-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground">#{i + 1}</span>
                          <span className="flex-1 truncate text-xs">{c.title}</span>
                          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">
                            {c.failed} fail{c.failed > 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <Progress value={pct} className="h-1.5" />
                          <span className="font-mono text-[10px] text-muted-foreground">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" /> Flaky tests
            </CardTitle>
            <CardDescription>Cases that both passed and failed across executions</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.flaky.length === 0 ? (
              <Empty label="No flaky behaviour detected" />
            ) : (
              <ScrollArea className="max-h-[320px]">
                <div className="space-y-2 pr-2">
                  {metrics.flaky.map((c) => (
                    <div key={c.title} className="rounded-md border border-border/50 p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex-1 truncate text-xs">{c.title}</span>
                        <Badge variant="outline" className={cn("text-[10px]",
                          c.flakiness >= 60 ? "text-rose-400 border-rose-500/40" : "text-amber-400 border-amber-500/40")}>
                          {c.flakiness}% flaky
                        </Badge>
                      </div>
                      <div className="mt-1 flex gap-3 font-mono text-[10px] text-muted-foreground">
                        <span className="text-success">{c.passed} passed</span>
                        <span className="text-destructive">{c.failed} failed</span>
                        <span>{c.runs} runs</span>
                        {c.durationMs > 0 && <span>avg {fmtDuration(c.durationMs / c.runs)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Tile({ label, value, icon: Icon, tone, hint }: {
  label: string; value: React.ReactNode; icon: any; tone: string; hint?: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border/50 p-3 bg-gradient-to-br from-accent/5 to-transparent hover:border-accent/40 transition-all">
      <div className="flex items-center justify-between mb-2">
        <Icon className={cn("h-4 w-4", tone)} />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground text-right">{label}</span>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </motion.div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="h-[160px] flex items-center justify-center text-sm text-muted-foreground">{label}</div>;
}

function fmtDuration(ms: number) {
  if (!ms || ms < 1000) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
