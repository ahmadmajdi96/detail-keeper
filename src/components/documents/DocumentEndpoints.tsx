import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { EndpointCard } from "./EndpointCard";
import { ApiTestDialog } from "./ApiTestDialog";
import { PrdViewer } from "./PrdViewer";
import { TestPlanViewer } from "./TestPlanViewer";
import {
  Loader2,
  FileText,
  TestTube,
  History,
  Sparkles,
} from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

interface DocumentEndpointsProps {
  documentId: string;
  documentName: string;
}

export function DocumentEndpoints({ documentId, documentName }: DocumentEndpointsProps) {
  const queryClient = useQueryClient();
  const [selectedEndpoint, setSelectedEndpoint] = useState<any>(null);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [generatingPrdFor, setGeneratingPrdFor] = useState<string | null>(null);
  const [generatingTestPlanFor, setGeneratingTestPlanFor] = useState<string | null>(null);

  const { data: endpoints = [], isLoading: loadingEndpoints } = useQuery({
    queryKey: ["api-endpoints", documentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_endpoints")
        .select("*")
        .eq("document_id", documentId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: prds = [], isLoading: loadingPrds } = useQuery({
    queryKey: ["endpoint-prds", documentId],
    queryFn: async () => {
      const endpointIds = endpoints.map((e) => e.id);
      if (endpointIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("endpoint_prds")
        .select("*")
        .in("endpoint_id", endpointIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: endpoints.length > 0,
  });

  const { data: testPlans = [], isLoading: loadingTestPlans } = useQuery({
    queryKey: ["endpoint-test-plans", documentId],
    queryFn: async () => {
      const endpointIds = endpoints.map((e) => e.id);
      if (endpointIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("endpoint_test_plans")
        .select("*")
        .in("endpoint_id", endpointIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: endpoints.length > 0,
  });

  const { data: executions = [], isLoading: loadingExecutions } = useQuery({
    queryKey: ["api-executions", documentId],
    queryFn: async () => {
      const endpointIds = endpoints.map((e) => e.id);
      if (endpointIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from("api_test_executions")
        .select("*, api_endpoints(method, path)")
        .in("endpoint_id", endpointIds)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: endpoints.length > 0,
  });

  const generatePrd = async (endpointId: string) => {
    setGeneratingPrdFor(endpointId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-prd`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ endpointId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate PRD");
      }

      queryClient.invalidateQueries({ queryKey: ["endpoint-prds", documentId] });
      toast.success("PRD generated successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate PRD");
    } finally {
      setGeneratingPrdFor(null);
    }
  };

  const generateTestPlan = async (endpointId: string) => {
    setGeneratingTestPlanFor(endpointId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-test-plan`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ endpointId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate test plan");
      }

      queryClient.invalidateQueries({ queryKey: ["endpoint-test-plans", documentId] });
      toast.success("Test plan generated successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate test plan");
    } finally {
      setGeneratingTestPlanFor(null);
    }
  };

  const handleExecuteTest = (endpoint: any) => {
    setSelectedEndpoint(endpoint);
    setShowTestDialog(true);
  };

  if (loadingEndpoints) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (endpoints.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No endpoints extracted yet</p>
          <p className="text-sm text-muted-foreground">Process the document to extract API endpoints</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{documentName}</h2>
          <p className="text-sm text-muted-foreground">
            {endpoints.length} endpoint{endpoints.length !== 1 ? "s" : ""} extracted
          </p>
        </div>
      </div>

      <Tabs defaultValue="endpoints" className="space-y-4">
        <TabsList>
          <TabsTrigger value="endpoints" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Endpoints ({endpoints.length})
          </TabsTrigger>
          <TabsTrigger value="prds" className="gap-2">
            <FileText className="h-4 w-4" />
            PRDs ({prds.length})
          </TabsTrigger>
          <TabsTrigger value="testplans" className="gap-2">
            <TestTube className="h-4 w-4" />
            Test Plans ({testPlans.length})
          </TabsTrigger>
          <TabsTrigger value="executions" className="gap-2">
            <History className="h-4 w-4" />
            Executions ({executions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="endpoints" className="space-y-3">
          {endpoints.map((endpoint) => (
            <EndpointCard
              key={endpoint.id}
              endpoint={endpoint as any}
              onGeneratePrd={generatePrd}
              onGenerateTestPlan={generateTestPlan}
              onExecuteTest={handleExecuteTest}
              isGeneratingPrd={generatingPrdFor === endpoint.id}
              isGeneratingTestPlan={generatingTestPlanFor === endpoint.id}
            />
          ))}
        </TabsContent>

        <TabsContent value="prds" className="space-y-3">
          {prds.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No PRDs generated yet</p>
                <p className="text-sm text-muted-foreground">Generate a PRD from any endpoint</p>
              </CardContent>
            </Card>
          ) : (
            prds.map((prd) => (
              <PrdViewer key={prd.id} prd={prd as any} endpoint={endpoints.find((e) => e.id === prd.endpoint_id) as any} />
            ))
          )}
        </TabsContent>

        <TabsContent value="testplans" className="space-y-3">
          {testPlans.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <TestTube className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No test plans generated yet</p>
                <p className="text-sm text-muted-foreground">Generate a test plan from any endpoint</p>
              </CardContent>
            </Card>
          ) : (
            testPlans.map((plan) => (
              <TestPlanViewer key={plan.id} testPlan={plan as any} endpoint={endpoints.find((e) => e.id === plan.endpoint_id) as any} />
            ))
          )}
        </TabsContent>

        <TabsContent value="executions" className="space-y-3">
          {executions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <History className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No test executions yet</p>
                <p className="text-sm text-muted-foreground">Execute tests to see results here</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <div className="divide-y divide-border">
                    {executions.map((exec) => (
                      <div key={exec.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={exec.status === "passed" ? "default" : "destructive"}
                            className={exec.status === "passed" ? "bg-green-500/20 text-green-400" : ""}
                          >
                            {exec.status}
                          </Badge>
                          <div>
                            <code className="text-sm">
                              {exec.api_endpoints?.method} {exec.api_endpoints?.path}
                            </code>
                            <p className="text-xs text-muted-foreground">
                              {new Date(exec.executed_at || exec.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Status: {exec.response_status}</span>
                          <span>{exec.response_time_ms}ms</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <ApiTestDialog
        endpoint={selectedEndpoint}
        open={showTestDialog}
        onOpenChange={setShowTestDialog}
      />
    </div>
  );
}
