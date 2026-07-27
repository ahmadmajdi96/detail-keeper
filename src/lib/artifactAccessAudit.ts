import { supabase } from "@/integrations/supabase/client";

/**
 * Access auditing for generated-artifact retrieval.
 *
 * Every attempt to download a pipeline stage's artifacts or to open the Forge
 * runner logs is recorded — whether it was allowed or denied by the caller's
 * role — so an administrator can later prove who pulled what, and who was
 * turned away.
 */

export type ArtifactAccessAction =
  | "artifact.stage_download_allowed"
  | "artifact.stage_download_denied"
  | "runnerlog.view_allowed"
  | "runnerlog.view_denied"
  | "runnerlog.download_allowed"
  | "runnerlog.download_denied";

/** Actions surfaced by the “Artifact access” preset on the audit log page. */
export const ARTIFACT_ACCESS_ACTIONS: ArtifactAccessAction[] = [
  "artifact.stage_download_allowed",
  "artifact.stage_download_denied",
  "runnerlog.view_allowed",
  "runnerlog.view_denied",
  "runnerlog.download_allowed",
  "runnerlog.download_denied",
];

const planScopeCache = new Map<string, { orgId: string | null; workspaceId: string | null }>();

/** Resolves the org/workspace a plan belongs to, so the entry lands in the right tenant log. */
async function scopeOfPlan(planId: string | null | undefined) {
  if (!planId) return { orgId: null, workspaceId: null };
  const cached = planScopeCache.get(planId);
  if (cached) return cached;

  let workspaceId: string | null = null;
  const { data: plan } = await supabase
    .from("test_plans")
    .select("workspace_id, project_id")
    .eq("id", planId)
    .maybeSingle();
  workspaceId = (plan as any)?.workspace_id ?? null;
  if (!workspaceId && (plan as any)?.project_id) {
    const { data: proj } = await supabase
      .from("projects").select("workspace_id").eq("id", (plan as any).project_id).maybeSingle();
    workspaceId = (proj as any)?.workspace_id ?? null;
  }

  let orgId: string | null = null;
  if (workspaceId) {
    const { data: ws } = await supabase
      .from("workspaces").select("organization_id").eq("id", workspaceId).maybeSingle();
    orgId = (ws as any)?.organization_id ?? null;
  }

  const scope = { orgId, workspaceId };
  planScopeCache.set(planId, scope);
  return scope;
}

export interface ArtifactAccessEvent {
  action: ArtifactAccessAction;
  /** Plan the artifacts belong to — used to resolve the tenant scope. */
  planId?: string | null;
  /** Pipeline stage the request targeted (docs / cases / codegen / persist / run). */
  stage?: string | null;
  /** Job the stage belongs to, when known. */
  jobId?: string | null;
  /** Effective role that produced the decision, for a human-readable trail. */
  role?: string | null;
  /** Why access was refused (only set on *_denied). */
  reason?: string | null;
  meta?: Record<string, unknown>;
}

/**
 * Records one allow/deny decision. Never throws — auditing must not be able to
 * block or break the user-facing action it describes.
 */
export async function logArtifactAccess(event: ArtifactAccessEvent) {
  try {
    const { orgId, workspaceId } = await scopeOfPlan(event.planId);
    await supabase.rpc("log_audit", {
      _org_id: orgId,
      _workspace_id: workspaceId,
      _action: event.action,
      _entity_kind: "test_plan",
      _entity_id: event.planId ?? null,
      _meta: {
        stage: event.stage ?? null,
        job_id: event.jobId ?? null,
        role: event.role ?? null,
        decision: event.action.endsWith("_denied") ? "denied" : "allowed",
        reason: event.reason ?? null,
        ...(event.meta ?? {}),
      } as any,
    });
  } catch (e) {
    console.warn("[audit] failed to record artifact access", event.action, e);
  }
}
