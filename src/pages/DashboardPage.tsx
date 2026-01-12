import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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

// Mock data
const metrics = {
  test_coverage: 78,
  pass_rate: 94.2,
  active_executions: 12,
  pending_assignments: 8,
  total_test_cases: 1247,
  total_defects: 23,
  critical_defects: 3,
  automation_coverage: 62,
};

const recentExecutions = [
  { id: 1, name: "Login Flow Regression", status: "passed", time: "2 min ago", coverage: 100 },
  { id: 2, name: "Payment Gateway Integration", status: "in_progress", time: "5 min ago", coverage: 67 },
  { id: 3, name: "User Profile CRUD", status: "passed", time: "12 min ago", coverage: 100 },
  { id: 4, name: "API Rate Limiting", status: "failed", time: "25 min ago", coverage: 45 },
  { id: 5, name: "Dashboard Widgets", status: "passed", time: "1 hour ago", coverage: 100 },
];

const upcomingRuns = [
  { id: 1, name: "E2E Checkout Flow", assignee: "Sarah M.", scheduledFor: "Today, 3:00 PM", priority: "high" },
  { id: 2, name: "API Security Audit", assignee: "James L.", scheduledFor: "Tomorrow, 9:00 AM", priority: "critical" },
  { id: 3, name: "Mobile Responsive Tests", assignee: "Anna K.", scheduledFor: "Tomorrow, 2:00 PM", priority: "medium" },
];

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
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "passed": return "success";
      case "failed": return "destructive";
      case "in_progress": return "info";
      case "blocked": return "warning";
      default: return "default";
    }
  };

  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case "critical": return "destructive";
      case "high": return "warning";
      case "medium": return "info";
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
            value={metrics.test_coverage}
            suffix="%"
            icon={<TestTube className="h-5 w-5" />}
            trend={5.2}
            trendLabel="vs last week"
            variant="accent"
          />
          <MetricCard
            label="Pass Rate"
            value={metrics.pass_rate}
            suffix="%"
            icon={<CheckCircle className="h-5 w-5" />}
            trend={2.1}
            trendLabel="vs last week"
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
            trend={-25}
            trendLabel="vs last week"
            variant={metrics.critical_defects > 0 ? "destructive" : "success"}
          />
        </motion.div>

        {/* Secondary Metrics */}
        <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total Test Cases"
            value={metrics.total_test_cases.toLocaleString()}
            icon={<FileText className="h-5 w-5" />}
            trend={12}
            trendLabel="new this week"
          />
          <MetricCard
            label="Pending Assignments"
            value={metrics.pending_assignments}
            icon={<Clock className="h-5 w-5" />}
            description="Awaiting action"
            variant="warning"
          />
          <MetricCard
            label="Automation Coverage"
            value={metrics.automation_coverage}
            suffix="%"
            icon={<Bot className="h-5 w-5" />}
            trend={8}
            trendLabel="vs last month"
          />
          <MetricCard
            label="Open Defects"
            value={metrics.total_defects}
            icon={<AlertTriangle className="h-5 w-5" />}
            description="Across all projects"
          />
        </motion.div>

        {/* Recent Executions & Upcoming Runs */}
        <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-2">
          {/* Recent Executions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-lg">Recent Executions</CardTitle>
                <CardDescription>Latest test run results</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-accent">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentExecutions.map((execution) => (
                  <div
                    key={execution.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-2 w-2 rounded-full ${
                        execution.status === "passed" ? "bg-success" :
                        execution.status === "failed" ? "bg-destructive" :
                        "bg-info animate-pulse"
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
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Runs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-lg">Upcoming Runs</CardTitle>
                <CardDescription>Scheduled test executions</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-accent">
                View all <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingRuns.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{run.name}</p>
                        <StatusBadge variant={getPriorityVariant(run.priority)} size="sm" showDot={false}>
                          {run.priority}
                        </StatusBadge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {run.assignee} • {run.scheduledFor}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Start
                    </Button>
                  </div>
                ))}
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
                  <h4 className="font-medium text-sm mb-1">Coverage Gap Detected</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Payment module has 23% lower coverage than average. Consider adding 15 more test cases.
                  </p>
                  <Progress value={45} className="h-1.5" />
                </div>
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <h4 className="font-medium text-sm mb-1">Flaky Test Identified</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    "Login Timeout Test" failed 3 times in last 10 runs. Review test stability.
                  </p>
                  <Progress value={70} className="h-1.5" />
                </div>
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <h4 className="font-medium text-sm mb-1">Automation Opportunity</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    12 manual test cases are good candidates for automation based on patterns.
                  </p>
                  <Progress value={85} className="h-1.5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}
