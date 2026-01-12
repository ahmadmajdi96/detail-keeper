import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
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
} from "lucide-react";

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
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const { data: testPlans = [], isLoading } = useQuery({
    queryKey: ["test-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_plans")
        .select("*, creator:profiles!test_plans_created_by_fkey(name)")
        .order("created_at", { ascending: false });
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

  const filteredPlans = testPlans.filter((plan) => {
    const matchesSearch =
      plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
                  Based on your test cases, we recommend creating optimized test plans
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
              <Card className="group hover:shadow-soft transition-all duration-200 h-full flex flex-col">
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
                        <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: plan.id, status: "active" })}>
                          Activate
                        </DropdownMenuItem>
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
                    </DropdownMenu>
                  </div>
                  <CardTitle className="text-base mt-2">{plan.name}</CardTitle>
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
                  {plan.status === "active" && (
                    <Button className="w-full mt-4" variant="outline" size="sm">
                      <Play className="mr-2 h-3 w-3" />
                      Start Run
                    </Button>
                  )}
                  {plan.status === "draft" && (
                    <Button 
                      className="w-full mt-4 ai-gradient text-white" 
                      size="sm"
                      onClick={() => updateStatusMutation.mutate({ id: plan.id, status: "active" })}
                    >
                      <Sparkles className="mr-2 h-3 w-3" />
                      Activate Plan
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

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Create Test Plan
            </DialogTitle>
            <DialogDescription>
              Create a new test plan to organize your testing activities
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Plan Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Sprint 24 Regression Suite"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Describe the scope and goals of this test plan..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="ai-gradient text-white"
              onClick={() => createMutation.mutate()}
              disabled={!newName || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
