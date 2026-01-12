import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Save,
  Plus,
  Trash2,
  GripVertical,
  TestTube,
  Sparkles,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Tag,
  X,
} from "lucide-react";
import type { TestCase, TestCaseStep, TestCaseStatus } from "@/types";

interface StepFormData {
  id?: string;
  step_number: number;
  action: string;
  expected_result: string;
  isNew?: boolean;
}

export default function TestCaseEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [preconditions, setPreconditions] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [priority, setPriority] = useState<number>(2);
  const [status, setStatus] = useState<TestCaseStatus>("draft");
  const [coverageTags, setCoverageTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [steps, setSteps] = useState<StepFormData[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch test case if editing
  const { data: testCase, isLoading: testCaseLoading } = useQuery({
    queryKey: ["test-case", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("test_cases")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as TestCase;
    },
    enabled: isEditing,
  });

  // Fetch test case steps if editing
  const { data: existingSteps = [] } = useQuery({
    queryKey: ["test-case-steps", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("test_case_steps")
        .select("*")
        .eq("test_case_id", id)
        .order("step_number");
      if (error) throw error;
      return data as TestCaseStep[];
    },
    enabled: isEditing,
  });

  // Populate form when editing
  useEffect(() => {
    if (testCase) {
      setTitle(testCase.title);
      setDescription(testCase.description || "");
      setPreconditions(testCase.preconditions || "");
      setExpectedResult(testCase.expected_result || "");
      setPriority(testCase.priority);
      setStatus(testCase.status);
      setCoverageTags(testCase.coverage_tags || []);
    }
  }, [testCase]);

  useEffect(() => {
    if (existingSteps.length > 0) {
      setSteps(existingSteps.map(s => ({
        id: s.id,
        step_number: s.step_number,
        action: s.action,
        expected_result: s.expected_result || "",
      })));
    }
  }, [existingSteps]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      setIsSaving(true);
      
      // Save or update test case
      let testCaseId = id;
      
      if (isEditing) {
        const { error } = await supabase
          .from("test_cases")
          .update({
            title,
            description,
            preconditions,
            expected_result: expectedResult,
            priority,
            status,
            coverage_tags: coverageTags,
            version: (testCase?.version || 1) + 1,
          })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("test_cases")
          .insert({
            title,
            description,
            preconditions,
            expected_result: expectedResult,
            priority,
            status,
            coverage_tags: coverageTags,
            created_by: user?.id,
          })
          .select()
          .single();
        if (error) throw error;
        testCaseId = data.id;
      }

      // Delete existing steps if editing
      if (isEditing) {
        await supabase.from("test_case_steps").delete().eq("test_case_id", id);
      }

      // Insert new steps
      if (steps.length > 0 && testCaseId) {
        const stepsToInsert = steps.map((step, index) => ({
          test_case_id: testCaseId,
          step_number: index + 1,
          action: step.action,
          expected_result: step.expected_result,
        }));

        const { error } = await supabase.from("test_case_steps").insert(stepsToInsert);
        if (error) throw error;
      }

      // Create version history entry if editing
      if (isEditing && testCase) {
        await supabase.from("test_case_versions").insert({
          test_case_id: id,
          version: (testCase.version || 1) + 1,
          title,
          description,
          changes_summary: "Updated via editor",
          modified_by: user?.id,
        });
      }

      return testCaseId;
    },
    onSuccess: (testCaseId) => {
      setIsSaving(false);
      queryClient.invalidateQueries({ queryKey: ["test-cases"] });
      toast.success(isEditing ? "Test case updated successfully" : "Test case created successfully");
      navigate("/test-cases");
    },
    onError: (error) => {
      setIsSaving(false);
      toast.error("Failed to save test case: " + error.message);
    },
  });

  const addStep = () => {
    setSteps([
      ...steps,
      {
        step_number: steps.length + 1,
        action: "",
        expected_result: "",
        isNew: true,
      },
    ]);
  };

  const updateStep = (index: number, field: keyof StepFormData, value: string) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const addTag = () => {
    if (newTag && !coverageTags.includes(newTag)) {
      setCoverageTags([...coverageTags, newTag]);
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    setCoverageTags(coverageTags.filter((t) => t !== tag));
  };

  if (testCaseLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title={isEditing ? "Edit Test Case" : "Create Test Case"}
          description="Define test steps, expected results, and preconditions"
          actions={
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/test-cases")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button
                className="ai-gradient text-white"
                onClick={() => saveMutation.mutate()}
                disabled={!title || isSaving}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {isEditing ? "Update" : "Create"}
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTube className="h-5 w-5" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Verify user login with valid credentials"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detailed description of what this test case verifies..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preconditions">Preconditions</Label>
                  <Textarea
                    id="preconditions"
                    value={preconditions}
                    onChange={(e) => setPreconditions(e.target.value)}
                    placeholder="What needs to be true before this test can run..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expectedResult">Expected Result</Label>
                  <Textarea
                    id="expectedResult"
                    value={expectedResult}
                    onChange={(e) => setExpectedResult(e.target.value)}
                    placeholder="What should happen when all steps pass..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Test Steps */}
            <Card className="border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Test Steps
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={addStep}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Step
                  </Button>
                </div>
                <CardDescription>
                  Define the step-by-step actions and expected results
                </CardDescription>
              </CardHeader>
              <CardContent>
                {steps.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">No steps defined yet</p>
                    <Button variant="outline" onClick={addStep}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add First Step
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                      {steps.map((step, index) => (
                        <motion.div
                          key={step.id || `new-${index}`}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className="flex gap-3 p-4 rounded-lg border border-border/50 bg-muted/30"
                        >
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-medium text-sm shrink-0">
                            {index + 1}
                          </div>
                          <div className="flex-1 space-y-3">
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Action</Label>
                              <Textarea
                                value={step.action}
                                onChange={(e) => updateStep(index, "action", e.target.value)}
                                placeholder="What action should be performed..."
                                rows={2}
                                className="resize-none"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Expected Result</Label>
                              <Textarea
                                value={step.expected_result}
                                onChange={(e) => updateStep(index, "expected_result", e.target.value)}
                                placeholder="What should happen after this step..."
                                rows={2}
                                className="resize-none"
                              />
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => removeStep(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status & Priority */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Properties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as TestCaseStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="deprecated">Deprecated</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={priority.toString()} onValueChange={(v) => setPriority(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">P1 - Critical</SelectItem>
                      <SelectItem value="2">P2 - High</SelectItem>
                      <SelectItem value="3">P3 - Medium</SelectItem>
                      <SelectItem value="4">P4 - Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Coverage Tags */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Tag className="h-4 w-4" />
                  Coverage Tags
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add tag..."
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  />
                  <Button variant="outline" size="icon" onClick={addTag}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {coverageTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="bg-accent/10 text-accent border-accent/20"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {coverageTags.length === 0 && (
                    <p className="text-sm text-muted-foreground">No tags added</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* AI Suggestion */}
            <Card className="border-border/50 border-accent/30 bg-accent/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-accent" />
                  AI Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Let AI analyze your test case and suggest improvements
                </p>
                <Button variant="outline" className="w-full" disabled>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Analyze Test Case
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
