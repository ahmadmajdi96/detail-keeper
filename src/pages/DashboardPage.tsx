import { useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useProjectScope } from "@/hooks/useProjectScope";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MetricCard } from "@/components/ui/metric-card";
import { ExecutionTrendsChart } from "@/components/dashboard/ExecutionTrendsChart";
import { DefectMetricsChart } from "@/components/dashboard/DefectMetricsChart";
import { TestCaseStatusChart } from "@/components/dashboard/TestCaseStatusChart";
import { ExtendedHeatmap } from "@/components/dashboard/ExtendedHeatmap";
import { AssignedToMeCard } from "@/components/dashboard/AssignedToMeCard";
import {
  Activity, ArrowRight, Bot, Bug, CheckCircle2, Clock, FileText, FlaskConical,
  Play, Plus, ShieldCheck, Sparkles, TestTube, TrendingUp, Zap,
} from "lucide-react";
import { format, startOfDay, subDays } from "date-fns";

function RingKpi({
  label, value, max = 100, color = "hsl(var(--accent))", suffix = "%", icon,
}: {
  label: string; value: number; max?: number; color?: string; suffix?: string; icon?: React.ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const size = 110;
  const stroke = 8;
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border/50 bg-card/50 hover:bg-card transition-colors">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
          <circle
            cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
            style={{ transition: "stroke-dasharray 0.8s ease-out", filter: `drop-shadow(0 0 6px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {icon && <div className="mb-0.5">{icon}</div>}
          <span className="text-2xl font-bold tracking-tight" style={{ color }}>
            {Math.round(value)}{suffix}
          </span>
        </div>
      </div>
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { projectId, scopeKey } = useProjectScope();
  const { currentProject, currentWorkspace, workspaces, loading: wsLoading } = useWorkspace();
  const { user } = useAuth();

  // Onboarding gate: first-run users (no workspaces + never completed onboarding) → /onboarding
  const { data: onboardingCheck } = useQuery({
    queryKey: ["onboarding-check", user?.id],
    enabled: !!user?.id && !wsLoading,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("onboarding_completed_at").eq("id", user!.id).maybeSingle();
      return { completed: !!data?.onboarding_completed_at };
    },
  });
  useEffect(() => {
    if (onboardingCheck && !onboardingCheck.completed && !wsLoading && workspaces.length === 0) {
      navigate("/onboarding", { replace: true });
    }
  }, [onboardingCheck, wsLoading, workspaces.length, navigate]);


  const { data: testCases = [] } = useQuery({
    queryKey: ["dashboard-test-cases", ...scopeKey],
    queryFn: async () => {
      let q = supabase.from("test_cases").select("id, status, ai_generated, coverage_tags");
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: executions = [] } = useQuery({
    queryKey: ["dashboard-executions", ...scopeKey],
    queryFn: async () => {
      let q = supabase
        .from("test_executions")
        .select("id, status, created_at, completed_at, test_case_id, test_case:test_cases(title, coverage_tags)")
        .order("created_at", { ascending: false })
        .limit(150);
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: defects = [] } = useQuery({
    queryKey: ["dashboard-defects", ...scopeKey],
    queryFn: async () => {
      let q = supabase.from("defects").select("id, severity, status, priority, created_at");
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["dashboard-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agents")
        .select("id, status, learning_progress, success_rate, total_executions");
      if (error) throw error;
      return data;
    },
  });

  const metrics = useMemo(() => {
    const passed = executions.filter((e) => e.status === "passed").length;
    const failed = executions.filter((e) => e.status === "failed").length;
    const blocked = executions.filter((e) => e.status === "blocked").length;
    const total = executions.length || 1;
    return {
      tests: testCases.length,
      active: testCases.filter((t) => t.status === "active").length,
      passed, failed, blocked,
      running: executions.filter((e) => e.status === "in_progress").length,
      passRate: Math.round((passed / total) * 100),
      failRate: Math.round((failed / total) * 100),
      defects: defects.filter((d) => d.status !== "resolved").length,
      critical: defects.filter((d) => d.severity === "critical" && d.status !== "resolved").length,
      resolved: defects.filter((d) => d.status === "resolved").length,
      automation: agents.length
        ? Math.round(agents.reduce((a, c) => a + (c.learning_progress || 0), 0) / agents.length)
        : 0,
      aiTests: testCases.length
        ? Math.round((testCases.filter((t) => t.ai_generated).length / testCases.length) * 100)
        : 0,
      coverage: testCases.length
        ? Math.round((testCases.filter((t) => t.coverage_tags?.length).length / testCases.length) * 100)
        : 0,
    };
  }, [testCases, executions, defects, agents]);

  const trendData = useMemo(() => {
    const arr: { date: string; passed: number; failed: number; blocked: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = startOfDay(subDays(new Date(), i));
      const dayE = executions.filter((e) => startOfDay(new Date(e.created_at)).getTime() === day.getTime());
      arr.push({
        date: format(day, "MMM dd"),
        passed: dayE.filter((e) => e.status === "passed").length,
        failed: dayE.filter((e) => e.status === "failed").length,
        blocked: dayE.filter((e) => e.status === "blocked").length,
      });
    }
    return arr;
  }, [executions]);

  const defectChartData = useMemo(() => ([
    { name: "Critical", value: defects.filter((d) => d.severity === "critical").length, color: "hsl(var(--destructive))" },
    { name: "Major", value: defects.filter((d) => d.severity === "major").length, color: "hsl(38 92% 50%)" },
    { name: "Minor", value: defects.filter((d) => d.severity === "minor").length, color: "hsl(var(--warning))" },
    { name: "Trivial", value: defects.filter((d) => d.severity === "trivial").length, color: "hsl(var(--muted-foreground))" },
  ]), [defects]);

  const tcStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    testCases.forEach((t) => { counts[t.status || "draft"] = (counts[t.status || "draft"] || 0) + 1; });
    const palette: Record<string, string> = {
      active: "hsl(var(--success))",
      draft: "hsl(var(--muted-foreground))",
      review: "hsl(var(--warning))",
      archived: "hsl(var(--destructive))",
    };
    return Object.entries(counts).map(([k, v]) => ({
      name: k.charAt(0).toUpperCase() + k.slice(1),
      value: v,
      color: palette[k] || "hsl(var(--accent))",
    }));
  }, [testCases]);

  const recent = executions.slice(0, 6);
  const scopeLabel = currentProject?.name ?? currentWorkspace?.name ?? "All Workspaces";

  const recentStatusMeta = (s: string | null) => {
    switch (s) {
      case "passed":      return { label: "Passed",   icon: <CheckCircle2 className="h-3.5 w-3.5" />, cls: "bg-success/10 text-success border-success/20" };
      case "failed":      return { label: "Failed",   icon: <Bug className="h-3.5 w-3.5" />,          cls: "bg-destructive/10 text-destructive border-destructive/20" };
      case "in_progress": return { label: "Running",  icon: <Play className="h-3.5 w-3.5" />,         cls: "bg-accent/10 text-accent border-accent/20" };
      case "blocked":     return { label: "Blocked",  icon: <Clock className="h-3.5 w-3.5" />,        cls: "bg-warning/10 text-warning border-warning/20" };
      default:            return { label: "Pending",  icon: <Clock className="h-3.5 w-3.5" />,        cls: "bg-muted text-muted-foreground border-border" };
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Quality Dashboard"
        description={`Real-time intelligence across test cases, executions and defects · ${scopeLabel}`}
        isAIPowered
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate("/executions")}>
              <Activity className="h-4 w-4 mr-2" /> Live executions
            </Button>
            <Button size="sm" onClick={() => navigate("/test-cases/new")}>
              <Plus className="h-4 w-4 mr-2" /> New test case
            </Button>
          </>
        }
      />

      {/* Quality Metrics Overview (replaces the old KPI card row) */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                Quality Metrics Overview
              </CardTitle>
              <CardDescription>Live snapshot of {scopeLabel}</CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              {executions.length} runs · last 150
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <RingKpi label="Pass Rate" value={metrics.passRate} color="hsl(var(--success))" icon={<CheckCircle2 className="h-3.5 w-3.5 text-success" />} />
              <RingKpi label="Coverage" value={metrics.coverage} color="hsl(var(--accent))" icon={<TestTube className="h-3.5 w-3.5 text-accent" />} />
              <RingKpi label="AI Tests" value={metrics.aiTests} color="hsl(262 83% 58%)" icon={<Zap className="h-3.5 w-3.5" style={{ color: "hsl(262 83% 58%)" }} />} />
              <RingKpi label="Automation" value={metrics.automation} color="hsl(199 89% 48%)" icon={<Bot className="h-3.5 w-3.5" style={{ color: "hsl(199 89% 48%)" }} />} />
              <RingKpi
                label="Resolution"
                value={defects.length ? Math.round((metrics.resolved / defects.length) * 100) : 100}
                color="hsl(38 92% 50%)"
                icon={<ShieldCheck className="h-3.5 w-3.5" style={{ color: "hsl(38 92% 50%)" }} />}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-border/50 pt-4">
              {[
                { l: "Test cases", v: testCases.length, i: <TestTube className="h-4 w-4 text-accent" />, to: "/test-cases" },
                { l: "Executions", v: executions.length, i: <Activity className="h-4 w-4 text-accent" />, to: "/executions" },
                { l: "Open defects", v: metrics.defects, i: <Bug className="h-4 w-4 text-destructive" />, to: "/defects" },
                { l: "Critical", v: metrics.critical, i: <ShieldCheck className="h-4 w-4 text-warning" />, to: "/defects" },
              ].map((s) => (
                <button
                  key={s.l}
                  onClick={() => navigate(s.to)}
                  className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 px-3 py-2.5 text-left hover:border-accent/40 hover:bg-accent/5 transition-colors"
                >
                  {s.i}
                  <div className="min-w-0">
                    <p className="text-lg font-semibold tabular-nums leading-none">{s.v}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{s.l}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>


      {/* Charts row */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <ExecutionTrendsChart data={trendData} />
        <DefectMetricsChart data={defectChartData} />
        <AssignedToMeCard />
      </div>


      {/* Extended heatmap */}
      <div className="mt-6">
        <ExtendedHeatmap executions={executions as any} days={14} />
      </div>

      {/* Test case status + recent + quick actions */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <TestCaseStatusChart data={tcStatusData} />

        <Card className="border-border/50 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-4 w-4 text-accent" />
                Live Execution Stream
              </CardTitle>
              <CardDescription>Last {recent.length} runs</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/executions")}>
              View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <div className="py-10 text-center">
                <Activity className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No executions yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {recent.map((e, i) => {
                  const sm = recentStatusMeta(e.status);
                  return (
                    <motion.div
                      key={e.id}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                      onClick={() => navigate("/executions")}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/50 bg-card/50 hover:bg-card hover:border-accent/30 cursor-pointer transition-all"
                    >
                      <Badge className={`gap-1 ${sm.cls}`} variant="outline">
                        {sm.icon} {sm.label}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {e.test_case?.title || "Untitled run"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(e.created_at), "MMM dd · HH:mm")}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Insights + Quick Actions */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {isManager && (
        <Card className="border-border/50 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" /> AI Quality Insights
            </CardTitle>
            <CardDescription>Intelligent recommendations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                {
                  t: "Coverage Tagging",
                  d: `${testCases.filter((tc) => !tc.coverage_tags?.length).length} cases lack coverage tags.`,
                  v: metrics.coverage, c: "hsl(var(--accent))", icon: <TestTube className="h-4 w-4" />,
                },
                {
                  t: "AI-Generated Tests",
                  d: `${testCases.filter((tc) => tc.ai_generated).length} of ${testCases.length} are AI-generated.`,
                  v: metrics.aiTests, c: "hsl(262 83% 58%)", icon: <Zap className="h-4 w-4" />,
                },
                {
                  t: "Defect Resolution",
                  d: `${metrics.resolved} of ${defects.length} defects resolved.`,
                  v: defects.length ? Math.round((metrics.resolved / defects.length) * 100) : 100,
                  c: "hsl(var(--success))", icon: <FlaskConical className="h-4 w-4" />,
                },
              ].map((i) => (
                <div key={i.t} className="rounded-lg border border-border/50 bg-card/50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-md flex items-center justify-center"
                      style={{ background: `color-mix(in hsl, ${i.c} 12%, transparent)`, color: i.c }}>
                      {i.icon}
                    </div>
                    <p className="text-sm font-medium">{i.t}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{i.d}</p>
                  <div className="flex items-center gap-3">
                    <Progress value={i.v} className="h-1.5 flex-1" />
                    <span className="text-sm font-semibold tabular-nums" style={{ color: i.c }}>{i.v}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        )}

        <Card className={`border-border/50${isManager ? "" : " lg:col-span-3"}`}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent" /> Quick Actions
            </CardTitle>
            <CardDescription>Operations</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {[
              { l: "New test case", icon: TestTube, to: "/test-cases/new" },
              { l: "Run execution", icon: Play, to: "/executions" },
              { l: "AI agent", icon: Bot, to: "/automation" },
              { l: "Upload docs", icon: FileText, to: "/documents" },
              ...(isManager ? [{ l: "New project", icon: Plus, to: "/projects?new=1" }] : []),
            ].map((a) => {

              const Icon = a.icon;
              return (
                <Button
                  key={a.l}
                  variant="outline"
                  className="justify-start group hover:border-accent/40 hover:bg-accent/5"
                  onClick={() => navigate(a.to)}
                >
                  <Icon className="h-4 w-4 mr-2 text-accent" />
                  {a.l}
                  <ArrowRight className="h-3.5 w-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </Button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
