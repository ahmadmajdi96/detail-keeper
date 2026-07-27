import { supabase } from "@/integrations/supabase/client";

const orgCache = new Map<string, string | null>();

async function orgOfWorkspace(workspaceId: string | null): Promise<string | null> {
  if (!workspaceId) return null;
  if (orgCache.has(workspaceId)) return orgCache.get(workspaceId) ?? null;
  const { data } = await supabase
    .from("workspaces")
    .select("organization_id")
    .eq("id", workspaceId)
    .maybeSingle();
  const org = (data as any)?.organization_id ?? null;
  orgCache.set(workspaceId, org);
  return org;
}

export type SuiteAuditAction =
  | "suite.created"
  | "suite.updated"
  | "suite.deleted"
  | "suite.reordered"
  | "suite.cases_reordered"
  | "suite.case_moved"
  | "suite.cases_bulk_updated"
  | "suite.ai_rules_updated"
  | "suite.ai_grouping_proposed"
  | "suite.ai_grouping_applied"
  | "suite.ai_grouping_rolled_back"
  | "suite.ai_grouping_reapplied";

/** Actions surfaced by the “Suite activity” preset on the audit log page. */
export const SUITE_AUDIT_ACTIONS: SuiteAuditAction[] = [
  "suite.created",
  "suite.updated",
  "suite.deleted",
  "suite.reordered",
  "suite.cases_reordered",
  "suite.case_moved",
  "suite.cases_bulk_updated",
  "suite.ai_rules_updated",
  "suite.ai_grouping_proposed",
  "suite.ai_grouping_applied",
  "suite.ai_grouping_rolled_back",
  "suite.ai_grouping_reapplied",
];

/**
 * Records a suite/test-case governance event in the customer-facing audit log.
 * Failures never block the underlying mutation — they are logged only.
 */
export async function logSuiteAudit(params: {
  workspaceId: string | null;
  action: SuiteAuditAction;
  entityKind?: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
}) {
  try {
    const orgId = await orgOfWorkspace(params.workspaceId);
    await supabase.rpc("log_audit", {
      _org_id: orgId,
      _workspace_id: params.workspaceId,
      _action: params.action,
      _entity_kind: params.entityKind ?? "test_suite",
      _entity_id: params.entityId ?? null,
      _meta: (params.meta ?? {}) as any,
    });
  } catch (e) {
    console.warn("[audit] failed to record", params.action, e);
  }
}
