import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const FLOW: { path: string; label: string }[] = [
  { path: "/workspaces", label: "Workspaces" },
  { path: "/projects", label: "Projects" },
  { path: "/test-plans", label: "Test Plans" },
  { path: "/test-cases", label: "Test Cases" },
  { path: "/executions", label: "Executions" },
];

export function WorkflowNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const idx = FLOW.findIndex((s) =>
    s.path === location.pathname ||
    (location.pathname.startsWith(s.path + "/") && s.path !== "/")
  );
  if (idx === -1) return null;

  const prev = idx > 0 ? FLOW[idx - 1] : null;
  const next = idx < FLOW.length - 1 ? FLOW[idx + 1] : null;

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={!prev}
        onClick={() => prev && navigate(prev.path)}
        title={prev ? `Back to ${prev.label}` : "No previous step"}
        className="gap-1.5"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden md:inline">{prev?.label ?? "Back"}</span>
      </Button>
      <span className="text-xs text-muted-foreground px-1 hidden lg:inline">
        Step {idx + 1}/{FLOW.length}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={!next}
        onClick={() => next && navigate(next.path)}
        title={next ? `Next: ${next.label}` : "End of workflow"}
        className="gap-1.5"
      >
        <span className="hidden md:inline">{next?.label ?? "Next"}</span>
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
