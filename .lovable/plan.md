# Jira + GitHub Integration: Sync, Mapping, Settings, Activity

## 1. Schema (one migration)

New / extended tables (workspace-scoped, RLS via `is_workspace_member`):

- `integration_connections` — add columns:
  - `sync_enabled boolean default true`
  - `last_error text`, `last_error_at timestamptz`
- `jira_project_mappings` — links a Qualixa project to a Jira project key
  - `workspace_id, project_id, jira_cloud_id, jira_project_key, auto_link_rule jsonb` (e.g. `{ "match": "summary", "labels": ["bug"] }`)
- `github_repo_mappings` — links a Qualixa project to a GitHub repo
  - `workspace_id, project_id, owner, repo, default_branch, test_plan_id (nullable)`
- `integration_activity_log` — every connect / sync / OAuth attempt
  - `workspace_id, provider, kind ('oauth_connect'|'oauth_callback'|'sync'|'disconnect'), status ('ok'|'error'), message, counts jsonb, user_id, occurred_at`
- `defects` — add `jira_issue_key text`, `jira_issue_url text` (nullable)
- `builds` — already has `commit_sha`; add `gh_run_id bigint`, `gh_workflow text` if absent

GRANTs and RLS per Lovable rules; all log writes via `service_role` from edge fns.

## 2. Edge functions

- `oauth-start` (exists) — extend to log to `integration_activity_log` and surface popup-blocked / bad-state errors
- `oauth-github-callback`, `oauth-jira-callback` (exist) — write activity log row on success/failure
- `integrations-disconnect` (new, JWT) — `{provider}` → flips status='disconnected', wipes `config.access_token`, logs row
- `integrations-reconnect` (new, JWT) — alias of disconnect + returns fresh `oauth-start` URL in one round trip
- `github-sync` (new, JWT) — pulls workflow runs for each mapped repo, upserts into `builds` (matched on `gh_run_id`), links to `test_plan_id` when the mapping sets one. Returns counts.
- `jira-sync` (new, JWT) — for each mapping: fetches issues with JQL (default: `updated >= -7d`), upserts a `defect_links` row keyed by `jira_issue_key`, refreshes `defects.jira_issue_key/url` for any defect whose summary matches the configured rule.
- `integrations-callback-info` (new, public read) — returns the two callback URLs the user must register, so the UI can render them (no hard-coded Supabase URLs in the React code).

All sync edge fns: rate-limit per workspace (1/min), capture errors into `integration_activity_log`, refresh Jira access token via `refresh_token` when expired.

## 3. New page: `/integrations/settings`

Three tabs:

- **Connections** — GitHub and Jira cards with:
  - "Connected / Not connected" pill (green/grey)
  - Connect / Disconnect / Reconnect buttons
  - Sync toggle (writes `sync_enabled`)
  - **Callback URLs** block with copy buttons — fetched from `integrations-callback-info`
- **Project Mapping** — per Qualixa project:
  - Jira: pick `jira_cloud_id` from connection's `sites`, type a Jira project key, configure auto-link rule (`match summary` / `match labels` / both)
  - GitHub: pick `owner/repo` from connection's repos (fetched on-demand via gateway), set default branch, optionally bind to a Test Plan
- **Sync / Activity** — table of last 50 rows from `integration_activity_log`, with manual "Sync now" buttons for GitHub and Jira; shows counts (e.g. "12 builds, 4 issues, 0 errors") and per-row error details.

## 4. Existing pages

- `IntegrationsPage.tsx` — keep cards, add real-time status pill from `integration_connections.status` and "Open Settings" link to `/integrations/settings`.
- `DefectsPage.tsx` — when `jira_issue_key` is set, render `[PROJ-123]` chip linking to `jira_issue_url`.
- `defects` insert path — call edge fn `jira-auto-link` (or run inline RPC) to find a Jira issue per the project's `auto_link_rule` and set `jira_issue_key` / `jira_issue_url`.

## 5. Frontend polish

- `src/lib/oauth-popup.ts` — refine error toasts:
  - popup blocked → "Please allow popups for this site and try again"
  - timeout (>5 min) → "OAuth timed out, please try again"
  - explicit "denied" / "access_denied" → "You declined the request"
- Status hook `useIntegrationStatus(workspaceId)` returning `{ github, jira }` with live updates via Supabase Realtime on `integration_connections`.

## Out of scope (ask if needed)

- Writing back to Jira (creating issues from defects)
- GitHub Issues sync (only workflow runs as requested)
- Cron-scheduled sync (manual "Sync now" only this round; can add `schedules` rows next iteration)
- Encryption-at-rest for `config.access_token` (relying on RLS + service-role isolation)

## Order of execution

1. Schema migration (single SQL)
2. Edge functions (5 new + 1 callback-info)
3. Hook + UI: `useIntegrationStatus`, new `/integrations/settings` page, defect chip, popup polish
4. Smoke: `supabase--curl_edge_functions` against `integrations-callback-info` and `github-sync` (dry-run)

Estimated diff: ~1,400 lines, mostly new files.
