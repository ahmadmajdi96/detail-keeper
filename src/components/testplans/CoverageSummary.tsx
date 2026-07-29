import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  FileSearch,
  ShieldCheck,
  Layers,
  Target,
  ListChecks,
  FileText,
} from "lucide-react";

interface Props { projectId: string; testPlanId: string }

interface RemoteCoverage {
  business_requirements_detected?: number;
  covered_by_smoke?: number;
  covered_by_regression?: number;
  requirements_covered_by_any_test_type?: number;
  requirement_coverage?: string | number;
  test_type_count?: number;
}

interface TestTypeRow {
  test_type?: string;
  requirements_covered?: number;
  requirement_coverage?: string | number;
  priority?: string;
  execution_scope?: string;
  evidence?: string;
}

const pct = (v: string | number | undefined) => {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace("%", ""));
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
};

const priorityClass = (p?: string) => {
  switch ((p || "").toUpperCase()) {
    case "P0": return "border-red-500/30 text-red-300";
    case "P1": return "border-amber-500/30 text-amber-300";
    case "P2": return "border-cyan-500/30 text-cyan-300";
    default: return "border-border text-muted-foreground";
  }
};

/**
 * Coverage snapshot for a test plan. Prefers the coverage report returned by
 * the Repo Reader SQA plan job (business requirements detected, smoke /
 * regression coverage, and per-test-type breakdown). Falls back to locally
 * computed requirement links when the service has not reported yet.
 */
export function CoverageSummary({ projectId, testPlanId }: Props) {
  const { data } = useQuery({
    queryKey: ["wb-coverage", projectId, testPlanId],
    queryFn: async () => {
      const [{ data: plan }, { data: reqs }, { data: planCases }] = await Promise.all([
        supabase
          .from("test_plans")
          .select("coverage_summary, test_type_coverage, coverage_source")
          .eq("id", testPlanId)
          .maybeSingle(),
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

      const remote = ((plan as any)?.coverage_summary ?? null) as RemoteCoverage | null;
      const testTypes = (((plan as any)?.test_type_coverage ?? []) as TestTypeRow[]) || [];
      const source = ((plan as any)?.coverage_source ?? null) as
        | { source_document?: string | null }
        | null;

      const local = {
        detected: requirementIds.length,
        smoke: smokeReqs.size,
        regression: regReqs.size,
        coverage: requirementIds.length ? Math.round((covered.size / requirementIds.length) * 100) : 0,
      };

      return {
        fromService: !!remote,
        sourceDocument: source?.source_document ?? null,
        detected: remote?.business_requirements_detected ?? local.detected,
        smoke: remote?.covered_by_smoke ?? local.smoke,
        regression: remote?.covered_by_regression ?? local.regression,
        anyType: remote?.requirements_covered_by_any_test_type ?? covered.size,
        coverage: remote ? pct(remote.requirement_coverage) : local.coverage,
        testTypeCount: remote?.test_type_count ?? testTypes.length,
        testTypes,
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
    { icon: ListChecks, label: "Covered by any test type", value: data.anyType, cls: "text-violet-400" },
  ];

  return (
    <div className="space-y-3 rounded-lg border border-border/50 bg-muted/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Target className="h-3.5 w-3.5" /> Coverage summary
        </div>
        {data.fromService && (
          <Badge variant="outline" className="text-[10px] border-accent/40 text-accent">
            Repo Reader
          </Badge>
        )}
      </div>

      {data.sourceDocument && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <FileText className="h-3 w-3" />
          <span className="truncate">Source: {data.sourceDocument}</span>
        </div>
      )}

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
        {data.testTypeCount > 0 && (
          <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-300">
            {data.testTypeCount} test types
          </Badge>
        )}
      </div>

      {data.testTypes.length > 0 && (
        <div className="space-y-2 border-t border-border/50 pt-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Coverage by test type
          </div>
          {data.testTypes.map((t, i) => (
            <div key={`${t.test_type}-${i}`} className="space-y-1 rounded-md bg-background/40 p-2">
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate text-xs font-medium">{t.test_type ?? "Unnamed"}</span>
                {t.priority && (
                  <Badge variant="outline" className={`text-[10px] ${priorityClass(t.priority)}`}>
                    {t.priority}
                  </Badge>
                )}
                <span className="font-mono text-[11px] text-muted-foreground">
                  {t.requirements_covered ?? 0} reqs · {pct(t.requirement_coverage)}%
                </span>
              </div>
              <Progress value={pct(t.requirement_coverage)} className="h-1" />
              {t.execution_scope && (
                <p className="text-[11px] text-muted-foreground">{t.execution_scope}</p>
              )}
              {t.evidence && (
                <p className="text-[11px] text-muted-foreground/80">Evidence: {t.evidence}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {data.detected === 0 && (
        <p className="text-[11px] text-muted-foreground">
          No requirements detected yet — generate QA documents or upload documents on the project to detect them.
        </p>
      )}
    </div>
  );
}
