import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Trash2,
} from "lucide-react";

interface Endpoint {
  id: string;
  method: string;
  path: string;
  summary: string | null;
  parameters: Array<{ name: string; in: string; type: string; required: boolean }>;
  request_body: Record<string, unknown> | null;
  headers: Array<{ name: string; required: boolean }>;
}

interface Assertion {
  type: "status" | "body_contains" | "header_exists" | "response_time" | "json_path";
  expected: string;
  key?: string;
  path?: string;
  description?: string;
}

interface ExecutionResult {
  status: string;
  responseStatus: number;
  responseTime: number;
  responseBody: string;
  responseHeaders: Record<string, string>;
  assertionResults: Array<{ assertion: string; passed: boolean; actual?: string }>;
}

interface ApiTestDialogProps {
  endpoint: Endpoint | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiTestDialog({ endpoint, open, onOpenChange }: ApiTestDialogProps) {
  const [baseUrl, setBaseUrl] = useState("https://");
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [body, setBody] = useState("");
  const [assertions, setAssertions] = useState<Assertion[]>([
    { type: "status", expected: "200", description: "Status code is 200" },
  ]);
  const [result, setResult] = useState<ExecutionResult | null>(null);

  const executeMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/execute-api-test`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            endpointId: endpoint?.id,
            baseUrl,
            method: endpoint?.method,
            path: endpoint?.path,
            headers,
            body: body ? JSON.parse(body) : null,
            assertions,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to execute test");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setResult(data.execution);
      if (data.execution.status === "passed") {
        toast.success("API test passed!");
      } else {
        toast.error("API test failed");
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to execute test");
    },
  });

  const addAssertion = () => {
    setAssertions([...assertions, { type: "status", expected: "", description: "" }]);
  };

  const removeAssertion = (index: number) => {
    setAssertions(assertions.filter((_, i) => i !== index));
  };

  const updateAssertion = (index: number, field: keyof Assertion, value: string) => {
    const updated = [...assertions];
    updated[index] = { ...updated[index], [field]: value };
    setAssertions(updated);
  };

  const addHeader = () => {
    const key = prompt("Header name:");
    if (key) {
      setHeaders({ ...headers, [key]: "" });
    }
  };

  if (!endpoint) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="outline">{endpoint.method}</Badge>
            <code className="text-sm">{endpoint.path}</code>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="request" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="request">Request</TabsTrigger>
            <TabsTrigger value="assertions">Assertions</TabsTrigger>
            <TabsTrigger value="response">Response</TabsTrigger>
          </TabsList>

          <TabsContent value="request" className="flex-1 overflow-auto space-y-4">
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.example.com"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Headers</Label>
                <Button size="sm" variant="outline" onClick={addHeader}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Header
                </Button>
              </div>
              <div className="space-y-2">
                {Object.entries(headers).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Input value={key} disabled className="w-1/3" />
                    <Input
                      value={value}
                      onChange={(e) =>
                        setHeaders({ ...headers, [key]: e.target.value })
                      }
                      placeholder="Value"
                      className="flex-1"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        const { [key]: _, ...rest } = headers;
                        setHeaders(rest);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {["POST", "PUT", "PATCH"].includes(endpoint.method.toUpperCase()) && (
              <div className="space-y-2">
                <Label>Request Body (JSON)</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder='{"key": "value"}'
                  className="font-mono text-sm min-h-[150px]"
                />
              </div>
            )}
          </TabsContent>

          <TabsContent value="assertions" className="flex-1 overflow-auto space-y-4">
            <div className="flex items-center justify-between">
              <Label>Test Assertions</Label>
              <Button size="sm" variant="outline" onClick={addAssertion}>
                <Plus className="h-3 w-3 mr-1" />
                Add Assertion
              </Button>
            </div>

            <div className="space-y-3">
              {assertions.map((assertion, index) => (
                <div key={index} className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                  <select
                    value={assertion.type}
                    onChange={(e) => updateAssertion(index, "type", e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="status">Status Code</option>
                    <option value="body_contains">Body Contains</option>
                    <option value="header_exists">Header Exists</option>
                    <option value="response_time">Response Time (ms)</option>
                    <option value="json_path">JSON Path</option>
                  </select>

                  {assertion.type === "json_path" && (
                    <Input
                      value={assertion.path || ""}
                      onChange={(e) => updateAssertion(index, "path", e.target.value)}
                      placeholder="data.id"
                      className="w-32"
                    />
                  )}

                  {assertion.type === "header_exists" && (
                    <Input
                      value={assertion.key || ""}
                      onChange={(e) => updateAssertion(index, "key", e.target.value)}
                      placeholder="Header name"
                      className="w-32"
                    />
                  )}

                  <Input
                    value={assertion.expected}
                    onChange={(e) => updateAssertion(index, "expected", e.target.value)}
                    placeholder={
                      assertion.type === "status"
                        ? "200"
                        : assertion.type === "response_time"
                        ? "1000"
                        : "Expected value"
                    }
                    className="flex-1"
                  />

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeAssertion(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="response" className="flex-1 overflow-hidden">
            <ScrollArea className="h-[400px]">
              {result ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {result.status === "passed" ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span className="font-medium">
                        {result.status === "passed" ? "Test Passed" : "Test Failed"}
                      </span>
                    </div>
                    <Badge variant="outline">Status: {result.responseStatus}</Badge>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {result.responseTime}ms
                    </div>
                  </div>

                  {result.assertionResults.length > 0 && (
                    <div className="space-y-2">
                      <Label>Assertion Results</Label>
                      {result.assertionResults.map((ar, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-2 p-2 rounded text-sm ${
                            ar.passed
                              ? "bg-green-500/10 text-green-400"
                              : "bg-red-500/10 text-red-400"
                          }`}
                        >
                          {ar.passed ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          <span>{ar.assertion}</span>
                          {ar.actual && (
                            <span className="text-muted-foreground">
                              (actual: {ar.actual})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Response Body</Label>
                    <pre className="p-4 rounded-lg bg-muted/50 text-sm font-mono overflow-auto max-h-[200px]">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(result.responseBody), null, 2);
                        } catch {
                          return result.responseBody;
                        }
                      })()}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Play className="h-12 w-12 mb-4 opacity-50" />
                  <p>Run the test to see results</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={() => executeMutation.mutate()}
            disabled={executeMutation.isPending || !baseUrl}
            className="ai-gradient text-white"
          >
            {executeMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Execute Test
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
