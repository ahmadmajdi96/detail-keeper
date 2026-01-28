import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileText,
  TestTube,
  Play,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
} from "lucide-react";

interface Parameter {
  name: string;
  in: string;
  type: string;
  required: boolean;
  description?: string;
}

interface Endpoint {
  id: string;
  method: string;
  path: string;
  summary: string | null;
  description: string | null;
  parameters: Parameter[];
  request_body: Record<string, unknown> | null;
  response_schema: Record<string, unknown> | null;
  headers: Array<{ name: string; required: boolean; description?: string }>;
  authentication: string | null;
  tags: string[] | null;
}

interface EndpointCardProps {
  endpoint: Endpoint;
  onGeneratePrd: (endpointId: string) => void;
  onGenerateTestPlan: (endpointId: string) => void;
  onExecuteTest: (endpoint: Endpoint) => void;
  isGeneratingPrd: boolean;
  isGeneratingTestPlan: boolean;
}

export function EndpointCard({
  endpoint,
  onGeneratePrd,
  onGenerateTestPlan,
  onExecuteTest,
  isGeneratingPrd,
  isGeneratingTestPlan,
}: EndpointCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: "bg-green-500/20 text-green-400 border-green-500/30",
      POST: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      PUT: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      PATCH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
    };
    return colors[method.toUpperCase()] || "bg-muted text-muted-foreground";
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Badge className={`${getMethodColor(endpoint.method)} font-mono text-xs shrink-0`}>
              {endpoint.method}
            </Badge>
            <code className="text-sm font-mono text-foreground truncate">
              {endpoint.path}
            </code>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        {endpoint.summary && (
          <p className="text-sm text-muted-foreground mt-2">{endpoint.summary}</p>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          {endpoint.description && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">Description</h4>
              <p className="text-sm">{endpoint.description}</p>
            </div>
          )}

          {endpoint.parameters && endpoint.parameters.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Parameters</h4>
              <div className="space-y-1">
                {endpoint.parameters.map((param, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {param.name}
                    </code>
                    <span className="text-muted-foreground text-xs">({param.in})</span>
                    <span className="text-muted-foreground text-xs">{param.type}</span>
                    {param.required && (
                      <Badge variant="outline" className="text-[10px] h-4">required</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoint.authentication && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">Authentication</h4>
              <Badge variant="secondary">{endpoint.authentication}</Badge>
            </div>
          )}

          {endpoint.tags && endpoint.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {endpoint.tags.map((tag, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onGeneratePrd(endpoint.id)}
              disabled={isGeneratingPrd}
            >
              {isGeneratingPrd ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <FileText className="h-3 w-3 mr-1" />
              )}
              Generate PRD
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onGenerateTestPlan(endpoint.id)}
              disabled={isGeneratingTestPlan}
            >
              {isGeneratingTestPlan ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <TestTube className="h-3 w-3 mr-1" />
              )}
              Generate Test Plan
            </Button>
            <Button
              size="sm"
              className="ai-gradient text-white"
              onClick={() => onExecuteTest(endpoint)}
            >
              <Play className="h-3 w-3 mr-1" />
              Test API
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
