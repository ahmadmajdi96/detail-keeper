import { useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { MetricCard } from "@/components/ui/metric-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  BarChart3,
  PieChart,
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  FileText,
  Bot,
  AlertTriangle,
  CheckCircle,
  Clock,
  Bug,
  TestTube,
  Target,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Share2,
  Filter,
  RefreshCw,
  Mail,
  Plus,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// Mock data for charts
const executionTrendData = [
  { date: "Jan 1", passed: 45, failed: 5, blocked: 2 },
  { date: "Jan 8", passed: 52, failed: 8, blocked: 3 },
  { date: "Jan 15", passed: 48, failed: 4, blocked: 1 },
  { date: "Jan 22", passed: 61, failed: 6, blocked: 2 },
  { date: "Jan 29", passed: 55, failed: 3, blocked: 1 },
  { date: "Feb 5", passed: 67, failed: 4, blocked: 2 },
  { date: "Feb 12", passed: 72, failed: 5, blocked: 1 },
];

const coverageByModuleData = [
  { module: "Authentication", coverage: 94 },
  { module: "Payments", coverage: 78 },
  { module: "User Profile", coverage: 89 },
  { module: "Dashboard", coverage: 82 },
  { module: "Reports", coverage: 65 },
  { module: "Settings", coverage: 91 },
];

const defectDistributionData = [
  { name: "Critical", value: 3, color: "hsl(var(--destructive))" },
  { name: "Major", value: 12, color: "hsl(var(--warning))" },
  { name: "Minor", value: 28, color: "hsl(var(--info))" },
  { name: "Trivial", value: 15, color: "hsl(var(--muted))" },
];

const automationProgressData = [
  { week: "W1", manual: 80, automated: 20 },
  { week: "W2", manual: 75, automated: 25 },
  { week: "W3", manual: 68, automated: 32 },
  { week: "W4", manual: 60, automated: 40 },
  { week: "W5", manual: 55, automated: 45 },
  { week: "W6", manual: 48, automated: 52 },
];

const aiInsights = [
  {
    id: 1,
    type: "warning",
    title: "Test Coverage Declining",
    description: "Payment module coverage dropped 8% this week. 12 new endpoints lack test coverage.",
    recommendation: "Generate 15 additional test cases focusing on checkout flow edge cases.",
    impact: "high",
    confidence: 94,
  },
  {
    id: 2,
    type: "success",
    title: "Automation ROI Achieved",
    description: "AI automation agents saved 127 hours of manual testing this month.",
    recommendation: "Expand automation to User Profile module for additional 40% time savings.",
    impact: "medium",
    confidence: 89,
  },
  {
    id: 3,
    type: "info",
    title: "Flaky Test Pattern Detected",
    description: "3 tests in Login flow show 30% failure rate due to timing issues.",
    recommendation: "Add explicit waits and retry logic to stabilize these tests.",
    impact: "medium",
    confidence: 87,
  },
  {
    id: 4,
    type: "warning",
    title: "Critical Path Risk",
    description: "Checkout flow has no regression tests scheduled for next sprint.",
    recommendation: "Schedule bi-weekly regression runs for payment critical path.",
    impact: "high",
    confidence: 92,
  },
];

const savedReports = [
  { id: 1, name: "Weekly Quality Summary", type: "scheduled", lastRun: "2 hours ago", recipients: 5 },
  { id: 2, name: "Sprint Defect Analysis", type: "manual", lastRun: "3 days ago", recipients: 3 },
  { id: 3, name: "Executive Dashboard", type: "scheduled", lastRun: "1 day ago", recipients: 8 },
  { id: 4, name: "Automation Coverage Report", type: "manual", lastRun: "1 week ago", recipients: 4 },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function ReportingPage() {
  const [dateRange, setDateRange] = useState("7d");
  const [isCreateReportOpen, setIsCreateReportOpen] = useState(false);
  const [reportName, setReportName] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      case "success":
        return <CheckCircle className="h-5 w-5 text-success" />;
      case "info":
        return <Sparkles className="h-5 w-5 text-info" />;
      default:
        return <Bot className="h-5 w-5 text-accent" />;
    }
  };

  const getInsightBorder = (type: string) => {
    switch (type) {
      case "warning":
        return "border-l-warning";
      case "success":
        return "border-l-success";
      case "info":
        return "border-l-info";
      default:
        return "border-l-accent";
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Reporting & Analytics"
        description="AI-powered quality insights and comprehensive dashboards"
        actions={
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Dialog open={isCreateReportOpen} onOpenChange={setIsCreateReportOpen}>
              <DialogTrigger asChild>
                <Button className="ai-gradient text-white">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Report
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create Custom Report</DialogTitle>
                  <DialogDescription>
                    Configure a new report with specific metrics and scheduling
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Report Name</Label>
                    <Input
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                      placeholder="e.g., Weekly Sprint Summary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={reportDescription}
                      onChange={(e) => setReportDescription(e.target.value)}
                      placeholder="Describe what this report covers..."
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Include Metrics</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {["Test Coverage", "Pass Rate", "Defect Trends", "Automation Stats", "Execution Time", "AI Insights"].map((metric) => (
                        <div key={metric} className="flex items-center space-x-2">
                          <Checkbox
                            id={metric}
                            checked={selectedMetrics.includes(metric)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedMetrics([...selectedMetrics, metric]);
                              } else {
                                setSelectedMetrics(selectedMetrics.filter((m) => m !== metric));
                              }
                            }}
                          />
                          <Label htmlFor={metric} className="text-sm font-normal cursor-pointer">
                            {metric}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Schedule</Label>
                    <Select defaultValue="weekly">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Bi-weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="manual">Manual only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateReportOpen(false)}>
                    Cancel
                  </Button>
                  <Button className="ai-gradient text-white" onClick={() => setIsCreateReportOpen(false)}>
                    Create Report
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        {/* Key Metrics */}
        <motion.div variants={itemVariants} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Overall Pass Rate"
            value={94.2}
            suffix="%"
            icon={<CheckCircle className="h-5 w-5" />}
            trend={3.2}
            trendLabel="vs last period"
            variant="success"
          />
          <MetricCard
            label="Test Coverage"
            value={82}
            suffix="%"
            icon={<Target className="h-5 w-5" />}
            trend={-2.1}
            trendLabel="vs last period"
            variant="warning"
          />
          <MetricCard
            label="Defect Escape Rate"
            value={2.4}
            suffix="%"
            icon={<Bug className="h-5 w-5" />}
            trend={-15}
            trendLabel="vs last period"
            variant="success"
          />
          <MetricCard
            label="Automation Coverage"
            value={62}
            suffix="%"
            icon={<Bot className="h-5 w-5" />}
            trend={8}
            trendLabel="vs last period"
            variant="accent"
          />
        </motion.div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <motion.div variants={itemVariants}>
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="insights" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI Insights
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Reports
              </TabsTrigger>
            </TabsList>
          </motion.div>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Execution Trend Chart */}
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Execution Trends</CardTitle>
                    <CardDescription>Test execution results over time</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={executionTrendData}>
                        <defs>
                          <linearGradient id="colorPassed" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="passed"
                          stackId="1"
                          stroke="hsl(var(--success))"
                          fill="url(#colorPassed)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="failed"
                          stackId="2"
                          stroke="hsl(var(--destructive))"
                          fill="url(#colorFailed)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-2">
              {/* Coverage by Module */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Coverage by Module</CardTitle>
                  <CardDescription>Test coverage breakdown per module</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={coverageByModuleData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis dataKey="module" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: number) => [`${value}%`, "Coverage"]}
                        />
                        <Bar
                          dataKey="coverage"
                          fill="hsl(var(--accent))"
                          radius={[0, 4, 4, 0]}
                          barSize={20}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Defect Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Defect Distribution</CardTitle>
                  <CardDescription>Open defects by severity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={defectDistributionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {defectDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Legend
                          iconType="circle"
                          iconSize={10}
                          wrapperStyle={{ fontSize: "12px" }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Automation Progress */}
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Automation Progress</CardTitle>
                    <CardDescription>Manual vs automated test execution over time</CardDescription>
                  </div>
                  <StatusBadge variant="success" showDot>
                    +12% this month
                  </StatusBadge>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={automationProgressData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: number) => [`${value}%`]}
                        />
                        <Line
                          type="monotone"
                          dataKey="automated"
                          stroke="hsl(var(--accent))"
                          strokeWidth={3}
                          dot={{ fill: "hsl(var(--accent))", strokeWidth: 2 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="manual"
                          stroke="hsl(var(--muted-foreground))"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={{ fill: "hsl(var(--muted-foreground))", strokeWidth: 2 }}
                        />
                        <Legend iconType="line" wrapperStyle={{ fontSize: "12px" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* AI Insights Tab */}
          <TabsContent value="insights" className="space-y-6">
            <motion.div variants={itemVariants}>
              <Card className="border-accent/20 bg-gradient-to-r from-accent/5 to-transparent">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg ai-gradient">
                        <Sparkles className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <CardTitle>AI Quality Analysis</CardTitle>
                        <CardDescription>
                          Intelligent insights generated from your testing data
                        </CardDescription>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh Analysis
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {aiInsights.map((insight) => (
                      <motion.div
                        key={insight.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`rounded-lg border bg-card p-4 border-l-4 ${getInsightBorder(insight.type)}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="mt-0.5">{getInsightIcon(insight.type)}</div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold">{insight.title}</h4>
                              <div className="flex items-center gap-2">
                                <StatusBadge
                                  variant={insight.impact === "high" ? "warning" : "info"}
                                  size="sm"
                                  showDot={false}
                                >
                                  {insight.impact} impact
                                </StatusBadge>
                                <span className="text-xs text-muted-foreground">
                                  {insight.confidence}% confidence
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">{insight.description}</p>
                            <div className="flex items-center justify-between pt-2 border-t border-border/50">
                              <p className="text-sm">
                                <span className="font-medium text-accent">Recommendation:</span>{" "}
                                {insight.recommendation}
                              </p>
                              <Button variant="ghost" size="sm" className="text-accent">
                                Apply <ArrowUpRight className="ml-1 h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Quality Score Card */}
            <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Quality Score Breakdown</CardTitle>
                  <CardDescription>AI-calculated quality metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {[
                      { label: "Test Coverage", score: 82, target: 85, trend: 3 },
                      { label: "Defect Density", score: 94, target: 90, trend: 5 },
                      { label: "Test Stability", score: 78, target: 80, trend: -2 },
                      { label: "Automation Index", score: 62, target: 70, trend: 8 },
                      { label: "Response Time", score: 88, target: 85, trend: 4 },
                    ].map((metric) => (
                      <div key={metric.label} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{metric.label}</span>
                          <div className="flex items-center gap-2">
                            <span className={`flex items-center text-xs ${
                              metric.trend > 0 ? "text-success" : "text-destructive"
                            }`}>
                              {metric.trend > 0 ? (
                                <ArrowUpRight className="h-3 w-3 mr-0.5" />
                              ) : (
                                <ArrowDownRight className="h-3 w-3 mr-0.5" />
                              )}
                              {Math.abs(metric.trend)}%
                            </span>
                            <span className="font-semibold">{metric.score}%</span>
                          </div>
                        </div>
                        <div className="relative">
                          <Progress value={metric.score} className="h-2" />
                          <div
                            className="absolute top-0 h-2 w-0.5 bg-foreground/50"
                            style={{ left: `${metric.target}%` }}
                          />
                        </div>
                        <div className="flex justify-end">
                          <span className="text-xs text-muted-foreground">
                            Target: {metric.target}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Overall Quality Score</CardTitle>
                  <CardDescription>Composite score based on all metrics</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <div className="relative h-40 w-40">
                    <svg className="h-full w-full" viewBox="0 0 100 100">
                      <circle
                        className="text-muted stroke-current"
                        strokeWidth="8"
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                      />
                      <circle
                        className="text-accent stroke-current"
                        strokeWidth="8"
                        strokeLinecap="round"
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        strokeDasharray={`${81 * 2.51} ${100 * 2.51}`}
                        strokeDashoffset="0"
                        transform="rotate(-90 50 50)"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-bold">81</span>
                      <span className="text-sm text-muted-foreground">out of 100</span>
                    </div>
                  </div>
                  <StatusBadge variant="success" className="mt-4">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    +4 from last week
                  </StatusBadge>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Saved Reports</CardTitle>
                    <CardDescription>Your configured reports and schedules</CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-2" />
                    Filter
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {savedReports.map((report) => (
                      <div
                        key={report.id}
                        className="flex items-center justify-between rounded-lg border border-border/50 p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                            <FileText className="h-5 w-5 text-accent" />
                          </div>
                          <div>
                            <h4 className="font-medium">{report.name}</h4>
                            <div className="flex items-center gap-3 mt-1">
                              <StatusBadge
                                variant={report.type === "scheduled" ? "info" : "default"}
                                size="sm"
                                showDot={false}
                              >
                                {report.type}
                              </StatusBadge>
                              <span className="text-xs text-muted-foreground">
                                Last run: {report.lastRun}
                              </span>
                              <span className="text-xs text-muted-foreground flex items-center">
                                <Mail className="h-3 w-3 mr-1" />
                                {report.recipients} recipients
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm">
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            Run Now
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Export */}
            <motion.div variants={itemVariants}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Export</CardTitle>
                  <CardDescription>Generate one-time reports instantly</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    {[
                      { name: "Executive Summary", description: "High-level quality overview", icon: BarChart3 },
                      { name: "Defect Analysis", description: "Detailed defect breakdown", icon: Bug },
                      { name: "Test Execution Log", description: "Complete execution history", icon: TestTube },
                    ].map((exportType) => (
                      <Button
                        key={exportType.name}
                        variant="outline"
                        className="h-auto flex-col items-start p-4 text-left hover:border-accent/50"
                      >
                        <exportType.icon className="h-6 w-6 text-accent mb-2" />
                        <span className="font-medium">{exportType.name}</span>
                        <span className="text-xs text-muted-foreground mt-1">
                          {exportType.description}
                        </span>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </AppLayout>
  );
}
