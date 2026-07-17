import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";

export interface Entitlements {
  seats: number | null;
  max_workspaces: number | null;
  max_projects: number | null;
  ai_jobs_per_month: number | null;
  runner_minutes_per_month: number | null;
  sso: boolean;
  audit_log: boolean;
  api_keys: boolean;
  priority_support: boolean;
}

const DEFAULT_ENT: Entitlements = {
  seats: 3, max_workspaces: 1, max_projects: 2,
  ai_jobs_per_month: 20, runner_minutes_per_month: 100,
  sso: false, audit_log: false, api_keys: false, priority_support: false,
};

export function useEntitlements() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const q = useQuery({
    queryKey: ["entitlements", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [{ data: subData }, { data: entData }] = await Promise.all([
        supabase.from("subscriptions").select("*").eq("org_id", orgId!).maybeSingle(),
        supabase.rpc("org_entitlements", { _org_id: orgId! }),
      ]);
      return {
        subscription: subData,
        entitlements: (entData as unknown as Entitlements) || DEFAULT_ENT,
      };
    },
  });

  return {
    entitlements: (q.data?.entitlements || DEFAULT_ENT) as Entitlements,
    subscription: q.data?.subscription,
    loading: q.isLoading,
    refresh: q.refetch,
    can: (feature: keyof Entitlements) => !!(q.data?.entitlements || DEFAULT_ENT)[feature],
  };
}

export function useOrgUsage() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: ["org-usage", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [aiJobs, runnerMin, wsCount, projCount, seatCount] = await Promise.all([
        supabase.rpc("org_usage_this_period", { _org_id: orgId!, _kind: "ai_job" }),
        supabase.rpc("org_usage_this_period", { _org_id: orgId!, _kind: "runner_minutes" }),
        supabase.from("workspaces").select("id", { count: "exact", head: true }).eq("organization_id", orgId!),
        supabase.from("projects").select("id,workspaces!inner(organization_id)", { count: "exact", head: true })
          .eq("workspaces.organization_id", orgId!),
        supabase.from("organization_members").select("id", { count: "exact", head: true }).eq("org_id", orgId!),
      ]);
      return {
        ai_jobs: Number(aiJobs.data || 0),
        runner_minutes: Number(runnerMin.data || 0),
        workspaces: wsCount.count || 0,
        projects: projCount.count || 0,
        seats: seatCount.count || 0,
      };
    },
    refetchInterval: 30000,
  });
}
