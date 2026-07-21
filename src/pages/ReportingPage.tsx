import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjectScope } from "@/hooks/useProjectScope";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, LineChart, Line, PieChart as RPieChart, Pie, Cell, Legend,
  RadialBarChart, RadialBar,
} from "recharts";
import {
  Download, RefreshCw, TrendingUp, TrendingDown, Bug, TestTube, CheckCircle,
  AlertTriangle, Target, Sparkles, Loader2, FileSpreadsheet, FileJson, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { toast } from "sonner";
import { format, subDays, startOfDay } from "date-fns";

type Range = "7d" | "30d" | "90d";
const RANGE_DAYS: Record<Range, number> = { "7d": 7, "30d": 30, "90d": 90 };

const COLORS = {
  passed: "hsl(var(--success))",
  failed: "hsl(var(--destructive))",
  blocked: "hsl(var(--warning))",
  pending: "hsl(var(--muted-foreground))",
  accent: "hsl(var(--accent))",
};
const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444", major: "#f97316", minor: "#eab308", trivial: "#3b82f6",
};

export default function ReportingPage() {
  const { projectId, workspaceId, scopeKey } = useProjectScope();
  const { currentProject, currentWorkspace } = useWorkspace();
  const [range, setRange] = useState<Range>("30d");
  const [tab, setTab] = useState("overview");

  const since = useMemo(() => startOfDay(subDays(new Date(), RANGE_DAYS[range])).toISOString(), [range]);
  const scopeLabel = currentProject?.name || currentWorkspace?.name || "All data";

  // --- EXECUTIONS ---
  const execQ = useQuery({
    queryKey: ["report-executions", scopeKey, range],
    enabled: !!workspaceId,
    queryFn: async () => {
      let qb = supabase
        .from("test_executions")
        .select("id,status,completed_at,started_at,created_at,executor_id,project_id")
        .gte("created_at", since)
        .limit(5000);
      if (projectId) qb = qb.eq("project_id", projectId);
      else if (workspaceId) qb = qb.eq("workspace_id", workspaceId);
      const { data, error } = await qb;
      if (error) throw error;
      return data || [];
    },
  });

  // --- DEFECTS ---
  const defectQ = useQuery({
    queryKey: ["report-defects", scopeKey, range],
    enabled: !!workspaceId,
    queryFn: async () => {
      let qb = supabase
        .from("defects")
        .select("id,severity,priority,status,created_at,resolved_at,assigned_to,project_id")
        .gte("created_at", since)
        .limit(5000);
      if (projectId) qb = qb.eq("project_id", projectId);
      else if (workspaceId) qb = qb.eq("workspace_id", workspaceId);
      const { data, error } = await qb;
      if (error) throw error;
      return data || [];
    },
  });

  // --- TEST CASES ---
  const caseQ = useQuery({
    queryKey: ["report-cases", scopeKey],
    enabled: !!workspaceId,
    queryFn: async () => {
      let qb = supabase
        .from("test_cases")
        .select("id,status,automation_status,ai_generated,priority,project_id,created_at")
        .limit(5000);
      if (projectId) qb = qb.eq("project_id", projectId);
      else if (workspaceId) qb = qb.eq("workspace_id", workspaceId);
      const { data, error } = await qb;
      if (error) throw error;
      return data || [];
    },
  });

  const executions = execQ.data || [];
  const defects = defectQ.data || [];
  const cases = caseQ.data || [];

  // --- Metrics ---
  const metrics = useMemo(() => {
    const total = executions.length;
    const passed = executions.filter((e) => e.status === "passed").length;
    const failed = executions.filter((e) => e.status === "failed").length;
    const blocked = executions.filter((e) => e.status === "blocked").length;
    const passRate = total ? Math.round((passed / total) * 100) : 0;
    const openDefects = defects.filter((d) => !["resolved", "closed"].includes(d.status)).length;
    const critical = defects.filter((d) => d.severity === "critical" && !["closed", "resolved"].includes(d.status)).length;
    const automated = cases.filter((c) => c.automation_status === "automated").length;
    const automationPct = cases.length ? Math.round((automated / cases.length) * 100) : 0;
    const aiCases = cases.filter((c) => c.ai_generated).length;

    // Avg resolution time in hours
    const resolved = defects.filter((d) => d.resolved_at);
    const avgHours = resolved.length
      ? Math.round(
          resolved.reduce((s, d) => {
            const diff = new Date(d.resolved_at!).getTime() - new Date(d.created_at).getTime();
            return s + diff / 3_600_000;
          }, 0) / resolved.length,
        )
      : 0;

    return { total, passed, failed, blocked, passRate, openDefects, critical, automated, automationPct, aiCases, avgHours };
  }, [executions, defects, cases]);

  // --- Trend data (daily) ---
  const trend = useMemo(() => {
    const days: Record<string, { date: string; passed: number; failed: number; blocked: number; defects: number }> = {};
    const dayCount = RANGE_DAYS[range];
    for (let i = dayCount - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "MMM d");
      days[d] = { date: d, passed: 0, failed: 0, blocked: 0, defects: 0 };
    }
    executions.forEach((e) => {
      const d = format(new Date(e.created_at), "MMM d");
      if (!days[d]) return;
      if (e.status === "passed") days[d].passed++;
      else if (e.status === "failed") days[d].failed++;
      else if (e.status === "blocked") days[d].blocked++;
    });
    defects.forEach((d) => {
      const k = format(new Date(d.created_at), "MMM d");
      if (days[k]) days[k].defects++;
    });
    return Object.values(days);
  }, [executions, defects, range]);

  const statusPie = useMemo(
    () => [
      { name: "Passed", value: metrics.passed, color: COLORS.passed },
      { name: "Failed", value: metrics.failed, color: COLORS.failed },
      { name: "Blocked", value: metrics.blocked, color: COLORS.blocked },
      { name: "Other", value: Math.max(0, metrics.total - metrics.passed - metrics.failed - metrics.blocked), color: COLORS.pending },
    ].filter((s) => s.value > 0),
    [metrics],
  );

  const severityBars = useMemo(() => {
    const buckets: Record<string, number> = { critical: 0, major: 0, minor: 0, trivial: 0 };
    defects.forEach((d) => { if (buckets[d.severity] !== undefined) buckets[d.severity]++; });
    return Object.entries(buckets).map(([severity, count]) => ({ severity, count, fill: SEVERITY_COLORS[severity] }));
  }, [defects]);

  const automationRing = useMemo(() => [{ name: "Automated", value: metrics.automationPct, fill: COLORS.accent }], [metrics.automationPct]);

  // --- Export ---
  function exportCsv() {
    const headers = ["metric", "value"];
    const rows: [string, string | number][] = [
      ["scope", scopeLabel], ["range", range],
      ["total_executions", metrics.total], ["passed", metrics.passed],
      ["failed", metrics.failed], ["blocked", metrics.blocked],
      ["pass_rate_pct", metrics.passRate], ["open_defects", metrics.openDefects],
      ["critical_defects", metrics.critical], ["automation_pct", metrics.automationPct],
      ["ai_generated_cases", metrics.aiCases], ["avg_resolution_hours", metrics.avgHours],
    ];
    const esc = (v: any) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
    downloadBlob(csv, `report-${slug(scopeLabel)}-${range}-${format(new Date(), "yyyyMMdd")}.csv`, "text/csv");
    toast.success("CSV exported");
  }
  function exportJson() {
    const payload = { scope: scopeLabel, range, generated_at: new Date().toISOString(), metrics, trend, severityBars, statusPie };
    downloadBlob(JSON.stringify(payload, null, 2), `report-${slug(scopeLabel)}-${range}.json`, "application/json");
    toast.success("JSON exported");
  }

  const loading = execQ.isLoading || defectQ.isLoading || caseQ.isLoading;

  return (
    <AppLayout>
      <PageHeader
        title="Reports & Analytics"
        description={`Live quality insights — ${scopeLabel}`}
        actions={
          <div className="flex items-center gap-2">
            <Select value={range} onValueChange={(v) => setRange(v as Range)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => { execQ.refetch(); defectQ.refetch(); caseQ.refetch(); }}>
              <RefreshCw className="h-4 w-4 mr-1" /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportJson}>
              <FileJson className="h-4 w-4 mr-1" /> JSON
            </Button>
          </div>
        }
      />

      {/* Scope banner */}
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="font-mono">{currentProject ? "PROJECT" : currentWorkspace ? "WORKSPACE" : "ORG"}</Badge>
        <span>{scopeLabel}</span>
        {currentProject && <span className="text-muted-foreground/60">· switch project in the top nav to change scope</span>}
      </div>

      {/* KPI cards */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mt-4">
        <Kpi label="Executions"  value={metrics.total}       icon={TestTube}     color="text-accent"    hint={`${range}`} />
        <Kpi label="Pass rate"   value={`${metrics.passRate}%`} icon={CheckCircle} color="text-success" hint={`${metrics.passed}/${metrics.total || 0} passed`} trend={metrics.passRate >= 80 ? "up" : "down"} />
        <Kpi label="Failed"      value={metrics.failed}      icon={TrendingDown} color="text-destructive" hint={`${metrics.blocked} blocked`} />
        <Kpi label="Open defects" value={metrics.openDefects} icon={Bug}          color="text-warning"    hint={`${metrics.critical} critical`} />
        <Kpi label="Automation"  value={`${metrics.automationPct}%`} icon={Target} color="text-info"     hint={`${metrics.automated}/${cases.length} cases`} />
        <Kpi label="AI generated" value={metrics.aiCases}    icon={Sparkles}     color="text-purple-400" hint={`${cases.length ? Math.round(metrics.aiCases/cases.length*100) : 0}% of cases`} />
      </motion.div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="defects">Defects</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
        </TabsList>

        {loading && (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        )}

        {!loading && (
          <>
            <TabsContent value="overview" className="grid gap-4 md:grid-cols-3 mt-4">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Execution trends</CardTitle>
                  <CardDescription>Daily results over the last {RANGE_DAYS[range]} days</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={trend}>
                      <defs>
                        <linearGradient id="passedG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.passed} stopOpacity={0.5}/>
                          <stop offset="95%" stopColor={COLORS.passed} stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="failedG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.failed} stopOpacity={0.5}/>
                          <stop offset="95%" stopColor={COLORS.failed} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Legend />
                      <Area type="monotone" dataKey="passed" stroke={COLORS.passed} fillOpacity={1} fill="url(#passedG)" />
                      <Area type="monotone" dataKey="failed" stroke={COLORS.failed} fillOpacity={1} fill="url(#failedG)" />
                      <Area type="monotone" dataKey="blocked" stroke={COLORS.blocked} fillOpacity={0.3} fill={COLORS.blocked} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Status distribution</CardTitle>
                  <CardDescription>All executions in range</CardDescription>
                </CardHeader>
                <CardContent>
                  {statusPie.length ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <RPieChart>
                        <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                          {statusPie.map((s, i) => <Cell key={i} fill={s.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                        <Legend />
                      </RPieChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart label="No executions yet" />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quality" className="grid gap-4 md:grid-cols-2 mt-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Pass / fail over time</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Legend />
                      <Line type="monotone" dataKey="passed" stroke={COLORS.passed} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="failed" stroke={COLORS.failed} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Coverage snapshot</CardTitle>
                  <CardDescription>Test cases by status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {["active", "draft", "deprecated", "archived"].map((s) => {
                    const count = cases.filter((c) => c.status === s).length;
                    const pct = cases.length ? Math.round((count / cases.length) * 100) : 0;
                    return (
                      <div key={s}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="capitalize">{s}</span>
                          <span className="text-muted-foreground">{count} · {pct}%</span>
                        </div>
                        <Progress value={pct} />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="defects" className="grid gap-4 md:grid-cols-3 mt-4">
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Defects by severity</CardTitle>
                  <CardDescription>Total in range</CardDescription>
                </CardHeader>
                <CardContent>
                  {defects.length ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={severityBars}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="severity" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                          {severityBars.map((b, i) => <Cell key={i} fill={b.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart label="No defects logged in range" />
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Resolution</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <StatRow label="Open" value={metrics.openDefects} icon={AlertTriangle} tone="warning" />
                  <StatRow label="Critical" value={metrics.critical} icon={Bug} tone="destructive" />
                  <StatRow label="Avg resolution" value={`${metrics.avgHours}h`} icon={CheckCircle} tone="success" />
                  <StatRow label="Total in range" value={defects.length} icon={TrendingUp} tone="info" />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="automation" className="grid gap-4 md:grid-cols-2 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Automation coverage</CardTitle>
                  <CardDescription>Automated vs manual cases</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={280}>
                    <RadialBarChart innerRadius="60%" outerRadius="100%" data={automationRing} startAngle={90} endAngle={-270}>
                      <RadialBar background dataKey="value" cornerRadius={10} fill={COLORS.accent} />
                      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
                            className="fill-foreground text-3xl font-bold">
                        {metrics.automationPct}%
                      </text>
                    </RadialBarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">By automation status</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {["automated", "in_progress", "manual"].map((s) => {
                    const count = cases.filter((c) => c.automation_status === s).length;
                    const pct = cases.length ? Math.round((count / cases.length) * 100) : 0;
                    return (
                      <div key={s}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="capitalize">{s.replace("_", " ")}</span>
                          <span className="text-muted-foreground">{count} · {pct}%</span>
                        </div>
                        <Progress value={pct} />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>
    </AppLayout>
  );
}

function Kpi({
  label, value, icon: Icon, color, hint, trend,
}: { label: string; value: React.ReactNode; icon: any; color: string; hint?: string; trend?: "up" | "down" }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border/50 p-3 bg-gradient-to-br from-accent/5 to-transparent hover:border-accent/40 transition-all">
      <div className="flex items-center justify-between mb-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-semibold flex items-center gap-1">
        {value}
        {trend === "up" && <ArrowUpRight className="h-4 w-4 text-success" />}
        {trend === "down" && <ArrowDownRight className="h-4 w-4 text-destructive" />}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </motion.div>
  );
}

function StatRow({ label, value, icon: Icon, tone }: { label: string; value: React.ReactNode; icon: any; tone: string }) {
  const cls = tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : tone === "success" ? "text-success" : "text-info";
  return (
    <div className="flex items-center justify-between p-3 rounded-md bg-muted/30">
      <div className="flex items-center gap-2 text-sm">
        <Icon className={`h-4 w-4 ${cls}`} />
        <span>{label}</span>
      </div>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">{label}</div>;
}

function downloadBlob(text: string, filename: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "report";
}
