import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { TestPlanWizard } from "@/components/testplans/TestPlanWizard";
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Calendar,
  Target,
  Play,
  Sparkles,
  ChevronRight,
  Loader2,
  Trash2,
  FileEdit,
} from "lucide-react";
import { useProjectScope } from "@/hooks/useProjectScope";
import { useActiveTestPlan } from "@/contexts/ActiveTestPlanContext";
import { CheckCircle2 } from "lucide-react";

interface TestPlan {
  id: string;
  name: string;
  description: string | null;
  status: string;
  workspace_id: string | null;
  created_by: string | null;
  ai_suggested: boolean;
  runs_count: number;
  progress: number;
  created_at: string;
  creator?: { name: string } | null;
}

export default function TestPlansPage() {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { projectId, workspaceId, scopeKey } = useProjectScope();
  const { activePlanId, setActivePlan } = useActiveTestPlan();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const location = useLocation();
  useEffect(() => {
    const st = location.state as any;
    if (st?.openCreate) {
      setIsCreateDialogOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const { data: testPlans = [], isLoading } = useQuery({
    queryKey: ["test-plans", ...scopeKey],
    queryFn: async () => {
      let q = supabase
        .from("test_plans")
        .select("*, creator:profiles!test_plans_created_by_fkey(name)")
        .order("created_at", { ascending: false });
      if (projectId) q = q.eq("project_id", projectId);
      const { data, error } = await q;
      if (error) throw error;
      return data as TestPlan[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("test_plans").insert({
        name: newName,
        description: newDescription,
        created_by: user?.id,
        status: "draft",
        project_id: projectId,
        workspace_id: workspaceId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-plans"] });
      toast.success("Test plan created successfully");
      setIsCreateDialogOpen(false);
      setNewName("");
      setNewDescription("");
    },
    onError: (error) => {
      toast.error("Failed to create: " + error.message);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("test_plans").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-plans"] });
      toast.success("Status updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("test_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-plans"] });
      toast.success("Test plan deleted");
    },
  });

  const generateWithAI = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("Select a project first");
      // 1) Create a shell test plan
      const { data: plan, error: planErr } = await supabase
        .from("test_plans")
        .insert({
          name: "AI Generated Test Plan",
          description: "Generated from project docs and details.",
          status: "draft",
          ai_status: "queued",
          ai_suggested: true,
          created_by: user?.id,
          project_id: projectId,
          workspace_id: workspaceId,
        })
        .select("id")
        .single();
      if (planErr) throw planErr;

      // 2) Kick the durable generation job (uses all AI docs + project details).
      const { error: fnErr } = await supabase.functions.invoke(
        "generate-test-plan-from-docs",
        { body: { test_plan_id: plan.id } },
      );
      if (fnErr) throw fnErr;
      return plan.id as string;
    },
    onSuccess: (planId) => {
      queryClient.invalidateQueries({ queryKey: ["test-plans"] });
      toast.success("AI is generating your test plan…");
      navigate(`/test-plans/${planId}`);
    },
    onError: (e: any) => toast.error(e.message || "Failed to generate"),
  });


  const filteredPlans = testPlans.filter((plan) => {
    const matchesSearch =
      plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String((plan as any).plan_uid || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || plan.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active": return "success";
      case "draft": return "warning";
      case "completed": return "info";
      case "archived": return "muted";
      default: return "default";
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Test Planning"
        description="AI-assisted test plan creation and optimization"
        isAIPowered
        actions={
          <Button className="ai-gradient text-white" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Test Plan
          </Button>
        }
      />

      {/* Summary cards */}
      <TestPlanStatCards
        plans={testPlans}
        activeFilter={statusFilter}
        onSelect={(s) => setStatusFilter(s)}
      />

      {/* AI Generate Banner */}
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
                <h3 className="font-medium">Generate a full Test Plan with AI</h3>
                <p className="text-sm text-muted-foreground">
                  We'll send all AI-generated project docs and project details to the AI and build a complete test plan in one shot.
                </p>
              </div>
            </div>
            <Button
              className="ai-gradient text-white"
              disabled={!projectId || generateWithAI.isPending}
              onClick={() => generateWithAI.mutate()}
            >
              {generateWithAI.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" /> Generate with AI</>
              )}
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
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {filteredPlans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card onClick={() => navigate(`/test-plans/${plan.id}`)} className={`group hover:shadow-soft transition-all duration-200 h-full flex flex-col cursor-pointer ${activePlanId === plan.id ? "border-success ring-1 ring-success/30" : ""}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge variant={getStatusVariant(plan.status)} size="sm">
                        {plan.status}
                      </StatusBadge>
                      {activePlanId === plan.id && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      )}
                      {plan.ai_suggested && (
                        <div className="flex items-center gap-1 text-xs text-accent">
                          <Sparkles className="h-3 w-3" />
                          AI Generated
                        </div>
                      )}
                    </div>
                    <DropdownMenu>
                      <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={async () => { await setActivePlan(plan.id); toast.success(`Activated "${plan.name}"`); }}>
                          <CheckCircle2 className="mr-2 h-4 w-4" /> {activePlanId === plan.id ? "Active (re-set)" : "Set as Active"}
                        </DropdownMenuItem>
                        {activePlanId === plan.id && (
                          <DropdownMenuItem onClick={async () => { await setActivePlan(null); toast.message("Deactivated test plan"); }}>
                            Deactivate
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={async () => { await setActivePlan(plan.id); toast.success(`Activated "${plan.name}"`); }}>
                          <CheckCircle2 className="mr-2 h-4 w-4" /> Set as Active
                        </DropdownMenuItem>
                        {activePlanId === plan.id && (
                          <DropdownMenuItem onClick={async () => { await setActivePlan(null); toast.message("Deactivated test plan"); }}>
                            Deactivate
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: plan.id, status: "completed" })}>
                          Mark Complete
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {hasPermission(["admin", "qa_manager"]) && (
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => deleteMutation.mutate(plan.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                      </div>
                    </DropdownMenu>
                  </div>
                  <CardTitle className="text-base mt-2">{plan.name}</CardTitle>
                  {(plan as any).plan_uid && (
                    <span className="mt-1 inline-block rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent">
                      {(plan as any).plan_uid}
                    </span>
                  )}
                  <CardDescription className="line-clamp-2">{plan.description || "No description"}</CardDescription>
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
                        {new Date(plan.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Created</p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 py-2">
                      <Avatar className="h-5 w-5 mx-auto mb-1">
                        <AvatarFallback className="text-[10px]">
                          {plan.creator?.name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <p className="text-xs font-medium truncate px-1">
                        {plan.creator?.name?.split(" ")[0] || "Unknown"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Owner</p>
                    </div>
                  </div>

                  {/* Action */}
                  {activePlanId !== plan.id ? (
                    <Button
                      className="w-full mt-4 ai-gradient text-white"
                      size="sm"
                      onClick={async (e) => { e.stopPropagation(); await setActivePlan(plan.id); toast.success(`Activated "${plan.name}"`); }}
                    >
                      <CheckCircle2 className="mr-2 h-3 w-3" />
                      Set as Active Plan
                    </Button>
                  ) : (
                    <Button className="w-full mt-4" variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                      <CheckCircle2 className="mr-2 h-3 w-3 text-success" />
                      Active Plan
                    </Button>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {!isLoading && filteredPlans.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-1">No test plans found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchQuery ? "Try adjusting your search query" : "Create your first test plan to get started"}
          </p>
          {!searchQuery && (
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Test Plan
            </Button>
          )}
        </div>
      )}

      <TestPlanWizard
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreated={(planId) => navigate(`/test-plans/${planId}`)}
      />
    </AppLayout>
  );
}

// ---- Summary cards ----
function TestPlanStatCards({
  plans, activeFilter, onSelect,
}: { plans: TestPlan[]; activeFilter: string; onSelect: (s: string) => void }) {
  const total = plans.length;
  const draft = plans.filter((p) => p.status === "draft").length;
  const active = plans.filter((p) => p.status === "active").length;
  const completed = plans.filter((p) => p.status === "completed").length;
  const aiGenerated = plans.filter((p) => p.ai_suggested).length;
  const avgProgress = total
    ? Math.round(plans.reduce((s, p) => s + (p.progress || 0), 0) / total)
    : 0;

  const cards = [
    { key: "all",       label: "Total plans",   value: total,       hint: "All statuses",    grad: "from-accent/20 to-transparent",    icon: ClipboardList },
    { key: "draft",     label: "Draft",         value: draft,       hint: "Not started",     grad: "from-warning/20 to-transparent",   icon: FileEdit },
    { key: "active",    label: "In progress",   value: active,      hint: "Currently running",grad: "from-success/20 to-transparent",  icon: Play },
    { key: "completed", label: "Completed",     value: completed,   hint: "Signed off",      grad: "from-info/20 to-transparent",      icon: CheckCircle2 },
    { key: "all",       label: "AI generated",  value: aiGenerated, hint: `${total ? Math.round(aiGenerated/total*100) : 0}% of plans`, grad: "from-purple-500/20 to-transparent", icon: Sparkles },
    { key: "all",       label: "Avg progress",  value: `${avgProgress}%`, hint: "Across all plans", grad: "from-cyan-500/20 to-transparent", icon: Target },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mb-6"
    >
      {cards.map((c, i) => {
        const Icon = c.icon;
        const isActive = activeFilter === c.key && c.key !== "all";
        return (
          <motion.button
            key={c.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            whileHover={{ y: -2 }}
            onClick={() => onSelect(c.key)}
            className={`text-left rounded-lg border p-3 bg-gradient-to-br ${c.grad} transition-all
              ${isActive ? "border-accent ring-1 ring-accent/40" : "border-border/50 hover:border-accent/40"}`}
          >
            <div className="flex items-center justify-between mb-2">
              <Icon className="h-4 w-4 text-accent" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{c.label}</span>
            </div>
            <div className="text-2xl font-semibold">{c.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{c.hint}</div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}
