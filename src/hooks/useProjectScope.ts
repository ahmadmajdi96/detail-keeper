import { useWorkspace } from "@/contexts/WorkspaceContext";

/**
 * Returns the active project/workspace scope used for filtering and tagging
 * inserts across data pages. When a project is selected via the top-nav
 * project switcher, every list page and chart filters to that project only.
 */
export function useProjectScope() {
  const { currentProject, currentWorkspace } = useWorkspace();
  const projectId = currentProject?.id ?? null;
  const workspaceId = currentWorkspace?.id ?? null;

  return {
    projectId,
    workspaceId,
    /** Stable suffix for react-query keys */
    scopeKey: [workspaceId ?? "no-ws", projectId ?? "all"] as const,
    /** Apply project filter to a Supabase query builder (chain-friendly). */
    applyProjectFilter<T extends { eq: (col: string, val: any) => T }>(q: T): T {
      if (projectId) return q.eq("project_id", projectId);
      return q;
    },
    /** Merge project_id + workspace_id into an insert payload. */
    tag<T extends Record<string, any>>(payload: T): T & { project_id?: string; workspace_id?: string } {
      const out: any = { ...payload };
      if (projectId) out.project_id = projectId;
      if (workspaceId) out.workspace_id = workspaceId;
      return out;
    },
  };
}
