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
import { Progress } from "@/components/ui/progress";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Search,
  Plus,
  MoreHorizontal,
  Sparkles,
  TestTube,
  History,
  Target,
  Loader2,
  Edit,
  Trash2,
  Copy,
  Eye,
  FileText,
  Brain,
  Zap,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import type { TestCase, TestCaseStep, TestCaseVersion, TestCaseStatus } from "@/types";

const statusColors: Record<TestCaseStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  active: "bg-success/10 text-success border-success/20",
  deprecated: "bg-warning/10 text-warning border-warning/20",
  archived: "bg-muted text-muted-foreground border-border",
};

const statusIcons: Record<TestCaseStatus, React.ReactNode> = {
  draft: <Clock className="h-3 w-3" />,
  active: <CheckCircle2 className="h-3 w-3" />,
  deprecated: <AlertCircle className="h-3 w-3" />,
  archived: <Clock className="h-3 w-3" />,
};

export default function TestCasesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isAIGenerateOpen, setIsAIGenerateOpen] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  
  // Form state
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPreconditions, setNewPreconditions] = useState("");
  const [newExpectedResult, setNewExpectedResult] = useState("");
  const [aiPrompt, setAIPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch test cases
  const { data: testCases = [], isLoading } = useQuery({
    queryKey: ["test-cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_cases")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as TestCase[];
    },
  });

  // Fetch test case steps
  const { data: steps = [] } = useQuery({
    queryKey: ["test-case-steps", selectedTestCase?.id],
    queryFn: async () => {
      if (!selectedTestCase) return [];
      const { data, error } = await supabase
        .from("test_case_steps")
        .select("*")
        .eq("test_case_id", selectedTestCase.id)
        .order("step_number");
      
      if (error) throw error;
      return data as TestCaseStep[];
    },
    enabled: !!selectedTestCase,
  });

  // Fetch version history
  const { data: versions = [] } = useQuery({
    queryKey: ["test-case-versions", selectedTestCase?.id],
    queryFn: async () => {
      if (!selectedTestCase) return [];
      const { data, error } = await supabase
        .from("test_case_versions")
        .select("*")
        .eq("test_case_id", selectedTestCase.id)
        .order("version", { ascending: false });
      
      if (error) throw error;
      return data as TestCaseVersion[];
    },
    enabled: !!selectedTestCase && isVersionHistoryOpen,
  });

  // Create test case mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("test_cases")
        .insert({
          title: newTitle,
          description: newDescription,
          preconditions: newPreconditions,
          expected_result: newExpectedResult,
          created_by: user?.id,
          status: "draft" as TestCaseStatus,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-cases"] });
      toast.success("Test case created successfully");
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Failed to create test case: " + error.message);
    },
  });

  // Delete test case mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("test_cases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-cases"] });
      toast.success("Test case deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete: " + error.message);
    },
  });

  const resetForm = () => {
    setNewTitle("");
    setNewDescription("");
    setNewPreconditions("");
    setNewExpectedResult("");
  };

  // Filter test cases
  const filteredTestCases = testCases.filter((tc) => {
    const matchesSearch = tc.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || tc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: testCases.length,
    active: testCases.filter((tc) => tc.status === "active").length,
    aiGenerated: testCases.filter((tc) => tc.ai_generated).length,
    avgCoverage: testCases.length > 0 ? Math.round(
      testCases.filter((tc) => tc.coverage_tags && tc.coverage_tags.length > 0).length / 
      testCases.length * 100
    ) : 0,
  };

  const handleAIGenerate = async () => {
    setIsGenerating(true);
    // Simulate AI generation
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // Create mock AI-generated test cases
    const mockGeneratedCases = [
      {
        title: `TC-${Date.now()}: User Login Validation`,
        description: "Verify that users can log in with valid credentials",
        preconditions: "User account exists in the system",
        expected_result: "User is successfully logged in and redirected to dashboard",
      },
      {
        title: `TC-${Date.now() + 1}: Invalid Password Handling`,
        description: "Verify system behavior with invalid password",
        preconditions: "User account exists in the system",
        expected_result: "Error message displayed, user remains on login page",
      },
    ];
    
    for (const tc of mockGeneratedCases) {
      await supabase.from("test_cases").insert({
        ...tc,
        created_by: user?.id,
        status: "draft" as TestCaseStatus,
        ai_generated: true,
        ai_confidence: 0.85,
      });
    }
    
    queryClient.invalidateQueries({ queryKey: ["test-cases"] });
    setIsGenerating(false);
    setIsAIGenerateOpen(false);
    setAIPrompt("");
    toast.success(`Generated ${mockGeneratedCases.length} test cases`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title="Test Cases"
          description="AI-powered test case management with coverage tracking"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsAIGenerateOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4 text-accent" />
                AI Generate
              </Button>
              <Button className="ai-gradient text-white" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Test Case
              </Button>
            </div>
          }
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <TestTube className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Cases</p>
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
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-xs text-muted-foreground">Active Cases</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                  <Brain className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.aiGenerated}</p>
                  <p className="text-xs text-muted-foreground">AI Generated</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <Target className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.avgCoverage}%</p>
                  <p className="text-xs text-muted-foreground">Coverage</p>
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
              placeholder="Search test cases..."
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
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="deprecated">Deprecated</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Test Cases Table */}
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
                    <TableHead>Test Case</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Coverage</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {filteredTestCases.map((tc) => (
                      <motion.tr
                        key={tc.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="border-b transition-colors hover:bg-muted/50"
                      >
                        <TableCell>
                          <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                              <TestTube className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{tc.title}</p>
                                {tc.ai_generated && (
                                  <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20 text-xs">
                                    <Sparkles className="mr-1 h-3 w-3" />
                                    AI
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {tc.description || "No description"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColors[tc.status]}>
                            {statusIcons[tc.status]}
                            <span className="ml-1">{tc.status}</span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            tc.priority <= 1 ? "bg-destructive/10 text-destructive" :
                            tc.priority <= 2 ? "bg-warning/10 text-warning" :
                            "bg-muted text-muted-foreground"
                          }>
                            P{tc.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={tc.coverage_tags?.length ? Math.min(tc.coverage_tags.length * 20, 100) : 0} 
                              className="h-2 w-16" 
                            />
                            <span className="text-xs text-muted-foreground">
                              {tc.coverage_tags?.length || 0} tags
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">v{tc.version}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(tc.created_at).toLocaleDateString()}
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
                                setSelectedTestCase(tc);
                                setIsViewDialogOpen(true);
                              }}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedTestCase(tc);
                                setIsVersionHistoryOpen(true);
                              }}>
                                <History className="mr-2 h-4 w-4" />
                                Version History
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Copy className="mr-2 h-4 w-4" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => deleteMutation.mutate(tc.id)}
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
                  {filteredTestCases.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <div className="flex flex-col items-center">
                          <TestTube className="h-8 w-8 text-muted-foreground mb-2" />
                          <p className="text-muted-foreground">No test cases found</p>
                          <Button variant="link" className="mt-2" onClick={() => setIsCreateDialogOpen(true)}>
                            Create your first test case
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create Test Case Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Test Case</DialogTitle>
              <DialogDescription>
                Define a new test case with steps and expected results.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Verify user login with valid credentials"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this test case verifies..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preconditions">Preconditions</Label>
                <Textarea
                  id="preconditions"
                  placeholder="What conditions must be met before running this test?"
                  value={newPreconditions}
                  onChange={(e) => setNewPreconditions(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expected">Expected Result</Label>
                <Textarea
                  id="expected"
                  placeholder="What is the expected outcome?"
                  value={newExpectedResult}
                  onChange={(e) => setNewExpectedResult(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !newTitle}
              >
                {createMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Create Test Case
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AI Generate Dialog */}
        <Dialog open={isAIGenerateOpen} onOpenChange={setIsAIGenerateOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                AI Test Case Generator
              </DialogTitle>
              <DialogDescription>
                Describe the feature or requirement, and AI will generate comprehensive test cases.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="ai-prompt">Describe the feature to test</Label>
                <Textarea
                  id="ai-prompt"
                  placeholder="e.g., User authentication system with email/password login, password reset, and session management..."
                  value={aiPrompt}
                  onChange={(e) => setAIPrompt(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="rounded-lg bg-accent/5 border border-accent/20 p-4">
                <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-accent" />
                  AI will generate test cases for:
                </h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Happy path scenarios</li>
                  <li>• Edge cases and boundary conditions</li>
                  <li>• Error handling and negative tests</li>
                  <li>• Security and validation tests</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAIGenerateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAIGenerate}
                disabled={isGenerating || !aiPrompt}
                className="ai-gradient text-white"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Test Cases
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Test Case Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5 text-primary" />
                {selectedTestCase?.title}
                {selectedTestCase?.ai_generated && (
                  <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20">
                    <Sparkles className="mr-1 h-3 w-3" />
                    AI Generated
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1">{selectedTestCase?.description || "No description"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Preconditions</Label>
                  <p className="mt-1">{selectedTestCase?.preconditions || "None specified"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Expected Result</Label>
                  <p className="mt-1">{selectedTestCase?.expected_result || "None specified"}</p>
                </div>
                {steps.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Test Steps</Label>
                    <div className="mt-2 space-y-2">
                      {steps.map((step) => (
                        <div key={step.id} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium shrink-0">
                            {step.step_number}
                          </span>
                          <div>
                            <p className="text-sm font-medium">{step.action}</p>
                            {step.expected_result && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Expected: {step.expected_result}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedTestCase?.ai_confidence && (
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground">AI Confidence:</Label>
                    <Progress value={selectedTestCase.ai_confidence * 100} className="h-2 w-24" />
                    <span className="text-sm">{Math.round(selectedTestCase.ai_confidence * 100)}%</span>
                  </div>
                )}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                Close
              </Button>
              <Button>
                <Edit className="mr-2 h-4 w-4" />
                Edit Test Case
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Version History Dialog */}
        <Dialog open={isVersionHistoryOpen} onOpenChange={setIsVersionHistoryOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Version History
              </DialogTitle>
              <DialogDescription>
                {selectedTestCase?.title}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-3">
                {versions.length > 0 ? versions.map((version) => (
                  <div key={version.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-medium shrink-0">
                      v{version.version}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{version.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {version.changes_summary || "No changes recorded"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(version.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">
                      Restore
                    </Button>
                  </div>
                )) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No version history available</p>
                  </div>
                )}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsVersionHistoryOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
