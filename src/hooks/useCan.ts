import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { can, type Action, type CapabilityContext, type PlanRole, type ProjectRole, type WorkspaceRole } from "@/lib/permissions";

interface UseCanOptions {
  projectId?: string | null;
  planId?: string | null;
}

/**
 * Consolidates existing role systems into one convenience hook.
 * The underlying columns and RLS policies remain unchanged — this only
 * saves pages from re-implementing membership joins.
 */
export function useCan(opts: UseCanOptions = {}) {
  const { user } = useAuth();
  const { currentOrgRole } = useOrganization();
  const { currentWorkspace } = useWorkspace();
  const currentWorkspaceId = currentWorkspace?.id ?? null;

  const [workspaceRole, setWorkspaceRole] = useState<WorkspaceRole>(null);
  const [projectRole, setProjectRole] = useState<ProjectRole>(null);
  const [planRole, setPlanRole] = useState<PlanRole>(null);

  useEffect(() => {
    if (!user?.id || !currentWorkspaceId) { setWorkspaceRole(null); return; }
    (async () => {
      const { data: ws } = await supabase.from("workspaces").select("owner_id").eq("id", currentWorkspaceId).maybeSingle();
      if (ws?.owner_id === user.id) { setWorkspaceRole("owner"); return; }
      const { data } = await supabase.from("workspace_members").select("role")
        .eq("workspace_id", currentWorkspaceId).eq("user_id", user.id).maybeSingle();
      setWorkspaceRole((data?.role as WorkspaceRole) ?? null);
    })();
  }, [user?.id, currentWorkspaceId]);

  useEffect(() => {
    if (!user?.id || !opts.projectId) { setProjectRole(null); return; }
    (async () => {
      const { data } = await supabase.from("project_members").select("role")
        .eq("project_id", opts.projectId!).eq("user_id", user.id).maybeSingle();
      setProjectRole((data?.role as ProjectRole) ?? null);
    })();
  }, [user?.id, opts.projectId]);

  useEffect(() => {
    if (!user?.id || !opts.planId) { setPlanRole(null); return; }
    (async () => {
      const { data } = await supabase.from("test_plan_assignees").select("role")
        .eq("test_plan_id", opts.planId!).eq("user_id", user.id).maybeSingle();
      setPlanRole((data?.role as PlanRole) ?? null);
    })();
  }, [user?.id, opts.planId]);

  const ctx: CapabilityContext = {
    orgRole: currentOrgRole as any,
    workspaceRole,
    projectRole,
    planRole,
  };

  return {
    ctx,
    can: (action: Action) => can(action, ctx),
    workspaceRole,
    projectRole,
    planRole,
  };
}
