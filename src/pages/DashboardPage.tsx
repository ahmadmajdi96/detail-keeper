import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TestTube,
  CheckCircle,
  AlertTriangle,
  Bug,
  Bot,
  Clock,
  ArrowRight,
  TrendingUp,
  FileText,
  Play,
} from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const navigate = useNavigate();

  // Fetch test cases count
  const { data: testCases = [] } = useQuery({
    queryKey: ["dashboard-test-cases"],
    queryFn: async () => {
      const { data, error } = await supabase.from("test_cases").select("id, status, ai_generated, coverage_tags");
      if (error) throw error;
      return data;
    },
  });

  // Fetch executions
  const { data: executions = [] } = useQuery({
    queryKey: ["dashboard-executions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_executions")
        .select("id, status, created_at, test_case:test_cases(title)")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  // Fetch defects
  const { data: defects = [] } = useQuery({
    queryKey: ["dashboard-defects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("defects").select("id, severity, status");
      if (error) throw error;
      return data;
    },
  });

  // Fetch AI agents
  const { data: agents = [] } = useQuery({
    queryKey: ["dashboard-agents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_agents").select("id, status, learning_progress");
      if (error) throw error;
      return data;
    },
  });

  // Fetch pending test cases (pending executions)
  const { data: pendingExecutions = [] } = useQuery({
    queryKey: ["dashboard-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_executions")
        .select("id, test_case:test_cases(title)")
        .eq("status", "pending")
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  // Calculate metrics
  const metrics = {
    total_test_cases: testCases.length,
    active_test_cases: testCases.filter((tc) => tc.status === "active").length,
    pass_rate: executions.length > 0
      ? Math.round((executions.filter((e) => e.status === "passed").length / executions.length) * 100 * 10) / 10
      : 0,
    active_executions: executions.filter((e) => e.status === "in_progress").length,
    pending_assignments: pendingExecutions.length,
    total_defects: defects.filter((d) => d.status === "open" || d.status === "in_progress").length,
    critical_defects: defects.filter((d) => d.severity === "critical" && d.status !== "resolved").length,
    automation_coverage: agents.length > 0
      ? Math.round(agents.reduce((acc, a) => acc + a.learning_progress, 0) / agents.length)
      : 0,
  };

  const recentExecutions = executions.slice(0, 5).map((exec) => ({
    id: exec.id,
    name: exec.test_case?.title || "Unknown Test",
    status: exec.status,
    time: formatTimeAgo(new Date(exec.created_at)),
  }));

  function formatTimeAgo(date: Date) {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "passed": return "success";
      case "failed": return "destructive";
      case "in_progress": return "info";
      case "blocked": return "warning";
      default: return "default";
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Dashboard"
        description="Quality metrics and testing overview"
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Metrics Grid */}
        <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Test Coverage"
            value={testCases.filter((tc) => tc.coverage_tags?.length).length}
            suffix={` / ${testCases.length}`}
            icon={<TestTube className="h-5 w-5" />}
            description="Cases with coverage tags"
            variant="accent"
          />
          <MetricCard
            label="Pass Rate"
            value={metrics.pass_rate}
            suffix="%"
            icon={<CheckCircle className="h-5 w-5" />}
            description="Recent executions"
            variant="success"
          />
          <MetricCard
            label="Active Executions"
            value={metrics.active_executions}
            icon={<Play className="h-5 w-5" />}
            description="Currently running"
          />
          <MetricCard
            label="Critical Defects"
            value={metrics.critical_defects}
            icon={<Bug className="h-5 w-5" />}
            description="Open critical issues"
            variant={metrics.critical_defects > 0 ? "destructive" : "success"}
          />
        </motion.div>

        {/* Secondary Metrics */}
        <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total Test Cases"
            value={metrics.total_test_cases}
            icon={<FileText className="h-5 w-5" />}
            description={`${metrics.active_test_cases} active`}
          />
          <MetricCard
            label="Pending Executions"
            value={metrics.pending_assignments}
            icon={<Clock className="h-5 w-5" />}
            description="Awaiting action"
            variant="warning"
          />
          <MetricCard
            label="AI Learning Progress"
            value={metrics.automation_coverage}
            suffix="%"
            icon={<Bot className="h-5 w-5" />}
            description={`${agents.length} agents`}
          />
          <MetricCard
            label="Open Defects"
            value={metrics.total_defects}
            icon={<AlertTriangle className="h-5 w-5" />}
            description="Across all projects"
          />
        </motion.div>

        {/* Recent Executions & AI Insights */}
        <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-2">
          {/* Recent Executions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-lg">Recent Executions</CardTitle>
                <CardDescription>Latest test run results</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-accent" onClick={() => navigate("/executions")}>
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentExecutions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No recent executions</p>
                ) : (
                  recentExecutions.map((execution) => (
                    <div
                      key={execution.id}
                      className="flex items-center justify-between rounded-lg border border-border/50 p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate("/executions")}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-2 w-2 rounded-full ${
                          execution.status === "passed" ? "bg-success" :
                          execution.status === "failed" ? "bg-destructive" :
                          execution.status === "in_progress" ? "bg-info animate-pulse" :
                          "bg-muted-foreground"
                        }`} />
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{execution.name}</p>
                          <p className="text-xs text-muted-foreground">{execution.time}</p>
                        </div>
                      </div>
                      <StatusBadge variant={getStatusVariant(execution.status)} size="sm">
                        {execution.status.replace("_", " ")}
                      </StatusBadge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
                <CardDescription>Start testing quickly</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/test-cases")}>
                  <TestTube className="mr-2 h-4 w-4" />
                  Create New Test Case
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/executions")}>
                  <Play className="mr-2 h-4 w-4" />
                  Start Test Execution
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/automation")}>
                  <Bot className="mr-2 h-4 w-4" />
                  Configure AI Agent
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => navigate("/documents")}>
                  <FileText className="mr-2 h-4 w-4" />
                  Upload Documents
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* AI Insights */}
        <motion.div variants={itemVariants}>
          <Card className="border-accent/20 bg-gradient-to-r from-accent/5 to-transparent">
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg ai-gradient">
                  <TrendingUp className="h-4 w-4 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">AI Quality Insights</CardTitle>
                  <CardDescription>Intelligent recommendations for your testing</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <h4 className="font-medium text-sm mb-1">Test Case Coverage</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    {testCases.filter((tc) => !tc.coverage_tags?.length).length} test cases lack coverage tags. Add tags for better tracking.
                  </p>
                  <Progress value={testCases.length > 0 ? (testCases.filter((tc) => tc.coverage_tags?.length).length / testCases.length) * 100 : 0} className="h-1.5" />
                </div>
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <h4 className="font-medium text-sm mb-1">AI-Generated Tests</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    {testCases.filter((tc) => tc.ai_generated).length} of {testCases.length} test cases were AI-generated.
                  </p>
                  <Progress value={testCases.length > 0 ? (testCases.filter((tc) => tc.ai_generated).length / testCases.length) * 100 : 0} className="h-1.5" />
                </div>
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <h4 className="font-medium text-sm mb-1">Defect Resolution</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    {defects.filter((d) => d.status === "resolved").length} of {defects.length} defects resolved.
                  </p>
                  <Progress value={defects.length > 0 ? (defects.filter((d) => d.status === "resolved").length / defects.length) * 100 : 0} className="h-1.5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}
