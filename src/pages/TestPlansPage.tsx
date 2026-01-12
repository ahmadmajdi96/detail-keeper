import { useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Calendar,
  Users,
  Target,
  Play,
  Sparkles,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { TestPlan, TestPlanStatus } from "@/types";

// Mock data
const mockTestPlans: TestPlan[] = [
  {
    plan_id: "1",
    project_id: "1",
    name: "Sprint 23 Regression Suite",
    description: "Comprehensive regression testing for all core features updated in Sprint 23",
    status: "active",
    created_by: "1",
    created_date: "2024-01-15",
    ai_suggested: true,
    runs_count: 12,
    progress: 67,
  },
  {
    plan_id: "2",
    project_id: "1",
    name: "Payment Gateway Integration",
    description: "End-to-end testing of new payment gateway integration with Stripe",
    status: "active",
    created_by: "2",
    created_date: "2024-01-14",
    ai_suggested: true,
    runs_count: 8,
    progress: 45,
  },
  {
    plan_id: "3",
    project_id: "2",
    name: "Mobile App Release 2.5",
    description: "Release testing for mobile banking app version 2.5",
    status: "draft",
    created_by: "1",
    created_date: "2024-01-16",
    ai_suggested: false,
    runs_count: 5,
    progress: 0,
  },
  {
    plan_id: "4",
    project_id: "1",
    name: "Security Audit Q1 2024",
    description: "Quarterly security testing covering OWASP Top 10 vulnerabilities",
    status: "completed",
    created_by: "3",
    created_date: "2024-01-01",
    ai_suggested: true,
    runs_count: 15,
    progress: 100,
  },
  {
    plan_id: "5",
    project_id: "3",
    name: "Performance Benchmark Suite",
    description: "Load and stress testing for healthcare portal under various conditions",
    status: "active",
    created_by: "2",
    created_date: "2024-01-12",
    ai_suggested: true,
    runs_count: 6,
    progress: 83,
  },
];

const teamMembers = [
  { id: "1", name: "Alex Johnson", initials: "AJ" },
  { id: "2", name: "Sarah Miller", initials: "SM" },
  { id: "3", name: "James Lee", initials: "JL" },
];

export default function TestPlansPage() {
  const [testPlans] = useState<TestPlan[]>(mockTestPlans);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredPlans = testPlans.filter((plan) => {
    const matchesSearch =
      plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || plan.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusVariant = (status: TestPlanStatus) => {
    switch (status) {
      case "active": return "success";
      case "draft": return "warning";
      case "completed": return "info";
      case "archived": return "muted";
      default: return "default";
    }
  };

  const getCreator = (id: string) => teamMembers.find((m) => m.id === id);

  return (
    <AppLayout>
      <PageHeader
        title="Test Planning"
        description="AI-assisted test plan creation and optimization"
        isAIPowered
        actions={
          <Button className="ai-gradient text-white">
            <Plus className="mr-2 h-4 w-4" />
            New Test Plan
          </Button>
        }
      />

      {/* AI Suggestion Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <Card className="border-accent/30 bg-gradient-to-r from-accent/5 via-accent/10 to-transparent">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg ai-gradient">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-medium">AI Test Plan Suggestions</h3>
                <p className="text-sm text-muted-foreground">
                  Based on recent document uploads, we recommend creating 3 new test plans
                </p>
              </div>
            </div>
            <Button variant="outline" className="border-accent/30 text-accent hover:bg-accent/10">
              View Suggestions
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search test plans..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Test Plans Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {filteredPlans.map((plan, index) => {
          const creator = getCreator(plan.created_by);
          return (
            <motion.div
              key={plan.plan_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="group hover:shadow-soft transition-all duration-200 cursor-pointer h-full flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge variant={getStatusVariant(plan.status)} size="sm">
                        {plan.status}
                      </StatusBadge>
                      {plan.ai_suggested && (
                        <div className="flex items-center gap-1 text-xs text-accent">
                          <Sparkles className="h-3 w-3" />
                          AI Generated
                        </div>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Edit Plan</DropdownMenuItem>
                        <DropdownMenuItem>Duplicate</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">Archive</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <CardTitle className="text-base mt-2">{plan.name}</CardTitle>
                  <CardDescription className="line-clamp-2">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-end">
                  {/* Progress */}
                  {plan.status !== "draft" && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{plan.progress}%</span>
                      </div>
                      <Progress value={plan.progress} className="h-1.5" />
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-secondary/50 py-2">
                      <Target className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs font-medium">{plan.runs_count}</p>
                      <p className="text-[10px] text-muted-foreground">Runs</p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 py-2">
                      <Calendar className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs font-medium">
                        {new Date(plan.created_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Created</p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 py-2">
                      <Avatar className="h-5 w-5 mx-auto mb-1">
                        <AvatarFallback className="text-[10px]">{creator?.initials}</AvatarFallback>
                      </Avatar>
                      <p className="text-xs font-medium truncate px-1">{creator?.name.split(" ")[0]}</p>
                      <p className="text-[10px] text-muted-foreground">Owner</p>
                    </div>
                  </div>

                  {/* Action */}
                  {plan.status === "active" && (
                    <Button className="w-full mt-4" variant="outline" size="sm">
                      <Play className="mr-2 h-3 w-3" />
                      Start Run
                    </Button>
                  )}
                  {plan.status === "draft" && (
                    <Button className="w-full mt-4 ai-gradient text-white" size="sm">
                      <Sparkles className="mr-2 h-3 w-3" />
                      Configure with AI
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {filteredPlans.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-1">No test plans found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery
              ? "Try adjusting your search query"
              : "Create your first test plan to get started"}
          </p>
        </div>
      )}
    </AppLayout>
  );
}
