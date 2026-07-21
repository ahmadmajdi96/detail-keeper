# Plan

Six-part build. Item 6 requires a separate approval flow (Stripe enablement form) so I'll do it last.

## 1. Notifications page — swap "Mentions" for "Usage"
- Remove the Mentions tab/section from `src/pages/NotificationsPage.tsx`.
- Add a **Usage** tab that reuses the same data as `OrgUsageCard`: seats, workspaces, projects, AI jobs this month, runner minutes, storage. Per-user rows: my AI jobs, my executions, my defects opened, my test plans generated (aggregated from `usage_events` + counts on core tables), scoped to current org and (when set) current project/workspace.

## 2. Test Plans page — add summary cards
- On `src/pages/TestPlansPage.tsx`, add a top card row: Total plans, In progress, Ready for review, Signed off, Coverage %, Avg generation time. Cards use existing shadcn `Card` + accent gradients matching the Qualixa theme. Clicking a card filters the list below.

## 3 + 4. Reporting page — extend + make fully functional, project/workspace-scoped
- Rewrite `src/pages/ReportingPage.tsx` to honor `useProjectScope()` (already the standard).
- Sections:
  - **Overview KPIs**: pass rate, defect density, MTTR, cycle throughput, coverage %, AI job spend (from `usage_events`).
  - **Execution trends** (line, 30/60/90d selector) from `test_executions`.
  - **Defect metrics** (by severity/status) from `defects`.
  - **Coverage heatmap** (reuse `CoverageHeatmap`).
  - **Test plan progress** (stacked bar) from `test_plans`.
  - **Team performance** (reuse `TeamPerformanceChart`) filtered to project.
- Report actions:
  - Date range picker (7/30/90d + custom).
  - Project + workspace pill shows active scope (from context).
  - **Export CSV** and **Export PDF (print-to-PDF)** for each section.
  - **Save view**: persist filter set to a new `saved_reports` table (org+user scoped, RLS).
  - **Share link**: reuse existing `share_links` table so a snapshot URL is generated.

## 5. Audit Log — extend + cards + dynamic filters
- Extend `src/pages/AuditLogPage.tsx`:
  - Top card row: Total events (period), Unique actors, Failed/security events, Top action.
  - Dynamic filter chips populated from distinct values in the current result set: Actor, Action, Entity kind, Workspace. Multi-select; combined with existing search + date range.
  - Add page-size selector, group-by-day toggle, and keep CSV export.
  - Increase server limit to 5000 with pagination cursor.

## 6. Seamless Stripe (no user Stripe account required)
- Run `payments--recommend_payment_provider`, then call `payments--enable_stripe_payments` so a Lovable-managed Stripe test account is provisioned.
- After enablement, wire the returned checkout/webhook helpers into the existing `/billing` page (replacing the current BYOK path when the seamless integration is active). Products/prices are created in a follow-up step after enablement completes.

## Technical notes
- New table `saved_reports(id, org_id, user_id, name, scope jsonb, filters jsonb, timestamps)` with RLS: org members read, owner writes.
- No changes to existing auth/RLS helpers.
- All new queries scoped through `useProjectScope` for consistency.
