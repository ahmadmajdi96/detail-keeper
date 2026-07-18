import { describe, it, expect } from "vitest";
import { can } from "./permissions";

/**
 * These tests lock in the mapping between the existing role columns
 * (org_role / workspace_role / project_role / plan_role) and the
 * unified `can()` helper. They guarantee useCan() cannot drift from
 * the underlying RLS guards it wraps.
 */
describe("can()", () => {
  describe("workspace guards", () => {
    it("workspace.invite requires workspace owner or admin", () => {
      expect(can("workspace.invite", { workspaceRole: "owner" })).toBe(true);
      expect(can("workspace.invite", { workspaceRole: "admin" })).toBe(true);
      expect(can("workspace.invite", { workspaceRole: "editor" })).toBe(false);
      expect(can("workspace.invite", { workspaceRole: "viewer" })).toBe(false);
      expect(can("workspace.invite", { workspaceRole: "guest" })).toBe(false);
      expect(can("workspace.invite", {})).toBe(false);
    });

    it("workspace.delete requires workspace owner or org owner", () => {
      expect(can("workspace.delete", { workspaceRole: "owner" })).toBe(true);
      expect(can("workspace.delete", { workspaceRole: "admin" })).toBe(false);
      expect(can("workspace.delete", { orgRole: "owner" })).toBe(true);
      expect(can("workspace.delete", { orgRole: "billing_admin" })).toBe(false);
    });
  });

  describe("project guards", () => {
    it("project.edit accepts writers and project leads/contributors", () => {
      expect(can("project.edit", { workspaceRole: "editor" })).toBe(true);
      expect(can("project.edit", { projectRole: "lead" })).toBe(true);
      expect(can("project.edit", { projectRole: "contributor" })).toBe(true);
      expect(can("project.edit", { projectRole: "viewer" })).toBe(false);
      expect(can("project.edit", { workspaceRole: "viewer" })).toBe(false);
      expect(can("project.edit", { workspaceRole: "guest" })).toBe(false);
    });

    it("project.view is open to any workspace member (incl. guest) or any project role", () => {
      expect(can("project.view", { workspaceRole: "guest" })).toBe(true);
      expect(can("project.view", { projectRole: "viewer" })).toBe(true);
      expect(can("project.view", {})).toBe(false);
    });
  });

  describe("plan guards", () => {
    it("plan.signoff mirrors can_signoff_plan RLS: ws admin, plan owner, or reviewer", () => {
      expect(can("plan.signoff", { workspaceRole: "admin" })).toBe(true);
      expect(can("plan.signoff", { planRole: "owner" })).toBe(true);
      expect(can("plan.signoff", { planRole: "reviewer" })).toBe(true);
      expect(can("plan.signoff", { planRole: "assignee" })).toBe(false);
      expect(can("plan.signoff", { planRole: "viewer" })).toBe(false);
    });

    it("plan.manage_assignees mirrors can_manage_plan_assignees", () => {
      expect(can("plan.manage_assignees", { workspaceRole: "owner" })).toBe(true);
      expect(can("plan.manage_assignees", { projectRole: "lead" })).toBe(true);
      expect(can("plan.manage_assignees", { planRole: "owner" })).toBe(true);
      expect(can("plan.manage_assignees", { planRole: "reviewer" })).toBe(false);
    });
  });

  describe("org-level guards", () => {
    it("audit.view is limited to owner/admin/security_admin org roles", () => {
      expect(can("audit.view", { orgRole: "owner" })).toBe(true);
      expect(can("audit.view", { orgRole: "security_admin" })).toBe(true);
      expect(can("audit.view", { orgRole: "billing_admin" })).toBe(false);
      expect(can("audit.view", { orgRole: "member" })).toBe(false);
    });

    it("billing.manage is limited to owner/billing_admin", () => {
      expect(can("billing.manage", { orgRole: "owner" })).toBe(true);
      expect(can("billing.manage", { orgRole: "billing_admin" })).toBe(true);
      expect(can("billing.manage", { orgRole: "security_admin" })).toBe(false);
    });

    it("sso.manage is limited to owner/security_admin", () => {
      expect(can("sso.manage", { orgRole: "owner" })).toBe(true);
      expect(can("sso.manage", { orgRole: "security_admin" })).toBe(true);
      expect(can("sso.manage", { orgRole: "billing_admin" })).toBe(false);
    });

    it("share.create requires workspace admin or org admin", () => {
      expect(can("share.create", { workspaceRole: "admin" })).toBe(true);
      expect(can("share.create", { orgRole: "owner" })).toBe(true);
      expect(can("share.create", { orgRole: "security_admin" })).toBe(true);
      expect(can("share.create", { orgRole: "member" })).toBe(false);
      expect(can("share.create", { workspaceRole: "editor" })).toBe(false);
    });
  });

  it("unknown actions default to false", () => {
    // @ts-expect-error – exercising fallthrough
    expect(can("nope.nope", { orgRole: "owner", workspaceRole: "owner" })).toBe(false);
  });
});
