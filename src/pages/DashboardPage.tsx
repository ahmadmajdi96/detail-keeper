import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProjectScope } from "@/hooks/useProjectScope";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  SentinelStyles, Scanline, GridBackdrop, ML, Pill, RingProgress, StatTile, Panel,
  StackedBar, statusMeta,
} from "@/components/sentinel/primitives";
import {
  Activity, ArrowRight, Bot, Bug, CheckCircle2, Clock, FileText, FlaskConical,
  Play, Plus, Shield, TestTube, TrendingUp, Zap,
} from "lucide-react";
import { format, startOfDay, subDays } from "date-fns";
import { ExtendedHeatmap } from "@/components/dashboard/ExtendedHeatmap";

const C_CYAN = "#00cfe0";
const C_GREEN = "#22c55e";
const C_RED = "#ff3058";
const C_ORANGE = "#f97316";
const C_PURPLE = "#a855f7";
const C_YELLOW = "#eab308";
const C_TEXT = "#dde8f0";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { projectId, scopeKey } = useProjectScope();
  const { currentWorkspace, currentProject } = useWorkspace();

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
        .limit(100);
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
      passed,
      failed,
      blocked,
      pending: executions.filter((e) => e.status === "pending").length,
      running: executions.filter((e) => e.status === "in_progress").length,
      passRate: Math.round((passed / total) * 100),
      failRate: Math.round((failed / total) * 100),
      blockRate: Math.round((blocked / total) * 100),
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

  const trend = useMemo(() => {
    const arr: { d: string; pass: number; fail: number; total: number; rate: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = startOfDay(subDays(new Date(), i));
      const dayKey = format(day, "MMM dd");
      const dayE = executions.filter((e) => startOfDay(new Date(e.created_at)).getTime() === day.getTime());
      const pass = dayE.filter((e) => e.status === "passed").length;
      const fail = dayE.filter((e) => e.status === "failed").length;
      const t = dayE.length;
      arr.push({ d: dayKey, pass, fail, total: t, rate: t ? Math.round((pass / t) * 100) : 0 });
    }
    return arr;
  }, [executions]);

  const recent = executions.slice(0, 6);
  const scope = currentProject?.name ?? currentWorkspace?.name ?? "All Workspaces";
  const scopeId = currentProject?.id ?? currentWorkspace?.id ?? "global";

  return (
    <AppLayout>
      <SentinelStyles />
      <Scanline />
      <div className="-mx-4 md:-mx-6 -my-6">
        {/* HERO */}
        <div
          className="relative overflow-hidden border-b border-[rgba(0,190,215,0.1)]"
          style={{ background: "linear-gradient(180deg, rgba(0,30,60,0.55) 0%, rgba(4,7,15,0.95) 100%)" }}
        >
          <GridBackdrop opacity={0.04} />
          <div
            className="absolute top-0 left-1/4 w-[420px] h-40 pointer-events-none"
            style={{ background: `radial-gradient(ellipse, ${C_CYAN}22 0%, transparent 70%)`, filter: "blur(24px)" }}
          />
          <div className="relative px-6 md:px-8 py-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00cfe0] sn-glow" />
              <ML>Mission Control · {scope}</ML>
            </div>
            <div className="flex items-start justify-between gap-8 flex-wrap">
              <div className="sn-slide-up">
                <h1 className="font-sans text-3xl font-semibold tracking-tight" style={{ color: "#e8f4f8" }}>
                  Quality Dashboard
                </h1>
                <p className="font-sans text-sm text-[#4a6a88] mt-1 max-w-xl">
                  Real-time intelligence across test cases, executions and defects for the active scope.
                </p>
                <div className="flex items-center gap-4 mt-4">
                  <div className="flex items-center gap-1.5">
                    <Activity size={11} className="text-[#2a4060]" />
                    <span className="sn-mono text-[10px] text-[#2a4060]">
                      {executions.length} runs · last 100
                    </span>
                  </div>
                  <div className="w-px h-4 bg-[rgba(0,190,215,0.1)]" />
                  <div className="flex items-center gap-1.5">
                    <Bot size={11} className="text-[#2a4060]" />
                    <span className="sn-mono text-[10px] text-[#2a4060]">{agents.length} AI agents</span>
                  </div>
                  <div className="w-px h-4 bg-[rgba(0,190,215,0.1)]" />
                  <div className="flex items-center gap-1.5">
                    <Shield size={11} className="text-[#2a4060]" />
                    <span className="sn-mono text-[10px] text-[#2a4060]">scope:{scopeId.slice(0, 8)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6 shrink-0 sn-slide-right">
                <RingProgress pct={metrics.passRate} size={110} stroke={7} color={C_GREEN} label="PASS" />
                <div className="flex flex-col gap-3">
                  <RingProgress pct={metrics.coverage} size={72} stroke={5} color={C_CYAN} label="COV" />
                  <RingProgress pct={metrics.automation} size={72} stroke={5} color={C_PURPLE} label="AI" />
                </div>
              </div>
            </div>

            {/* hero stat strip */}
            <div
              className="grid grid-cols-3 md:grid-cols-7 gap-0 mt-6 rounded-lg border border-[rgba(0,190,215,0.1)] overflow-hidden"
              style={{ background: "rgba(4,8,18,0.8)" }}
            >
              {[
                { v: metrics.tests, l: "TEST CASES", c: C_TEXT },
                { v: metrics.passed, l: "PASSED", c: C_GREEN },
                { v: metrics.failed, l: "FAILED", c: C_RED },
                { v: metrics.blocked, l: "BLOCKED", c: C_ORANGE },
                { v: metrics.running, l: "RUNNING", c: C_CYAN },
                { v: metrics.defects, l: "OPEN DEFECTS", c: metrics.defects > 0 ? C_ORANGE : C_TEXT },
                { v: metrics.critical, l: "CRITICAL", c: metrics.critical > 0 ? C_RED : "#2a4060" },
              ].map((s, i) => (
                <div
                  key={s.l}
                  className="flex flex-col items-center justify-center gap-1 py-3 border-r border-[rgba(0,190,215,0.07)] last:border-0 sn-count-up"
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <span className="sn-mono text-lg font-semibold" style={{ color: s.c }}>
                    {s.v}
                  </span>
                  <ML dim>{s.l}</ML>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="px-6 md:px-8 py-6 space-y-5" style={{ background: "rgba(5,9,18,0.98)" }}>
          {/* KPI ROW */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { l: "PASS RATE", v: `${metrics.passRate}%`, c: metrics.passRate >= 80 ? C_GREEN : C_YELLOW, t: TrendingUp },
              { l: "COVERAGE", v: `${metrics.coverage}%`, c: C_CYAN, t: TestTube },
              { l: "AUTOMATION", v: `${metrics.automation}%`, c: C_PURPLE, t: Bot },
              { l: "DEFECT DENSITY", v: metrics.tests ? (metrics.defects / metrics.tests).toFixed(3) : "0.000", c: C_ORANGE, t: Bug },
            ].map((k, i) => {
              const Icon = k.t;
              return (
                <div
                  key={k.l}
                  className="relative px-5 py-4 rounded-lg border border-[rgba(0,190,215,0.1)] bg-[rgba(7,14,28,0.6)] overflow-hidden sn-slide-up"
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: k.c, opacity: 0.5 }} />
                  <ML dim>{k.l}</ML>
                  <div className="flex items-end justify-between mt-2">
                    <span className="sn-mono text-3xl font-semibold" style={{ color: k.c }}>
                      {k.v}
                    </span>
                    <Icon size={16} style={{ color: k.c, opacity: 0.7 }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* CHARTS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Pass-rate trend */}
            <Panel title="Pass Rate Trend" subtitle={<ML dim>LAST 7 DAYS</ML>}>
              <div className="flex items-end gap-1.5 h-32">
                {trend.map((t, i) => {
                  const last = i === trend.length - 1;
                  const col = t.rate >= 80 ? C_GREEN : t.rate >= 65 ? C_YELLOW : t.total === 0 ? "#1e3548" : C_RED;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                      <div
                        className="w-full rounded-t transition-all duration-500 relative"
                        style={{
                          height: `${Math.max(2, (t.rate / 100) * 110)}px`,
                          background: last ? col : `${col}40`,
                          border: `1px solid ${col}60`,
                          boxShadow: last ? `0 0 10px ${col}60` : "none",
                        }}
                      >
                        <div
                          className="absolute -top-6 left-1/2 -translate-x-1/2 sn-mono text-[8px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap px-1 rounded"
                          style={{ color: col, background: "rgba(4,8,18,0.9)" }}
                        >
                          {t.rate}% · {t.total}
                        </div>
                      </div>
                      <span className="sn-mono text-[8px]" style={{ color: last ? col : "#2a4060" }}>
                        {t.d}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[rgba(0,190,215,0.07)]">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded bg-[#22c55e]" />
                  <ML dim>≥80% GOOD</ML>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded bg-[#eab308]" />
                  <ML dim>≥65% WARN</ML>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded bg-[#ff3058]" />
                  <ML dim>&lt;65% CRIT</ML>
                </div>
              </div>
            </Panel>

            {/* Defect distribution */}
            <Panel title="Defects by Severity" subtitle={<ML dim>TOTAL: {defects.length}</ML>}>
              {(() => {
                const segs = [
                  { label: "CRITICAL", value: defects.filter((d) => d.severity === "critical").length, color: C_RED },
                  { label: "MAJOR", value: defects.filter((d) => d.severity === "major").length, color: C_ORANGE },
                  { label: "MINOR", value: defects.filter((d) => d.severity === "minor").length, color: C_YELLOW },
                  { label: "TRIVIAL", value: defects.filter((d) => d.severity === "trivial").length, color: "#4a6a88" },
                ];
                const total = segs.reduce((s, x) => s + x.value, 0);
                return (
                  <>
                    <StackedBar segments={segs} />
                    <div className="flex flex-col gap-2 mt-4">
                      {segs.map((s) => {
                        const pct = total ? Math.round((s.value / total) * 100) : 0;
                        return (
                          <div key={s.label} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
                              <ML>{s.label}</ML>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-24 h-[2px] bg-[#0a1a2e] rounded overflow-hidden">
                                <div
                                  style={{
                                    width: `${pct}%`,
                                    height: "100%",
                                    background: s.color,
                                    animation: "sn-progress-bar 0.8s ease-out",
                                  }}
                                />
                              </div>
                              <span className="sn-mono text-xs w-10 text-right" style={{ color: s.color }}>
                                {s.value}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </Panel>
          </div>

          {/* QUALITY RING CLUSTER */}
          <Panel title="Quality Metrics Overview">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { pct: metrics.passRate, label: "Pass Rate", color: C_GREEN },
                { pct: metrics.coverage, label: "Coverage", color: C_CYAN },
                { pct: metrics.aiTests, label: "AI Tests", color: C_PURPLE },
                { pct: metrics.failRate, label: "Fail Rate", color: C_RED },
                {
                  pct: defects.length ? Math.round((metrics.resolved / defects.length) * 100) : 100,
                  label: "Resolution",
                  color: C_YELLOW,
                },
              ].map((r, i) => (
                <div
                  key={r.label}
                  className="flex flex-col items-center gap-2 sn-slide-up"
                  style={{ animationDelay: `${i * 0.07}s` }}
                >
                  <RingProgress pct={r.pct} size={96} stroke={6} color={r.color} label={r.label.toUpperCase()} />
                </div>
              ))}
            </div>
          </Panel>

          {/* RECENT ACTIVITY + QUICK ACTIONS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Panel
              className="lg:col-span-2"
              title="Live Execution Stream"
              subtitle={<ML dim>LAST 6 RUNS</ML>}
              action={
                <button
                  onClick={() => navigate("/executions")}
                  className="flex items-center gap-1 sn-mono text-[9px] tracking-widest text-[#4a6a88] hover:text-[#00cfe0] transition"
                >
                  VIEW ALL <ArrowRight size={11} />
                </button>
              }
            >
              <div className="flex flex-col gap-2">
                {recent.length === 0 ? (
                  <div className="py-10 text-center">
                    <Activity className="h-8 w-8 mx-auto text-[#1e3548] mb-2" />
                    <p className="sn-mono text-[10px] text-[#2a4060]">No executions yet</p>
                  </div>
                ) : (
                  recent.map((e, i) => {
                    const sm = statusMeta(e.status);
                    return (
                      <div
                        key={e.id}
                        onClick={() => navigate("/executions")}
                        className="flex items-center gap-4 px-4 py-3 rounded border border-[rgba(0,190,215,0.08)] bg-[rgba(7,14,28,0.4)] hover:border-[rgba(0,190,215,0.2)] cursor-pointer transition-all sn-slide-up"
                        style={{ animationDelay: `${i * 0.05}s` }}
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: `${sm.color}20`, color: sm.color }}
                        >
                          {e.status === "passed" ? (
                            <CheckCircle2 size={11} />
                          ) : e.status === "failed" ? (
                            <Bug size={11} />
                          ) : e.status === "in_progress" ? (
                            <Play size={11} />
                          ) : (
                            <Clock size={11} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-sans text-sm text-[#c0d0e0] truncate">
                            {e.test_case?.title || "Untitled run"}
                          </p>
                          <p className="sn-mono text-[9px] text-[#2a4060]">
                            {format(new Date(e.created_at), "MMM dd · HH:mm")}
                          </p>
                        </div>
                        <Pill label={sm.label} color={sm.color} bg={sm.bg} dot />
                      </div>
                    );
                  })
                )}
              </div>
            </Panel>

            <Panel title="Quick Actions" subtitle={<ML dim>OPERATIONS</ML>}>
              <div className="flex flex-col gap-2">
                {[
                  { l: "NEW TEST CASE", icon: TestTube, to: "/test-cases/new", c: C_CYAN },
                  { l: "RUN EXECUTION", icon: Play, to: "/executions", c: C_GREEN },
                  { l: "AI AGENT", icon: Bot, to: "/automation", c: C_PURPLE },
                  { l: "UPLOAD DOCS", icon: FileText, to: "/documents", c: C_YELLOW },
                  { l: "NEW PROJECT", icon: Plus, to: "/projects?new=1", c: C_ORANGE },
                ].map((a) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.l}
                      onClick={() => navigate(a.to)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded border transition-all text-left group"
                      style={{ borderColor: "rgba(0,190,215,0.12)", background: "rgba(7,14,28,0.4)" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = `${a.c}40`;
                        e.currentTarget.style.background = `${a.c}10`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "rgba(0,190,215,0.12)";
                        e.currentTarget.style.background = "rgba(7,14,28,0.4)";
                      }}
                    >
                      <Icon size={13} style={{ color: a.c }} />
                      <span className="sn-mono text-[10px] tracking-widest text-[#4a6a88] group-hover:text-[#dde8f0] transition-colors">
                        {a.l}
                      </span>
                      <ArrowRight size={11} className="ml-auto text-[#2a4060] group-hover:text-[#00cfe0] transition" />
                    </button>
                  );
                })}
              </div>
            </Panel>
          </div>

          {/* EXTENDED COVERAGE HEATMAP */}
          <ExtendedHeatmap executions={executions as any} days={14} />

          {/* AI INSIGHTS */}

          <Panel
            title="AI Quality Insights"
            subtitle={<ML dim>INTELLIGENT RECOMMENDATIONS</ML>}
          >
            <div className="grid gap-3 md:grid-cols-3">
              {[
                {
                  t: "Coverage Tagging",
                  d: `${testCases.filter((tc) => !tc.coverage_tags?.length).length} cases lack coverage tags.`,
                  v: metrics.coverage,
                  c: C_CYAN,
                  icon: TestTube,
                },
                {
                  t: "AI-Generated Tests",
                  d: `${testCases.filter((tc) => tc.ai_generated).length} of ${testCases.length} are AI-generated.`,
                  v: metrics.aiTests,
                  c: C_PURPLE,
                  icon: Zap,
                },
                {
                  t: "Defect Resolution",
                  d: `${metrics.resolved} of ${defects.length} defects resolved.`,
                  v: defects.length ? Math.round((metrics.resolved / defects.length) * 100) : 100,
                  c: C_GREEN,
                  icon: FlaskConical,
                },
              ].map((i) => {
                const Icon = i.icon;
                return (
                  <div
                    key={i.t}
                    className="rounded border border-[rgba(0,190,215,0.1)] bg-[rgba(4,8,18,0.6)] p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-7 h-7 rounded flex items-center justify-center"
                        style={{ background: `${i.c}15`, color: i.c }}
                      >
                        <Icon size={13} />
                      </div>
                      <p className="font-sans text-sm text-[#dde8f0]">{i.t}</p>
                    </div>
                    <p className="sn-mono text-[10px] text-[#4a6a88] mb-3 leading-relaxed">{i.d}</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-[3px] bg-[#0a1a2e] rounded overflow-hidden">
                        <div
                          style={{
                            width: `${i.v}%`,
                            height: "100%",
                            background: i.c,
                            boxShadow: `0 0 6px ${i.c}`,
                            animation: "sn-progress-bar 0.8s ease-out",
                          }}
                        />
                      </div>
                      <span className="sn-mono text-xs font-semibold" style={{ color: i.c }}>
                        {i.v}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>
    </AppLayout>
  );
}
