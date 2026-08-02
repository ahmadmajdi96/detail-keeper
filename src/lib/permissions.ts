/**
 * Unified capability layer (F, additive).
 *
 * This is a convenience wrapper over the existing role systems:
 *   - org_role         (owner, admin, billing_admin, security_admin, member)
 *   - workspace_role   (owner, admin, editor, viewer, guest)
 *   - project_role     (lead, contributor, viewer)
 *   - plan_role        (owner, assignee, reviewer, viewer)
 *
 * IT DOES NOT REPLACE the underlying columns, guards, or RLS policies —
 * it only consolidates client-side checks so pages stop hand-rolling them.
 * Server-side RLS remains the source of truth.
 */

export type OrgRole = "owner" | "admin" | "billing_admin" | "security_admin" | "member" | null | undefined;
export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer" | "guest" | null | undefined;
export type ProjectRole = "lead" | "contributor" | "viewer" | null | undefined;
export type PlanRole = "owner" | "assignee" | "reviewer" | "viewer" | null | undefined;

export interface CapabilityContext {
  orgRole?: OrgRole;
  workspaceRole?: WorkspaceRole;
  projectRole?: ProjectRole;
  planRole?: PlanRole;
}

export type Action =
  // workspace
  | "workspace.manage"
  | "workspace.invite"
  | "workspace.delete"
  // project
  | "project.manage"
  | "project.edit"
  | "project.view"
  | "project.delete"
  // test plan
  | "plan.edit"
  | "plan.signoff"
  | "plan.manage_assignees"
  // defects / test cases
  | "defect.comment"
  | "defect.edit"
  | "testcase.edit"
  // sharing / billing / audit / sso
  | "artifact.view"
  | "runnerlog.view"
  | "share.create"
  | "billing.manage"
  | "audit.view"
  | "sso.manage";

const wsWriter = (r: WorkspaceRole) => r === "owner" || r === "admin" || r === "editor";
const wsAdmin = (r: WorkspaceRole) => r === "owner" || r === "admin";
const wsAnyMember = (r: WorkspaceRole) => !!r; // includes guest
const orgAdmin = (r: OrgRole) => r === "owner" || r === "admin" || r === "security_admin";

export function can(action: Action, ctx: CapabilityContext = {}): boolean {
  const { orgRole, workspaceRole, projectRole, planRole } = ctx;
  switch (action) {
    case "workspace.manage":
    case "workspace.invite":
      return wsAdmin(workspaceRole);
    case "workspace.delete":
      return workspaceRole === "owner" || orgRole === "owner";

    case "project.manage":
      return wsAdmin(workspaceRole) || projectRole === "lead";
    case "project.edit":
      return wsWriter(workspaceRole) || projectRole === "lead" || projectRole === "contributor";
    case "project.view":
      // guests + viewers can view what's explicitly shared with them
      return wsAnyMember(workspaceRole) || !!projectRole;
    case "project.delete":
      return wsAdmin(workspaceRole);

    case "plan.edit":
      // Assignees execute the plan but do not edit it — mirrors
      // public.can_edit_test_plan in the database.
      return (
        wsWriter(workspaceRole) ||
        projectRole === "lead" ||
        projectRole === "contributor" ||
        planRole === "owner"
      );

    case "plan.signoff":
      return wsAdmin(workspaceRole) || planRole === "owner" || planRole === "reviewer";
    case "plan.manage_assignees":
      return wsAdmin(workspaceRole) || projectRole === "lead" || planRole === "owner";

    case "defect.comment":
      // Guests cannot comment; viewers can.
      return workspaceRole === "owner" || workspaceRole === "admin" || workspaceRole === "editor" || workspaceRole === "viewer"
        || projectRole === "lead" || projectRole === "contributor" || projectRole === "viewer";
    case "defect.edit":
      return wsWriter(workspaceRole) || projectRole === "lead" || projectRole === "contributor";

    case "testcase.edit":
      return wsWriter(workspaceRole) || projectRole === "lead" || projectRole === "contributor";

    case "artifact.view":
      // Generated artifacts (docs, cases, specs, run outputs) — any real
      // member of the plan/project/workspace, but never a guest.
      return wsWriter(workspaceRole) || workspaceRole === "viewer"
        || !!projectRole || !!planRole || orgAdmin(orgRole);
    case "runnerlog.view":
      // Runner logs can leak env/config details — writers & leads only.
      return wsWriter(workspaceRole) || projectRole === "lead" || projectRole === "contributor"
        || planRole === "owner" || planRole === "reviewer" || orgAdmin(orgRole);

    case "share.create":
      return wsAdmin(workspaceRole) || orgAdmin(orgRole);
    case "billing.manage":
      return orgRole === "owner" || orgRole === "billing_admin";
    case "audit.view":
      return orgRole === "owner" || orgRole === "admin" || orgRole === "security_admin";
    case "sso.manage":
      return orgRole === "owner" || orgRole === "security_admin";

    default:
      return false;
  }
}
