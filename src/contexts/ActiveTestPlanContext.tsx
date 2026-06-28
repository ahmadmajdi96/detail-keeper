import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "./WorkspaceContext";

interface ActiveTestPlanCtx {
  activePlanId: string | null;
  activePlan: { id: string; name: string } | null;
  activeCaseIds: string[];
  setActivePlan: (planId: string | null) => Promise<void>;
  loading: boolean;
}

const Ctx = createContext<ActiveTestPlanCtx | undefined>(undefined);

const lsKey = (projectId: string | null) => `qap.activeTestPlan.${projectId ?? "none"}`;

export function ActiveTestPlanProvider({ children }: { children: ReactNode }) {
  const { currentProject } = useWorkspace();
  const projectId = currentProject?.id ?? null;
  const [activePlanId, setActivePlanIdState] = useState<string | null>(() =>
    localStorage.getItem(lsKey(projectId))
  );

  useEffect(() => {
    setActivePlanIdState(localStorage.getItem(lsKey(projectId)));
  }, [projectId]);

  const { data: activePlan = null } = useQuery({
    queryKey: ["active-test-plan", activePlanId],
    queryFn: async () => {
      if (!activePlanId) return null;
      const { data } = await supabase
        .from("test_plans")
        .select("id,name")
        .eq("id", activePlanId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!activePlanId,
  });

  const { data: caseLinks = [], isLoading } = useQuery({
    queryKey: ["active-plan-cases", activePlanId],
    queryFn: async () => {
      if (!activePlanId) return [];
      const { data } = await supabase
        .from("test_plan_test_cases")
        .select("test_case_id")
        .eq("test_plan_id", activePlanId);
      return (data || []) as { test_case_id: string }[];
    },
    enabled: !!activePlanId,
  });

  const activeCaseIds = useMemo(() => caseLinks.map((c) => c.test_case_id), [caseLinks]);

  const setActivePlan = async (planId: string | null) => {
    if (planId) localStorage.setItem(lsKey(projectId), planId);
    else localStorage.removeItem(lsKey(projectId));
    setActivePlanIdState(planId);
    // Reflect activation in DB: chosen plan -> active, previously active in this project -> draft
    if (projectId) {
      try {
        await supabase
          .from("test_plans")
          .update({ status: "draft" })
          .eq("project_id", projectId)
          .eq("status", "active");
        if (planId) {
          await supabase.from("test_plans").update({ status: "active" }).eq("id", planId);
        }
      } catch {
        /* non-fatal */
      }
    }
  };

  return (
    <Ctx.Provider value={{ activePlanId, activePlan, activeCaseIds, setActivePlan, loading: isLoading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useActiveTestPlan() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useActiveTestPlan must be used within ActiveTestPlanProvider");
  return c;
}
