import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ChevronDown,
  ChevronUp,
  TestTube,
  CheckCircle,
  XCircle,
  AlertCircle,
  Shield,
  Zap,
} from "lucide-react";

interface TestCase {
  id: string;
  name: string;
  description?: string;
  type: "positive" | "negative" | "edge_case" | "security" | "performance";
  priority: "high" | "medium" | "low";
  steps?: string[];
  expected_result: string;
  sample_request?: Record<string, unknown>;
}

interface TestPlan {
  id: string;
  name: string;
  description: string | null;
  test_cases: TestCase[];
  coverage_areas: string[];
  preconditions: string | null;
  status: string;
  generated_at: string;
}

interface Endpoint {
  method: string;
  path: string;
}

interface TestPlanViewerProps {
  testPlan: TestPlan;
  endpoint?: Endpoint;
}

export function TestPlanViewer({ testPlan, endpoint }: TestPlanViewerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "positive":
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case "negative":
        return <XCircle className="h-4 w-4 text-red-400" />;
      case "edge_case":
        return <AlertCircle className="h-4 w-4 text-yellow-400" />;
      case "security":
        return <Shield className="h-4 w-4 text-purple-400" />;
      case "performance":
        return <Zap className="h-4 w-4 text-blue-400" />;
      default:
        return <TestTube className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "positive":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "negative":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "edge_case":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "security":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "performance":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-muted";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-500/20 text-red-400";
      case "medium":
        return "bg-yellow-500/20 text-yellow-400";
      case "low":
        return "bg-green-500/20 text-green-400";
      default:
        return "bg-muted";
    }
  };

  const testCases = Array.isArray(testPlan.test_cases) ? testPlan.test_cases : [];
  const coverageAreas = Array.isArray(testPlan.coverage_areas) ? testPlan.coverage_areas : [];

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20">
                  <TestTube className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-base">{testPlan.name}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    {endpoint && (
                      <code className="text-xs text-muted-foreground">
                        {endpoint.method} {endpoint.path}
                      </code>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {testCases.length} test cases
                    </Badge>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-6">
            {testPlan.description && (
              <div>
                <h4 className="text-sm font-medium mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">{testPlan.description}</p>
              </div>
            )}

            {testPlan.preconditions && (
              <div>
                <h4 className="text-sm font-medium mb-2">Preconditions</h4>
                <p className="text-sm text-muted-foreground">{testPlan.preconditions}</p>
              </div>
            )}

            {coverageAreas.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Coverage Areas</h4>
                <div className="flex flex-wrap gap-2">
                  {coverageAreas.map((area, i) => (
                    <Badge key={i} variant="secondary">{area}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium mb-3">Test Cases</h4>
              <Accordion type="single" collapsible className="space-y-2">
                {testCases.map((tc, i) => (
                  <AccordionItem
                    key={tc.id || i}
                    value={tc.id || String(i)}
                    className="border rounded-lg px-4 bg-muted/30"
                  >
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-3 text-left">
                        {getTypeIcon(tc.type)}
                        <span className="text-sm font-medium">{tc.name}</span>
                        <Badge className={`${getTypeColor(tc.type)} text-xs`}>
                          {tc.type}
                        </Badge>
                        <Badge className={`${getPriorityColor(tc.priority)} text-xs`}>
                          {tc.priority}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4 space-y-3">
                      {tc.description && (
                        <p className="text-sm text-muted-foreground">{tc.description}</p>
                      )}

                      {tc.steps && tc.steps.length > 0 && (
                        <div>
                          <h5 className="text-xs font-medium mb-1">Steps</h5>
                          <ol className="list-decimal list-inside space-y-1">
                            {tc.steps.map((step, j) => (
                              <li key={j} className="text-sm text-muted-foreground">{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      <div>
                        <h5 className="text-xs font-medium mb-1">Expected Result</h5>
                        <p className="text-sm text-green-400">{tc.expected_result}</p>
                      </div>

                      {tc.sample_request && Object.keys(tc.sample_request).length > 0 && (
                        <div>
                          <h5 className="text-xs font-medium mb-1">Sample Request</h5>
                          <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                            {JSON.stringify(tc.sample_request, null, 2)}
                          </pre>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            <p className="text-xs text-muted-foreground">
              Generated: {new Date(testPlan.generated_at).toLocaleString()}
            </p>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
