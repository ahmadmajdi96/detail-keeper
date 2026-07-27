import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FileSearch, ShieldCheck, Layers, Target } from "lucide-react";

interface Props { projectId: string; testPlanId: string }

/**
 * Pre-generation coverage snapshot: how many business requirements were
 * detected from imported documents, and how many are already covered by
 * smoke / regression test cases linked to requirements.
 */
export function CoverageSummary({ projectId, testPlanId }: Props) {
  const { data } = useQuery({
    queryKey: ["wb-coverage", projectId, testPlanId],
    queryFn: async () => {
      const [{ data: reqs }, { data: planCases }] = await Promise.all([
        supabase.from("requirements").select("id").eq("project_id", projectId),
        supabase
          .from("test_plan_test_cases")
          .select("test_case:test_cases!test_plan_test_cases_test_case_id_fkey(id, test_type)")
          .eq("test_plan_id", testPlanId),
      ]);

      const requirementIds = (reqs ?? []).map((r: any) => r.id);
      const cases = (planCases ?? []).map((r: any) => r.test_case).filter(Boolean);
      const caseIds = cases.map((c: any) => c.id);

      let links: any[] = [];
      if (caseIds.length) {
        const { data: l } = await supabase
          .from("test_case_links")
          .select("test_case_id, target_id, target_kind")
          .in("test_case_id", caseIds)
          .eq("target_kind", "requirement");
        links = l ?? [];
      }

      const typeOf = new Map<string, string>(cases.map((c: any) => [c.id, c.test_type ?? "regression"]));
      const smokeReqs = new Set<string>();
      const regReqs = new Set<string>();
      links.forEach((l) => {
        if (!requirementIds.includes(l.target_id)) return;
        (typeOf.get(l.test_case_id) === "smoke" ? smokeReqs : regReqs).add(l.target_id);
      });
      const covered = new Set([...smokeReqs, ...regReqs]);

      return {
        detected: requirementIds.length,
        smoke: smokeReqs.size,
        regression: regReqs.size,
        coverage: requirementIds.length ? Math.round((covered.size / requirementIds.length) * 100) : 0,
        smokeCases: cases.filter((c: any) => c.test_type === "smoke").length,
        regressionCases: cases.filter((c: any) => (c.test_type ?? "regression") !== "smoke").length,
      };
    },
    enabled: !!projectId && !!testPlanId,
  });

  if (!data) return null;

  const items = [
    { icon: FileSearch, label: "Business requirements detected", value: data.detected, cls: "text-accent" },
    { icon: ShieldCheck, label: "Covered by smoke", value: data.smoke, cls: "text-emerald-400" },
    { icon: Layers, label: "Covered by regression", value: data.regression, cls: "text-cyan-400" },
  ];

  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/10 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Target className="h-3.5 w-3.5" /> Coverage summary
      </div>
      <div className="space-y-1.5">
        {items.map((i) => (
          <div key={i.label} className="flex items-center gap-2 text-xs">
            <i.icon className={`h-3.5 w-3.5 ${i.cls}`} />
            <span className="text-muted-foreground flex-1">{i.label}</span>
            <span className="font-mono font-medium">{i.value}</span>
          </div>
        ))}
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Requirement coverage</span>
          <span className="font-mono font-semibold">{data.coverage}%</span>
        </div>
        <Progress value={data.coverage} className="h-1.5" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-300">
          Smoke {data.smokeCases}
        </Badge>
        <Badge variant="outline" className="text-[10px] border-cyan-500/30 text-cyan-300">
          Regression {data.regressionCases}
        </Badge>
      </div>
      {data.detected === 0 && (
        <p className="text-[11px] text-muted-foreground">
          No requirements imported yet — upload documents or connect a repo on the project to detect them.
        </p>
      )}
    </div>
  );
}
