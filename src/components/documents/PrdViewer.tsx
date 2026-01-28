import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Target,
  CheckSquare,
  AlertTriangle,
  Link,
} from "lucide-react";

interface Prd {
  id: string;
  title: string;
  overview: string | null;
  objectives: string[];
  functional_requirements: string[];
  non_functional_requirements: string[];
  acceptance_criteria: string[];
  dependencies: string[];
  risks: Array<{ risk: string; mitigation: string }>;
  generated_at: string;
}

interface Endpoint {
  method: string;
  path: string;
}

interface PrdViewerProps {
  prd: Prd;
  endpoint?: Endpoint;
}

export function PrdViewer({ prd, endpoint }: PrdViewerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg ai-gradient">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">{prd.title}</CardTitle>
                  {endpoint && (
                    <code className="text-xs text-muted-foreground">
                      {endpoint.method} {endpoint.path}
                    </code>
                  )}
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
            {prd.overview && (
              <div>
                <h4 className="text-sm font-medium mb-2">Overview</h4>
                <p className="text-sm text-muted-foreground">{prd.overview}</p>
              </div>
            )}

            {prd.objectives && prd.objectives.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Target className="h-4 w-4 text-accent" />
                  Objectives
                </h4>
                <ul className="space-y-1">
                  {prd.objectives.map((obj, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-accent">•</span>
                      {obj}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {prd.functional_requirements && prd.functional_requirements.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Functional Requirements</h4>
                <ul className="space-y-1">
                  {prd.functional_requirements.map((req, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-green-400">✓</span>
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {prd.non_functional_requirements && prd.non_functional_requirements.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Non-Functional Requirements</h4>
                <ul className="space-y-1">
                  {prd.non_functional_requirements.map((req, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-blue-400">◆</span>
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {prd.acceptance_criteria && prd.acceptance_criteria.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-green-400" />
                  Acceptance Criteria
                </h4>
                <ul className="space-y-1">
                  {prd.acceptance_criteria.map((criteria, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <Badge variant="outline" className="text-[10px] shrink-0">AC-{i + 1}</Badge>
                      {criteria}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {prd.dependencies && prd.dependencies.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  Dependencies
                </h4>
                <div className="flex flex-wrap gap-2">
                  {prd.dependencies.map((dep, i) => (
                    <Badge key={i} variant="secondary">{dep}</Badge>
                  ))}
                </div>
              </div>
            )}

            {prd.risks && prd.risks.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  Risks & Mitigations
                </h4>
                <div className="space-y-2">
                  {prd.risks.map((risk, i) => (
                    <div key={i} className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <p className="text-sm font-medium text-yellow-400">{risk.risk}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        <span className="text-green-400">Mitigation:</span> {risk.mitigation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Generated: {new Date(prd.generated_at).toLocaleString()}
            </p>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
