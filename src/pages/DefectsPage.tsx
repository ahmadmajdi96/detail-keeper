import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Search,
  Plus,
  MoreHorizontal,
  Bug,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Edit,
  Trash2,
  Eye,
  UserPlus,
  Link2,
  XCircle,
} from "lucide-react";
import type { Defect, Profile, DefectSeverity, DefectPriority } from "@/types";

type DefectWithRelations = Defect & {
  reporter?: Profile | null;
  assignee?: Profile | null;
};

const severityColors: Record<DefectSeverity, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/20",
  major: "bg-warning/10 text-warning border-warning/20",
  minor: "bg-accent/10 text-accent border-accent/20",
  trivial: "bg-muted text-muted-foreground border-border",
};

const priorityColors: Record<DefectPriority, string> = {
  urgent: "bg-destructive/10 text-destructive border-destructive/20",
  high: "bg-warning/10 text-warning border-warning/20",
  medium: "bg-accent/10 text-accent border-accent/20",
  low: "bg-muted text-muted-foreground border-border",
};

const statusColors: Record<string, string> = {
  open: "bg-destructive/10 text-destructive border-destructive/20",
  in_progress: "bg-accent/10 text-accent border-accent/20",
  resolved: "bg-success/10 text-success border-success/20",
  closed: "bg-muted text-muted-foreground border-border",
  reopened: "bg-warning/10 text-warning border-warning/20",
};

const statusIcons: Record<string, React.ReactNode> = {
  open: <AlertCircle className="h-3 w-3" />,
  in_progress: <Clock className="h-3 w-3" />,
  resolved: <CheckCircle2 className="h-3 w-3" />,
  closed: <XCircle className="h-3 w-3" />,
  reopened: <AlertTriangle className="h-3 w-3" />,
};

export default function DefectsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [selectedDefect, setSelectedDefect] = useState<DefectWithRelations | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

  // Form state
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSeverity, setNewSeverity] = useState<DefectSeverity>("minor");
  const [newPriority, setNewPriority] = useState<DefectPriority>("medium");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");

  // Fetch defects
  const { data: defects = [], isLoading } = useQuery({
    queryKey: ["defects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("defects")
        .select(`
          *,
          reporter:profiles!defects_reported_by_fkey(id, name, email, avatar),
          assignee:profiles!defects_assigned_to_fkey(id, name, email, avatar)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as DefectWithRelations[];
    },
  });

  // Fetch users for assignment
  const { data: users = [] } = useQuery({
    queryKey: ["users-for-assignment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, avatar")
        .eq("status", "active")
        .order("name");

      if (error) throw error;
      return data as Profile[];
    },
  });

  // Create defect mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("defects").insert({
        title: newTitle,
        description: newDescription,
        severity: newSeverity,
        priority: newPriority,
        reported_by: user?.id,
        status: "open",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["defects"] });
      toast.success("Defect created successfully");
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to create defect: " + error.message);
    },
  });

  // Update defect status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("defects")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["defects"] });
      toast.success("Defect status updated");
    },
    onError: (error) => {
      toast.error("Failed to update status: " + error.message);
    },
  });

  // Assign defect mutation
  const assignMutation = useMutation({
    mutationFn: async ({ id, assigneeId }: { id: string; assigneeId: string | null }) => {
      const { error } = await supabase
        .from("defects")
        .update({ assigned_to: assigneeId })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["defects"] });
      toast.success("Defect assigned successfully");
      setIsAssignDialogOpen(false);
      setSelectedAssignee("");
    },
    onError: (error) => {
      toast.error("Failed to assign defect: " + error.message);
    },
  });

  // Delete defect mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("defects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["defects"] });
      toast.success("Defect deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete: " + error.message);
    },
  });

  const resetForm = () => {
    setNewTitle("");
    setNewDescription("");
    setNewSeverity("minor");
    setNewPriority("medium");
  };

  // Filter defects
  const filteredDefects = defects.filter((defect) => {
    const matchesSearch = defect.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || defect.status === statusFilter;
    const matchesSeverity = severityFilter === "all" || defect.severity === severityFilter;
    return matchesSearch && matchesStatus && matchesSeverity;
  });

  // Stats
  const stats = {
    total: defects.length,
    open: defects.filter((d) => d.status === "open").length,
    critical: defects.filter((d) => d.severity === "critical" && d.status !== "closed").length,
    resolved: defects.filter((d) => d.status === "resolved" || d.status === "closed").length,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Defect Management"
          description="Track, assign, and resolve bugs linked to test executions"
          actions={
            <Button className="ai-gradient text-white" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Defect
            </Button>
          }
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Bug className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Defects</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.open}</p>
                  <p className="text-xs text-muted-foreground">Open</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.critical}</p>
                  <p className="text-xs text-muted-foreground">Critical</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.resolved}</p>
                  <p className="text-xs text-muted-foreground">Resolved</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search defects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="reopened">Reopened</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="major">Major</SelectItem>
              <SelectItem value="minor">Minor</SelectItem>
              <SelectItem value="trivial">Trivial</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Defects Table */}
        <Card className="border-border/50">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Defect</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {filteredDefects.map((defect) => (
                      <motion.tr
                        key={defect.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <TableCell>
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10 shrink-0">
                              <Bug className="h-4 w-4 text-destructive" />
                            </div>
                            <div>
                              <p className="font-medium">{defect.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {defect.description || "No description"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColors[defect.status]}>
                            {statusIcons[defect.status]}
                            <span className="ml-1">{defect.status.replace("_", " ")}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={severityColors[defect.severity]}>
                            {defect.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={priorityColors[defect.priority]}>
                            {defect.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {defect.assignee ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={defect.assignee.avatar || undefined} />
                                <AvatarFallback className="text-xs">
                                  {defect.assignee.name?.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{defect.assignee.name}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(defect.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                                setSelectedDefect(defect);
                                setIsViewDialogOpen(true);
                              }}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedDefect(defect);
                                setSelectedAssignee(defect.assigned_to || "");
                                setIsAssignDialogOpen(true);
                              }}>
                                <UserPlus className="mr-2 h-4 w-4" />
                                Assign
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => updateStatusMutation.mutate({ id: defect.id, status: "in_progress" })}
                                disabled={defect.status === "in_progress"}
                              >
                                <Clock className="mr-2 h-4 w-4" />
                                Mark In Progress
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateStatusMutation.mutate({ id: defect.id, status: "resolved" })}
                                disabled={defect.status === "resolved"}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Mark Resolved
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateStatusMutation.mutate({ id: defect.id, status: "closed" })}
                                disabled={defect.status === "closed"}
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Close
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteMutation.mutate(defect.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                  {filteredDefects.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <p className="text-muted-foreground">No defects found</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Defect Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Create New Defect
            </DialogTitle>
            <DialogDescription>
              Log a new defect for tracking and resolution
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Brief defect description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Detailed description of the defect..."
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={newSeverity} onValueChange={(v) => setNewSeverity(v as DefectSeverity)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trivial">Trivial</SelectItem>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="major">Major</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={newPriority} onValueChange={(v) => setNewPriority(v as DefectPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="ai-gradient text-white"
              onClick={() => createMutation.mutate()}
              disabled={!newTitle || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Defect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Defect Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Defect Details
            </DialogTitle>
          </DialogHeader>
          {selectedDefect && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-muted-foreground">Title</Label>
                <p className="font-medium">{selectedDefect.title}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p className="text-sm">{selectedDefect.description || "No description"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <Badge variant="outline" className={statusColors[selectedDefect.status]}>
                    {statusIcons[selectedDefect.status]}
                    <span className="ml-1">{selectedDefect.status.replace("_", " ")}</span>
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Severity</Label>
                  <Badge variant="outline" className={severityColors[selectedDefect.severity]}>
                    {selectedDefect.severity}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Priority</Label>
                  <Badge variant="outline" className={priorityColors[selectedDefect.priority]}>
                    {selectedDefect.priority}
                  </Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p className="text-sm">{new Date(selectedDefect.created_at).toLocaleString()}</p>
                </div>
              </div>
              {selectedDefect.reporter && (
                <div>
                  <Label className="text-muted-foreground">Reported By</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback>{selectedDefect.reporter.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{selectedDefect.reporter.name}</span>
                  </div>
                </div>
              )}
              {selectedDefect.assignee && (
                <div>
                  <Label className="text-muted-foreground">Assigned To</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback>{selectedDefect.assignee.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{selectedDefect.assignee.name}</span>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Assign Defect
            </DialogTitle>
            <DialogDescription>
              Select a team member to assign this defect to
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedAssignee} onValueChange={setSelectedAssignee}>
              <SelectTrigger>
                <SelectValue placeholder="Select assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedDefect) {
                  assignMutation.mutate({
                    id: selectedDefect.id,
                    assigneeId: selectedAssignee === "unassigned" ? null : selectedAssignee,
                  });
                }
              }}
              disabled={assignMutation.isPending}
            >
              {assignMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
