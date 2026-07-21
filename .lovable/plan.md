# Overhaul Plan — 10 Items

Big scope, so I'm bundling by system to avoid rework. Two DB migrations, ~20 file edits, 3 new/updated edge functions. Nothing here is mocked — every button will call a real backend.

## 1. Navigation cleanup
- **Remove** `Users` from sidebar (`AppSidebar.tsx`); keep the route redirecting to `/organization` (People tab).
- **Remove** `Test Cycles` from sidebar. Keep route accessible from Test Plan detail.
- **Reorder** sidebar so `Integrations` sits directly below `Audit Log`.

## 2. Organization page — People/Users tab
- Move the full `UsersPage` content into a new **People** tab in `OrganizationPage.tsx`.
- Real membership CRUD via `organization_members`: invite by email (creates `workspace_invitations` row scoped to org's default workspace + sends real email), change role (owner/billing_admin/security_admin/member), remove.
- Real **usage** cards: seats used (count distinct `organization_members`), projects (count), AI jobs this month (sum from `usage_events`), runner minutes this month.

## 3. Real Google sign-up
- Wire `GoogleAuthButton` to `supabase.auth.signInWithOAuth({ provider: 'google' })` using Lovable Cloud's managed Google OAuth (no keys needed).
- Add button to both `LoginPage` and `RegisterPage` (register currently missing it).
- Ensure `handle_new_user` trigger creates profile + personal org on first Google sign-in (verify existing trigger covers this path).

## 4. Real email + in-app notifications on key events
- New edge function `notify-event` (or extend existing `dispatch-notification`) called from:
  - `WorkspaceWizard` after workspace create
  - `ProjectWizard` after project create
  - `TestPlanWizard` after test plan create
  - `PlanPeoplePanel` / project member add after assignment
- Each event inserts into `notifications` (for every relevant recipient) AND queues an email via the existing Lovable Emails infra (`enqueue_email` → templated).
- New transactional email templates: `workspace-created`, `project-created`, `testplan-created`, `member-assigned` (in `_shared/transactional-email-templates/`, registered).

## 5. Global (org-level) notification configuration on Integrations page
- Remove the Notifications step from `ProjectWizard`.
- New card on `IntegrationsPage`: **Notification Delivery** — toggles for Email/Slack, category matrix, applied org-wide (stored on `organizations.notification_config` JSONB).
- `dispatch-notification` reads org-level config instead of per-user only.

## 6. Real Slack integration + per-project channel
- Slack: use the built-in Slack App Connector via `standard_connectors`. Add connect button on `IntegrationsPage`; on success we store `slack_workspace_id` + `slack_bot_token` env is provided by connector.
- On project create, edge function `slack-provision-channel` calls Slack `conversations.create` with slugified project name → stores channel id on `projects.slack_channel_id`.
- `dispatch-notification` posts to the project's channel for any project-scoped event (falls back to org default channel).
- Note: real Slack requires the workspace admin to connect Slack in the connector UI. I'll wire the UI + backend; the user completes the one-click connect.

## 7. Project AI Docs page cleanup
- `GeneratedDocsPanel.tsx`: remove the second "Extract endpoints, tests & requirements" button (keep the top-header one).
- **Wire real downloads**: replace the toast-only handler with actual blob download for single file + zip via `jszip` for bulk (already used elsewhere or add).

## 8. Settings → Appearance
- Remove "System" theme option, activate real Light mode toggle (currently disabled).
- Remove Language selector entirely from `SettingsPage`.

## 9. Migrations
- `organizations`: add `notification_config JSONB`, `slack_team_id TEXT`, `default_slack_channel_id TEXT`.
- `projects`: add `slack_channel_id TEXT`.
- Trigger `on_notification_insert` (already exists) — extend payload to include project_id for channel routing.

## Technical Notes
- Email uses Lovable Emails (`enqueue_email` RPC). Domain must be set; if not, emails silently no-op and only in-app notifications fire.
- Slack channel creation requires `channels:manage` scope on the connector — I'll surface a scope-missing warning in the UI if not present.
- Google OAuth uses managed credentials; user does not need to configure anything.
- Usage calculations query `usage_events` (already metered).

Proceed?