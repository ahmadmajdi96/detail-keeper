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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Bot, Play, Pause, Brain, Zap, Activity, TrendingUp, Settings, Plus, Loader2, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import type { AIAgent, AgentStatus } from "@/types";

const statusConfig: Record<AgentStatus, { color: string; label: string }> = {
  idle: { color: "bg-muted text-muted-foreground", label: "Idle" },
  learning: { color: "bg-accent/10 text-accent", label: "Learning" },
  executing: { color: "bg-success/10 text-success", label: "Executing" },
  paused: { color: "bg-warning/10 text-warning", label: "Paused" },
  error: { color: "bg-destructive/10 text-destructive", label: "Error" },
};

export default function AutomationPage() {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentDescription, setNewAgentDescription] = useState("");

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["ai-agents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_agents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as AIAgent[];
    },
  });

  const createAgentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ai_agents").insert({ name: newAgentName, description: newAgentDescription, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-agents"] });
      toast.success("Agent created");
      setIsCreateOpen(false);
      setNewAgentName("");
      setNewAgentDescription("");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AgentStatus }) => {
      const { error } = await supabase.from("ai_agents").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-agents"] });
      toast.success("Agent status updated");
    },
  });

  const stats = {
    total: agents.length,
    active: agents.filter((a) => a.status === "executing" || a.status === "learning").length,
    avgProgress: agents.length > 0 ? Math.round(agents.reduce((acc, a) => acc + a.learning_progress, 0) / agents.length) : 0,
    totalExecutions: agents.reduce((acc, a) => acc + a.total_executions, 0),
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="AI Automation Engine"
          description="Manage autonomous testing agents and monitor learning progress"
          actions={
            hasPermission(["admin", "qa_manager"]) && (
              <Button className="ai-gradient text-white" onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Agent
              </Button>
            )
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Total Agents", value: stats.total, icon: Bot, color: "primary" },
            { label: "Active", value: stats.active, icon: Activity, color: "success" },
            { label: "Avg Learning", value: `${stats.avgProgress}%`, icon: Brain, color: "accent" },
            { label: "Total Executions", value: stats.totalExecutions, icon: Zap, color: "warning" },
          ].map((stat) => (
            <Card key={stat.label} className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-${stat.color}/10`}>
                  <stat.icon className={`h-5 w-5 text-${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            <div className="col-span-full flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : agents.length === 0 ? (
            <Card className="col-span-full border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No AI agents configured</p>
                <Button onClick={() => setIsCreateOpen(true)}>Create your first agent</Button>
              </CardContent>
            </Card>
          ) : (
            agents.map((agent) => (
              <motion.div key={agent.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-border/50 hover:border-accent/50 transition-colors h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg ai-gradient">
                          <Bot className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{agent.name}</CardTitle>
                          <Badge variant="outline" className={`${statusConfig[agent.status].color} mt-1`}>
                            {statusConfig[agent.status].label}
                          </Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><Settings className="h-4 w-4" /></Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{agent.description || "No description"}</p>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Learning Progress</span>
                        <span className="font-medium">{agent.learning_progress}%</span>
                      </div>
                      <Progress value={agent.learning_progress} className="h-2" />
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-muted-foreground">Executions:</span> <span className="font-medium">{agent.total_executions}</span></div>
                      <div><span className="text-muted-foreground">Success Rate:</span> <span className="font-medium">{agent.success_rate ? `${agent.success_rate}%` : "N/A"}</span></div>
                    </div>
                    <div className="flex gap-2">
                      {agent.status === "idle" || agent.status === "paused" ? (
                        <Button className="flex-1" size="sm" onClick={() => updateStatusMutation.mutate({ id: agent.id, status: "learning" })}><Play className="mr-2 h-4 w-4" />Start</Button>
                      ) : (
                        <Button variant="outline" className="flex-1" size="sm" onClick={() => updateStatusMutation.mutate({ id: agent.id, status: "paused" })}><Pause className="mr-2 h-4 w-4" />Pause</Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => updateStatusMutation.mutate({ id: agent.id, status: "executing" })}><Zap className="mr-2 h-4 w-4" />Execute</Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent" />Create AI Agent</DialogTitle>
              <DialogDescription>Configure a new autonomous testing agent.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>Agent Name</Label><Input value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} placeholder="e.g., Login Flow Agent" /></div>
              <div className="space-y-2"><Label>Description</Label><Input value={newAgentDescription} onChange={(e) => setNewAgentDescription(e.target.value)} placeholder="What will this agent test?" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => createAgentMutation.mutate()} disabled={!newAgentName || createAgentMutation.isPending}>
                {createAgentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Create Agent
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
