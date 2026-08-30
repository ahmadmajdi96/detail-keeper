# Qualixa — Complete Backend Specification (self-hosted build guide)

Everything the Qualixa frontend requires from a backend, written so you can build
it from scratch on your own infrastructure. Derived from the live application:
**116 tables, 27 enums, ~78 SQL functions, 60+ service endpoints**.

> Scope note: **payments/billing gateway integration is intentionally excluded.**
> Plan/entitlement tables are still described because feature-gating depends on
> them, but no checkout, portal, webhook or invoicing logic is specified.

---

## 1. Architecture

```text
  Browser (React SPA)
        │  HTTPS, JWT bearer
        ▼
  API gateway (Nginx/Traefik) — TLS, CORS, rate limiting, request IDs
        │
  ┌─────┴──────┬─────────────┬──────────────┬───────────────┐
  │ Core API   │ Auth service│ Realtime WS  │ Job workers   │
  │ REST + RPC │ JWT/OIDC/MFA│ change feeds │ queue pullers │
  └─────┬──────┴──────┬──────┴───────┬──────┴──────┬────────┘
        │             │              │             │
        ▼             ▼              ▼             ▼
     PostgreSQL 15+ (RLS, pgcrypto, pg_trgm, uuid-ossp, pg_cron)
        │                                  │
   Object storage (S3/MinIO)          Redis 7 (queue, cache, pub/sub)

  Outbound integrations:
   • Repo Reader   https://reporeader.qualixa.cortanexai.com  (ingestion, SQA plan,
     test-case generation, Playwright codegen, remote Playwright execution)
   • LLM gateway   OpenAI-compatible /chat/completions (PRD, analysis, release judge)
   • SMTP / Resend transactional email
   • GitHub, Jira  OAuth apps + REST sync
   • Self-hosted runners (pull/dispatch model) for local execution
```

Reference stack: **Node 20 + TypeScript (NestJS or Fastify)**, PostgreSQL 15,
Redis 7, MinIO, BullMQ, Socket.IO (or `LISTEN/NOTIFY` bridged to WS). Any stack
works if it satisfies the contracts below.

### 1.1 Non-functional requirements

| Concern | Requirement |
|---|---|
| Long jobs | AI/codegen/execution jobs run **25–60 minutes**; never tie them to an HTTP request. Poll/stream progress. |
| Idempotency | Every webhook and worker step must be replay-safe (unique external ids). |
| Multi-tenancy | Every row is reachable only through org → workspace → project scoping. |
| Auditability | All membership/role/visibility changes and artifact reads are logged. |
| Realtime | Lists (defects, executions, jobs, notifications) update without refresh. |
| Failure isolation | Outbound service outage must degrade a feature, not the app. |

---

## 2. Data model

Full generated data dictionary is in **Appendix A** (every table with its
columns, types, defaults and foreign keys). This section explains the shape.

### 2.1 Hierarchy

```text
organization            billing + identity root, owns SSO, API keys, audit
└── workspace           team boundary, invitations, storage quota
    └── project         ingestion unit (docs / zip / github), visibility flag
        ├── documents & requirements
        └── test plan   strategy unit — the app's main working surface
            ├── plan documents (AI generated + user managed)
            ├── test suites → test cases → steps
            ├── automation assets (Playwright specs)
            └── runs: automated (forge), manual sessions, cycles
```

### 2.2 Domain groups

**Tenancy & identity** — `organizations`, `organization_members`, `workspaces`,
`workspace_members`, `workspace_invitations`, `projects`, `project_members`,
`profiles`, `teams`, `sso_connections`, `mfa_recovery_codes`,
`deletion_requests`, `api_keys`.

**Requirements & documents** — `documents`, `project_generated_docs`,
`ingest_jobs`, `requirements`, `requirement_versions`, `requirement_links`,
`acceptance_criteria`, `doc_diff_comments`, `endpoint_prds`, `api_endpoints`,
`endpoint_test_plans`.

**Test design** — `test_plans`, `test_plan_versions`, `test_plan_documents`,
`test_plan_documents_v2`, `test_plan_document_versions`, `test_plan_specs`,
`test_plan_assignees`, `test_plan_test_cases`, `test_cases`, `test_case_steps`,
`test_case_versions`, `test_case_links`, `test_suites`, `suite_test_cases`,
`suite_grouping_versions`, `test_data_sets`, `test_parameters`,
`automation_assets`, `automation_mappings`.

**Execution** — `plan_test_runs`, `spec_runs`, `suite_runs`, `test_cycles`,
`cycle_runs`, `cycle_run_items`, `cycle_attempts`, `test_executions`,
`execution_step_results`, `manual_execution_sessions`,
`manual_execution_items`, `locator_analyses`, `evidence`, `environments`,
`builds`, `deployments`, `releases`, `release_evaluations`, `milestones`,
`schedules`.

**Defects & quality** — `defects`, `defect_comments`, `defect_history`,
`defect_links`, `defect_slas`, `root_cause_records`, `quality_gates`,
`gate_evaluations`, `waivers`, `approvals`.

**AI** — `ai_jobs`, `ai_outputs`, `ai_evaluations`, `ai_feedback`,
`ai_audit_events`, `ai_agents`, `agent_execution_logs`,
`agent_learning_sessions`, `generation_stage_logs`.

**Infrastructure** — `jobs`, `job_attempts`, `job_artifacts`, `runners`,
`runner_groups`, `runner_jobs`, `integrations`, `integration_connections`,
`integration_activity_log`, `ci_integrations`, `ci_runs`, `repositories`,
`repository_branches`, `commits`, `pull_requests`, `github_repo_mappings`,
`jira_project_mappings`, `sync_logs`, `webhook_endpoints`, `webhook_events`,
`webhook_deliveries`.

**Platform** — `plans`, `plan_entitlements`, `subscriptions` (entitlement source
only — no gateway), `usage_events`, `audit_logs`, `notifications`,
`notification_preferences`, `activity_events`, `share_links`,
`share_link_views`, `email_send_log`, `email_send_state`,
`email_unsubscribe_tokens`, `suppressed_emails`.

### 2.3 Table conventions (apply to every table)

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`,
  `updated_at timestamptz not null default now()` with a BEFORE UPDATE trigger
  calling `update_updated_at_column()`
- one tenant column: `org_id`, `workspace_id` or `project_id`, always indexed
- ownership columns: `created_by`, `reported_by`, `executor_id`, `assigned_to`
- row-level security enabled + explicit grants to the authenticated role
- JSONB for AI payloads (`payload`, `result`, `meta`, `checkpoint`, `snapshot`)

### 2.4 Enums

```text
agent_status        idle|learning|executing|paused|error
automation_status   manual|planned|automated|obsolete
build_status        pending|building|success|failed|cancelled
cycle_status        planned|in_progress|paused|completed|cancelled
defect_priority     urgent|high|medium|low
defect_severity     critical|major|minor|trivial
deployment_status   pending|deploying|deployed|failed|rolled_back
environment_type    local|dev|qa|uat|staging|production|sandbox|other
execution_status    pending|in_progress|passed|failed|blocked|skipped
invitation_status   pending|accepted|expired|revoked
job_status          queued|running|waiting|retrying|completed|failed|cancelled|dead_letter
org_role            owner|billing_admin|security_admin|member
plan_role           owner|assignee|reviewer|viewer
project_role        lead|contributor|viewer
project_source      documentation|zip|github
project_status      pending|processing|ready|failed|archived
project_visibility  inherited|restricted
release_status      planned|in_progress|released|blocked|cancelled
requirement_status  proposed|approved|obsolete
review_status       draft|in_review|approved|rejected
run_item_status     not_run|in_progress|passed|failed|blocked|skipped|not_applicable
run_status          planned|in_progress|completed|cancelled
subscription_status trialing|active|past_due|canceled
test_case_status    draft|active|deprecated|archived
user_role           admin|qa_manager|qa_engineer|viewer
user_status         active|pending|inactive|suspended
workspace_role      owner|admin|editor|viewer
```

---

## 3. Authorization model

Four nested tiers. Permissions inherit downward and can be narrowed, never
widened, by a lower tier.

1. **Organization** (`org_role`) — owner, billing_admin, security_admin, member.
   Controls SSO, API keys, audit log, data export, org deletion.
2. **Workspace** (`workspace_role`) — owner, admin, editor, viewer.
3. **Project** (`project_role`) — lead, contributor, viewer, plus
   `projects.visibility`: `inherited` (all workspace members) or `restricted`
   (only `project_members` + workspace owner/admin).
4. **Test plan** (`plan_role`) — owner, assignee, reviewer, viewer.

Cross-cutting account role `user_role` (admin / qa_manager / qa_engineer /
viewer) gates whole features.

### 3.1 Effective rules currently enforced

| Action | Allowed |
|---|---|
| Create/edit/delete workspace | workspace owner **and** qa_manager+ |
| Create project | workspace owner/admin/editor, qa_manager+ |
| See restricted project | project member, workspace owner/admin |
| Edit/delete test plan | plan creator, plan owner, qa_manager+ |
| Execute test plan | plan owner/assignee, qa_manager+ |
| Sign off release/plan | plan owner or reviewer, qa_manager+ |
| Manage plan assignees | plan owner, project lead, qa_manager+ |
| Edit/delete test case | its `created_by`, or qa_manager+ |
| Reporting, audit log | qa_manager / admin only |
| Org settings, API keys, SSO | org owner / security_admin |

### 3.2 Database helper functions (keep them in SQL)

Implement as `SECURITY DEFINER` SQL so the API and any direct SQL share one
truth. Signature list taken from the live database:

```text
-- identity / tenancy
current_app_role()              is_qa_manager()
is_org_member(org)              org_role_of(org)          current_user_org_ids()
org_of_workspace(ws)            org_for_sso_domain(domain)
is_workspace_member(ws,user)    workspace_role_of(ws,user)
is_project_member(project)      project_role_of(project)
can_access_project(project)     workspace_of_project(project)

-- test plan governance
can_edit_test_plan(plan)        can_delete_test_plan(plan)
can_execute_test_plan(plan)     can_signoff_plan(plan)
can_manage_plan_assignees(plan)

-- entitlements (no gateway; reads plans/plan_entitlements/subscriptions)
can_use_feature(org,feature)    within_quota(org,kind,additional)
org_entitlements(org)           org_usage_this_period(org,kind)

-- jobs & runners
claim_jobs(worker,limit,visibility_sec)   claim_runner_jobs(...)
move_to_dlq(job,reason)

-- lifecycle automation
handle_new_user()               accept_pending_invitations()
add_org_owner_as_member()       add_workspace_owner_as_member()
add_project_creator_as_lead()   recount_workspace_counters()
gen_test_plan_uid()             snapshot_test_plan_document()
rollup_suite_run_counters()     enqueue_cycle_run_evaluations()
sync_cycle_run_from_runner_job()  sync_spec_run_from_runner_job()
resolve_share_link(token)       log_audit(...)
enqueue_email(...)  read_email_batch(...)  delete_email(...)
```

### 3.3 Request pipeline (mandatory)

```text
verify JWT → load claims → BEGIN
  SET LOCAL app.user_id = '<uuid>'
  SET LOCAL app.claims  = '<jsonb>'
  run queries as a NON-superuser role (RLS applies)
COMMIT
```
`auth.uid()` becomes `current_setting('app.user_id', true)::uuid`.
Service-role/admin connections are used **only** by workers, webhooks and
system endpoints — never on a user-facing route.

### 3.4 Row-level security pattern

Every table gets four policies (`select`, `insert`, `update`, `delete`) built
from the helpers, e.g.:

```sql
create policy tc_select on public.test_cases for select to authenticated
  using (can_access_project(project_id));
create policy tc_write on public.test_cases for update to authenticated
  using (created_by = current_user_id() or is_qa_manager());
```
UI gating mirrors RLS; it never replaces it.

---

## 4. Auth service

| Purpose | Endpoint |
|---|---|
| Email+password sign-up (confirmation required) | `POST /auth/v1/signup` |
| Sign in | `POST /auth/v1/token?grant_type=password` |
| Refresh (rotating) | `POST /auth/v1/token?grant_type=refresh_token` |
| Sign out / revoke session | `POST /auth/v1/logout` |
| Password reset request / update | `POST /auth/v1/recover`, `PUT /auth/v1/user` |
| List & revoke sessions | `GET/DELETE /auth/v1/sessions` |
| Google OAuth | `GET /auth/v1/authorize?provider=google` + callback |
| Org SAML/OIDC SSO | resolved via `sso_connections` + email domain, JIT provisioning |
| TOTP MFA | enroll → challenge → verify, with `mfa_recovery_codes` |
| OAuth 2.1 AS (for MCP agents) | `/authorize`, `/token`, dynamic client registration, consent page |

- Tokens: RS256 JWT, 1 h access / 30 d rotating refresh; claims `sub`, `email`,
  `role`, `aud=authenticated`, `exp`, plus `client_id` for agent tokens.
- Passwords: argon2id. Lockout after 10 failures / 15 min.
- **On first sign-up run `handle_new_user()`**: create `profiles`, create a
  default organization + workspace, add owner memberships, accept any pending
  `workspace_invitations` matching the email.
- No anonymous sign-ups; no auto-confirm of emails.

---

## 5. HTTP API surface

### 5.1 Data API (resource layer)

The SPA speaks a PostgREST-style protocol:
`GET /rest/v1/<table>?select=…&<col>=eq.<val>&order=…&limit=…`.
Cheapest path is to run PostgREST in front of your Postgres. If you write it
yourself, support: `select` with embedded relations (`project:projects(name)`),
filters `eq/neq/gt/gte/lt/lte/in/is/like/ilike/cs/ov`, `order`, `limit`,
`range` headers, `Prefer: return=representation`, upsert on conflict, and
`count=exact`.

### 5.2 Service endpoints (RPC)

Keep the paths `POST /fn/<name>` so the client needs no change.

**Ingestion & documents**
`process-document`, `ingest-github`, `ingest-zip`, `repo-reader`,
`extract-from-generated-docs`, `generate-prd`, `tp-rr-download`.

**Test-plan & case generation**
`tp-generate-docs`, `tp-sqa-check`, `tp-forge-generate`, `tp-forge-check`,
`tp-forge-cancel`, `tp-generate-cases`, `tp-generate-cases-and-code`,
`generate-test-plan`, `generate-test-plan-from-docs`, `cancel-test-plan-job`,
`suite-grouping`.

**Automation & execution**
`tp-forge-codegen`, `tp-forge-codegen-check`, `tp-forge-run-start`,
`tp-forge-run-check`, `tp-forge-run-cancel`, `tp-generate-code`,
`tp-locator-analyze`, `tp-locator-apply`, `tp-run-analyze`,
`execute-api-test`, `create-cycle-from-suite`, `spec-run-dispatch`,
`runner-dispatch`, `runner-callback`, `runner-heartbeat`.

**Integrations**
`oauth-start`, `oauth-github-callback`, `oauth-jira-callback`,
`integrations-callback-info`, `integrations-disconnect`, `github-sync`,
`jira-sync`, `ci-webhook`, `dispatch-webhooks`.

**Org & comms**
`redeem-invitation`, `send-invitation-email`, `dispatch-notification`,
`process-email-queue`, `auth-email-hook`, `export-org-data`, `delete-account`,
`delete-org`, `sso-jit-provision`.

**Machine surfaces**
`api-v1` (API-key REST), `mcp` (agent tools), `job-worker`.

Auth policy: user JWT by default. **No JWT** (authenticate by HMAC signature,
shared secret or API key) for: `ci-webhook`, `runner-heartbeat`,
`runner-callback`, `oauth-*-callback`, `auth-email-hook`, `api-v1`, `mcp`,
`job-worker`.

### 5.3 Public REST API (`api-v1`)

`Authorization: Bearer qxa_<random>`; store only `sha256(key)` in
`api_keys.key_hash` with `key_prefix`, `scopes[]`, `org_id`, `workspace_id`,
`created_by`, `last_used_at`, `revoked_at`. Scope match supports `*`, `ns:*`,
exact.

```text
GET  /v1/me                        key metadata + scopes
GET  /v1/projects                  projects:read
GET  /v1/test-plans?project_id=    testplans:read
GET  /v1/test-cases?project_id=    testcases:read
GET  /v1/defects?project_id=       defects:read
POST /v1/defects                   defects:write
```
Update `last_used_at` per call; rate-limit ~600 req/min/key; 401 on revoked.

### 5.4 MCP server

Streamable-HTTP MCP endpoint with OAuth 2.1 bearer verification
(issuer = your auth service, audience `authenticated`), exposing
`list_projects`, `list_test_plans`, `list_test_cases`, `list_defects`,
`create_defect`. Every tool must execute **as the calling user** so RLS
applies — never with an admin key.

---

## 6. Durable job system

Long AI/execution work must survive navigation, deploys and 25–60 minute
runtimes.

`jobs`: `kind`, `payload jsonb`, `status job_status`, `priority`,
`attempt_count`, `max_attempts`, `run_after`, `locked_at`, `locked_by`,
`progress int`, `progress_message`, `checkpoint jsonb`, `result jsonb`,
`error jsonb`, `org_id/workspace_id/project_id`, timestamps.
`job_attempts` records each try (started/finished/error); `job_artifacts`
stores outputs (S3 keys, sizes, content types).

Worker loop:

1. `claim_jobs(worker_id, limit := 5, visibility := 60)` —
   `... where status in ('queued','retrying') and run_after <= now()
   order by priority, created_at for update skip locked` → set
   `status='running', locked_by, locked_at`.
2. Execute the handler for `kind`; write `progress`/`progress_message` and
   `checkpoint` at every sub-step (the UI renders these live).
3. Heartbeat `locked_at` every 30 s; a job whose lock is stale > `visibility`
   is re-claimable.
4. On error: `attempt_count++`, exponential backoff
   (`run_after = now() + 2^attempt * 30 s`), `status='retrying'`; after
   `max_attempts` → `move_to_dlq()` (`status='dead_letter'`).
5. On success: `status='completed'`, `result`, `finished_at`.
6. Cancellation: set `status='cancelled'`; the handler checks the flag between
   sub-steps and calls the upstream cancel endpoint.

Job kinds in use: `document.process`, `repo.ingest`, `docs.generate`,
`plan.sqa`, `cases.generate`, `code.generate`, `run.execute`, `suite.group`,
`gate.evaluate`, `release.judge`, `webhook.dispatch`, `email.send`,
`integration.sync`, `usage.rollup`.

A scheduler (pg_cron or a ticker) enqueues: stale-job reaper (5 min), quota
rollups (hourly), SLA breach checks (15 min), email queue drain (1 min),
runner-offline sweep (1 min).

---

## 7. External service contracts

### 7.1 Repo Reader (`REPO_READER_BASE_URL_V1`, bearer `REPO_READER_API_KEY_V1`)

All calls are asynchronous: submit → receive `job_id` → poll.

| Step | Call |
|---|---|
| Ingest git repo | `POST /v1/jobs` `{ repo_url, branch, … }` |
| Ingest zip / BRD | `POST /v1/jobs` multipart upload |
| Poll job | `GET /v1/jobs/{id}` → `{ status, progress, message, documents[] }` |
| Generated docs | `GET /v1/jobs/{id}/documents`, `GET /v1/jobs/{id}/download.zip` |
| SQA testing plan | `POST /v1/jobs/{source_job_id}/sqa-plan` |
| Test cases | `POST /v1/jobs/{source_job_id}/test-cases` |
| Playwright codegen | `POST /v1/jobs/{source_job_id}/playwright-code` (suite-scoped: `POST /v1/test-suites/playwright-code`) |
| Start execution | `POST /v1/jobs/{codegen_job_id}/playwright-execution` |
| Execution status | `GET /v1/jobs/{id}/execution` → `{ status, live_view_url, totals, per-test progress }` |
| Execution logs | `GET /v1/jobs/{id}/execution/logs?tail=N` |
| Artifacts | `GET /v1/jobs/{id}/download.zip` |
| Cancel | `POST /v1/jobs/{id}/cancel`, `POST /v1/jobs/terminate` |

Rules your backend must keep:
- Persist the upstream job id on the owning row (`projects.repo_job_id`,
  `test_plans.docs_job_ref`, `forge_job_id`, `codegen_job_id`, `forge_run_id`).
- Require `PLAYWRIGHT_BASE_URL`, `API_BASE_URL`, `E2E_AUTH_TOKEN` before codegen
  or execution; reject with 400 otherwise.
- Never re-upload files that the ingestion job already holds; chain by job id.
- Map upstream 4xx to actionable messages, 5xx to 503 with retry.
- Insert test cases in **atomic batches** (≤500 rows) to avoid worker timeouts.

### 7.2 LLM gateway

OpenAI-compatible `POST /chat/completions`. Used for PRD generation, failure
root-cause analysis, suite grouping, locator intelligence, release judge.
Record every call in `ai_jobs` (`kind`, `model`, `tokens_in/out`, `cost_usd`,
`status`) and its output in `ai_outputs`; append `ai_audit_events`.
Error handling: 400 terminal, 401 config error, 429/5xx bounded backoff with
`Retry-After`, and a circuit breaker that pauses background AI batches.

### 7.3 Runners (self-hosted execution agents)

- Registration: org-scoped token → row in `runners` (`name`, `labels[]`,
  `status`, `last_heartbeat_at`, `version`).
- `POST /fn/runner-heartbeat` every 15 s; missing 3 beats ⇒ `offline`.
- Dispatch: `claim_runner_jobs()` hands `runner_jobs` rows to a matching runner
  by labels; runner posts progress/logs/artifacts to `runner-callback`
  (HMAC-signed), which syncs `cycle_runs` / `spec_runs`.

### 7.4 Git & issue integrations

OAuth apps for GitHub and Jira; store tokens encrypted in
`integration_connections` (never in the client). `github-sync` pulls branches,
commits and PRs; `jira-sync` mirrors defects both ways using
`jira_project_mappings`. All sync attempts append to `sync_logs`.

### 7.5 CI ingestion

`POST /fn/ci-webhook` authenticated by HMAC-SHA256 over the raw body using
`CI_WEBHOOK_SIGNING_SECRET`. Accepts JUnit XML, TRX, Cucumber JSON and a native
JSON payload; creates/updates `builds`, `ci_runs`, `cycle_run_items` and
attaches artifacts. Must be idempotent per `(integration_id, external_run_id)`.

### 7.6 Outbound webhooks

`webhook_endpoints` (url, secret, event types, active) →
`webhook_events` → `webhook_deliveries`. Sign with
`X-Qualixa-Signature: sha256=<hmac(body)>` and `X-Qualixa-Timestamp`; retry
6 times with exponential backoff; disable an endpoint after 20 consecutive
failures.

---

## 8. Realtime

Publish change events for: `notifications`, `defects`, `defect_comments`,
`jobs`, `ingest_jobs`, `plan_test_runs`, `spec_runs`, `cycle_run_items`,
`test_plans` (progress fields), `runners`.

Implementation: Postgres logical replication or per-table
`AFTER INSERT/UPDATE` triggers calling `pg_notify('changes', json)`; a WS
gateway fans out to subscribers **after re-checking authorization** for the
target row (never trust the client's channel name).

Channel naming used by the client: `<table>:<scope_id>`, e.g.
`plan_test_runs:project:<uuid>`.

---

## 9. Notifications & email

- `notifications` rows are produced by DB triggers: defect created/assigned/
  status change, comment @mentions, test plan created/assignee added, document
  ready, execution completed, gate blocked, release verdict, build status,
  runner job status, workspace/project created, member added.
- `notification_preferences` per user × channel (in-app, email, Slack) × event.
- Email is queued (`enqueue_email` → queue table/Redis) and drained by
  `process-email-queue` in batches (`read_email_batch`, `delete_email`), with
  `email_send_log`, `email_send_state`, `suppressed_emails` and
  `email_unsubscribe_tokens` for compliance.
- Templates: signup confirm, magic link, recovery, email change,
  reauthentication, workspace invitation.
- Slack delivery via org-configured incoming webhook.

---

## 10. Storage

Buckets: `documents` (uploads), `generated-docs`, `evidence`
(screenshots/video/logs), `artifacts` (run zips, traces), `avatars` (public).

Rules: private by default; access only through signed URLs (≤15 min) issued
after an authorization check; key layout
`<bucket>/<org_id>/<project_id>/<entity_id>/<filename>`; enforce per-workspace
`storage_quota`; virus-scan or type-allowlist uploads; log artifact reads to
`audit_logs` (the app already does artifact access auditing).

---

## 11. Entitlements & quotas (no payment gateway)

`plans` (code, name, price fields unused), `plan_entitlements`
(seats, projects, AI jobs/month, runner minutes, feature flags),
`subscriptions` (org → plan, `status subscription_status`, period bounds).
Provision subscriptions administratively (seed a plan per org, or an internal
admin endpoint) — no checkout flow.

Metering: every AI job and runner minute writes a `usage_events` row
(`org_id`, `kind`, `quantity`, `occurred_at`, `meta`).
Enforcement happens server-side before starting work:
`within_quota(org, 'ai_jobs', 1)` and `can_use_feature(org, 'sso')`; return
`402/403`-style structured errors the UI turns into contextual upgrade prompts,
and warn at 80 % / 100 % of a quota.

---

## 12. Security requirements

- RLS on 100 % of public tables + explicit grants; deny by default.
- Roles never stored on `profiles` alone for privilege checks — membership
  tables plus `SECURITY DEFINER` helpers are authoritative.
- Secrets only server-side; rotate integration tokens; encrypt at rest.
- `audit_logs`: actor, action, subject type/id, before/after JSON, IP, UA.
  Triggers already audit invitations, org/workspace/project members, plan
  assignees, project visibility changes.
- Share links: random 32-byte token, optional password + expiry, view counting
  (`share_link_views`), resolved server-side via `resolve_share_link()`.
- GDPR: `export-org-data` (full JSON/ZIP export) and `delete-account` /
  `delete-org` with a `deletion_requests` grace period.
- Rate limits: auth 10/min/IP, API keys 600/min, generation endpoints 5/min/user.
- MFA (TOTP) with recovery codes; org-level enforcement flag.

---

## 13. Observability

Structured JSON logs with `request_id`, `user_id`, `org_id`, `job_id`.
Metrics: job queue depth/latency per kind, upstream Repo Reader latency and
error rate, LLM tokens and failures, WS connections, RLS denials, HTTP 4xx/5xx.
Traces across API → worker → external service. Alerts: dead-letter jobs > 0,
queue latency > 5 min, runner fleet offline, webhook endpoint auto-disabled.

---

## 14. Environment variables

```text
DATABASE_URL, DATABASE_REPLICA_URL
REDIS_URL
JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, JWT_ISSUER, JWT_AUDIENCE
APP_BASE_URL, API_BASE_URL, CORS_ORIGINS
S3_ENDPOINT, S3_REGION, S3_BUCKET_*, S3_ACCESS_KEY, S3_SECRET_KEY
REPO_READER_BASE_URL_V1, REPO_READER_API_KEY_V1
LLM_BASE_URL, LLM_API_KEY, LLM_DEFAULT_MODEL
SMTP_URL or RESEND_API_KEY, MAIL_FROM
GITHUB_OAUTH_CLIENT_ID/SECRET, JIRA_OAUTH_CLIENT_ID/SECRET
CI_WEBHOOK_SIGNING_SECRET, JOB_WORKER_SECRET, RUNNER_SHARED_SECRET
PLAYWRIGHT_BASE_URL, E2E_AUTH_TOKEN
```

---

## 15. Build order

1. Postgres + migrations (`supabase/migrations/*.sql`, filename order), swapping
   the Supabase constructs listed in §3.3.
2. Auth service (password + Google) and the RLS request pipeline.
3. Data API (PostgREST or equivalent) — the SPA becomes usable read/write.
4. Storage service + signed URLs.
5. Job system + worker, then ingestion (`process-document`, `ingest-*`,
   `repo-reader`).
6. Generation chain (docs → SQA plan → cases → suites → codegen).
7. Execution: forge runs, manual sessions, locator intelligence, runners.
8. Defects, quality gates, release judge, reporting aggregates.
9. Realtime + notifications + email.
10. Enterprise: MFA, SSO, audit log, export/delete, API keys, MCP, webhooks.

Cut-over: point `VITE_SUPABASE_URL`/key at your gateway, or replace
`src/integrations/supabase/client.ts` with a thin adapter exposing
`from()`, `rpc()`, `functions.invoke()`, `auth`, `storage`, `channel()`.

---

## Appendix A — Data dictionary

Generated from the applied migrations: every table with its column definitions
(type, nullability, default, foreign keys).


### `teams`

```sql
-- columns
id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
name VARCHAR(100) NOT NULL
description TEXT
manager_id UUID
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

### `profiles`

```
```sql
-- columns
id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY
email TEXT NOT NULL
name TEXT NOT NULL
role public.user_role NOT NULL DEFAULT 'viewer'
team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL
status public.user_status NOT NULL DEFAULT 'pending'
avatar TEXT
last_login TIMESTAMP WITH TIME ZONE
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

### `test_cases`

```
```sql
-- columns
id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
title TEXT NOT NULL
description TEXT
preconditions TEXT
expected_result TEXT
status public.test_case_status NOT NULL DEFAULT 'draft'
priority INTEGER NOT NULL DEFAULT 3
ai_generated BOOLEAN NOT NULL DEFAULT false
ai_confidence DECIMAL(3,2)
coverage_tags TEXT[]
requirement_ids UUID[]
created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
workspace_id UUID
version INTEGER NOT NULL DEFAULT 1
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

### `test_case_steps`

```
```sql
-- columns
id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
test_case_id UUID NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE
step_number INTEGER NOT NULL
action TEXT NOT NULL
expected_result TEXT
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

### `test_case_versions`

```
```sql
-- columns
id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
test_case_id UUID NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE
version INTEGER NOT NULL
title TEXT NOT NULL
description TEXT
changes_summary TEXT
modified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

### `test_executions`

```
```sql
-- columns
id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
test_case_id UUID NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE
test_run_id UUID
executor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL
status public.execution_status NOT NULL DEFAULT 'pending'
started_at TIMESTAMP WITH TIME ZONE
completed_at TIMESTAMP WITH TIME ZONE
notes TEXT
environment TEXT
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

### `execution_step_results`

```
```sql
-- columns
id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
execution_id UUID NOT NULL REFERENCES public.test_executions(id) ON DELETE CASCADE
step_id UUID NOT NULL REFERENCES public.test_case_steps(id) ON DELETE CASCADE
status public.execution_status NOT NULL DEFAULT 'pending'
actual_result TEXT
notes TEXT
executed_at TIMESTAMP WITH TIME ZONE

### `defects`

```
```sql
-- columns
id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
title TEXT NOT NULL
description TEXT
execution_id UUID REFERENCES public.test_executions(id) ON DELETE SET NULL
step_result_id UUID REFERENCES public.execution_step_results(id) ON DELETE SET NULL
severity public.defect_severity NOT NULL DEFAULT 'minor'
priority public.defect_priority NOT NULL DEFAULT 'medium'
status TEXT NOT NULL DEFAULT 'open'
reported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

### `evidence`

```
```sql
-- columns
id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
execution_id UUID REFERENCES public.test_executions(id) ON DELETE CASCADE
defect_id UUID REFERENCES public.defects(id) ON DELETE CASCADE
step_result_id UUID REFERENCES public.execution_step_results(id) ON DELETE CASCADE
file_name TEXT NOT NULL
file_url TEXT NOT NULL
file_type TEXT NOT NULL
description TEXT
captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

### `ai_agents`

```
```sql
-- columns
id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
name TEXT NOT NULL
description TEXT
agent_type TEXT NOT NULL DEFAULT 'test_execution'
status public.agent_status NOT NULL DEFAULT 'idle'
learning_progress INTEGER NOT NULL DEFAULT 0
total_executions INTEGER NOT NULL DEFAULT 0
success_rate DECIMAL(5,2)
last_execution_at TIMESTAMP WITH TIME ZONE
configuration JSONB NOT NULL DEFAULT '{}'
created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

### `agent_learning_sessions`

```
```sql
-- columns
id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE
session_type TEXT NOT NULL
progress INTEGER NOT NULL DEFAULT 0
status TEXT NOT NULL DEFAULT 'in_progress'
patterns_learned INTEGER NOT NULL DEFAULT 0
started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
completed_at TIMESTAMP WITH TIME ZONE

### `agent_execution_logs`

```
```sql
-- columns
id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE
execution_id UUID REFERENCES public.test_executions(id) ON DELETE SET NULL
action TEXT NOT NULL
result TEXT
confidence DECIMAL(3,2)
duration_ms INTEGER
executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

### `workspaces`

```
```sql
-- columns
id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
name TEXT NOT NULL
description TEXT
owner_id UUID REFERENCES public.profiles(id)
status TEXT NOT NULL DEFAULT 'active'
storage_quota INTEGER DEFAULT 5000
storage_used INTEGER DEFAULT 0
projects_count INTEGER DEFAULT 0
members_count INTEGER DEFAULT 1
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

### `documents`

```
```sql
-- columns
id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
filename TEXT NOT NULL
file_size INTEGER NOT NULL DEFAULT 0
mime_type TEXT NOT NULL
status TEXT NOT NULL DEFAULT 'uploaded'
uploader_id UUID REFERENCES public.profiles(id)
workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE
requirements_count INTEGER DEFAULT 0
processed_at TIMESTAMP WITH TIME ZONE
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

### `test_plans`

```
```sql
-- columns
id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
name TEXT NOT NULL
description TEXT
status TEXT NOT NULL DEFAULT 'draft'
workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE
created_by UUID REFERENCES public.profiles(id)
ai_suggested BOOLEAN DEFAULT false
runs_count INTEGER DEFAULT 0
progress INTEGER DEFAULT 0
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

### `notifications`

```
```sql
-- columns
id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE
type TEXT NOT NULL
title TEXT NOT NULL
message TEXT NOT NULL
data JSONB DEFAULT '{}'
read BOOLEAN DEFAULT FALSE
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

### `api_endpoints`

```
```sql
-- columns
id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE
method TEXT NOT NULL
path TEXT NOT NULL
summary TEXT
description TEXT
parameters JSONB DEFAULT '[]'::jsonb
request_body JSONB
response_schema JSONB
headers JSONB DEFAULT '[]'::jsonb
authentication TEXT
tags TEXT[]
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

### `endpoint_prds`

```
```sql
-- columns
id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
endpoint_id UUID NOT NULL REFERENCES public.api_endpoints(id) ON DELETE CASCADE
title TEXT NOT NULL
overview TEXT
objectives JSONB DEFAULT '[]'::jsonb
functional_requirements JSONB DEFAULT '[]'::jsonb
non_functional_requirements JSONB DEFAULT '[]'::jsonb
acceptance_criteria JSONB DEFAULT '[]'::jsonb
dependencies JSONB DEFAULT '[]'::jsonb
risks JSONB DEFAULT '[]'::jsonb
full_content TEXT
generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

### `endpoint_test_plans`

```
```sql
-- columns
id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
endpoint_id UUID NOT NULL REFERENCES public.api_endpoints(id) ON DELETE CASCADE
name TEXT NOT NULL
description TEXT
test_cases JSONB DEFAULT '[]'::jsonb
coverage_areas JSONB DEFAULT '[]'::jsonb
test_data JSONB DEFAULT '[]'::jsonb
preconditions TEXT
status TEXT NOT NULL DEFAULT 'draft'
generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

### `api_test_executions`

```
```sql
-- columns
id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
endpoint_id UUID NOT NULL REFERENCES public.api_endpoints(id) ON DELETE CASCADE
test_plan_id UUID REFERENCES public.endpoint_test_plans(id) ON DELETE SET NULL
executor_id UUID REFERENCES public.profiles(id)
method TEXT NOT NULL
url TEXT NOT NULL
request_headers JSONB
request_body TEXT
response_status INTEGER
response_headers JSONB
response_body TEXT
response_time_ms INTEGER
status TEXT NOT NULL DEFAULT 'pending'
assertions JSONB DEFAULT '[]'::jsonb
assertion_results JSONB DEFAULT '[]'::jsonb
notes TEXT
executed_at TIMESTAMP WITH TIME ZONE
created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()

### `workspace_members`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE
user_id uuid NOT NULL
role public.workspace_role NOT NULL DEFAULT 'editor'
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
UNIQUE (workspace_id, user_id)

### `workspace_invitations`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE
email text NOT NULL
role public.workspace_role NOT NULL DEFAULT 'editor'
token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex')
status public.invitation_status NOT NULL DEFAULT 'pending'
invited_by uuid
expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days')
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
UNIQUE (workspace_id, email)

### `projects`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE
name text NOT NULL
description text
source_type public.project_source NOT NULL DEFAULT 'documentation'
status public.project_status NOT NULL DEFAULT 'pending'
-- GitHub-specific
github_url text
github_branch text DEFAULT 'main'
github_is_private boolean DEFAULT false
github_token_secret_name text, -- name of secret in Edge Function env
-- Zip-specific
zip_storage_path text
-- stats
files_count integer DEFAULT 0
endpoints_count integer DEFAULT 0
test_cases_count integer DEFAULT 0
last_processed_at timestamptz
process_error text
created_by uuid
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `test_plan_assignees`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE
user_id uuid NOT NULL
role text NOT NULL DEFAULT 'tester'
assigned_by uuid
created_at timestamptz NOT NULL DEFAULT now()
UNIQUE(test_plan_id, user_id)

### `test_plan_documents`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE
document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE
created_at timestamptz NOT NULL DEFAULT now()
UNIQUE(test_plan_id, document_id)

### `test_plan_test_cases`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE
test_case_id uuid NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE
added_by uuid
created_at timestamptz NOT NULL DEFAULT now()
UNIQUE(test_plan_id, test_case_id)

### `test_plan_versions`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE
version int NOT NULL
snapshot jsonb NOT NULL DEFAULT '{}'::jsonb
change_summary text
created_by uuid
created_at timestamptz NOT NULL DEFAULT now()
UNIQUE(test_plan_id, version)

### `releases`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
name text NOT NULL
version text
description text
status public.release_status NOT NULL DEFAULT 'planned'
target_date date
released_at timestamptz
owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
metadata jsonb NOT NULL DEFAULT '{}'::jsonb
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `environments`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
name text NOT NULL
type public.environment_type NOT NULL DEFAULT 'qa'
base_url text
description text
config jsonb NOT NULL DEFAULT '{}'::jsonb
is_active boolean NOT NULL DEFAULT true
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
UNIQUE (project_id, name)

### `builds`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
release_id uuid REFERENCES public.releases(id) ON DELETE SET NULL
name text
branch text
commit_sha text
commit_message text
artifact_url text
ci_run_url text
ci_provider text
status public.build_status NOT NULL DEFAULT 'pending'
built_at timestamptz
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
metadata jsonb NOT NULL DEFAULT '{}'::jsonb
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `deployments`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
build_id uuid NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE
environment_id uuid NOT NULL REFERENCES public.environments(id) ON DELETE CASCADE
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
status public.deployment_status NOT NULL DEFAULT 'pending'
deployed_at timestamptz
deployed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
url text
notes text
metadata jsonb NOT NULL DEFAULT '{}'::jsonb
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `test_suites`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
parent_id uuid REFERENCES public.test_suites(id) ON DELETE CASCADE
name text NOT NULL
description text
tags text[] NOT NULL DEFAULT '{}'
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `suite_test_cases`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
suite_id uuid NOT NULL REFERENCES public.test_suites(id) ON DELETE CASCADE
test_case_id uuid NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE
added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
position integer
created_at timestamptz NOT NULL DEFAULT now()
UNIQUE (suite_id, test_case_id)

### `test_cycles`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
release_id uuid REFERENCES public.releases(id) ON DELETE SET NULL
environment_id uuid REFERENCES public.environments(id) ON DELETE SET NULL
build_id uuid REFERENCES public.builds(id) ON DELETE SET NULL
suite_id uuid REFERENCES public.test_suites(id) ON DELETE SET NULL
test_plan_id uuid REFERENCES public.test_plans(id) ON DELETE SET NULL
name text NOT NULL
description text
status public.cycle_status NOT NULL DEFAULT 'planned'
start_at timestamptz
end_at timestamptz
owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
metadata jsonb NOT NULL DEFAULT '{}'::jsonb
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `cycle_runs`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
cycle_id uuid NOT NULL REFERENCES public.test_cycles(id) ON DELETE CASCADE
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
name text
executor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
status public.run_status NOT NULL DEFAULT 'planned'
started_at timestamptz
finished_at timestamptz
notes text
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `cycle_run_items`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
run_id uuid NOT NULL REFERENCES public.cycle_runs(id) ON DELETE CASCADE
cycle_id uuid NOT NULL REFERENCES public.test_cycles(id) ON DELETE CASCADE
test_case_id uuid NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE
test_case_version integer
assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
status public.run_item_status NOT NULL DEFAULT 'not_run'
attempt_count integer NOT NULL DEFAULT 0
duration_ms integer
last_executed_at timestamptz
evidence jsonb NOT NULL DEFAULT '[]'::jsonb
notes text
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
UNIQUE (run_id, test_case_id)

### `cycle_attempts`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
run_item_id uuid NOT NULL REFERENCES public.cycle_run_items(id) ON DELETE CASCADE
attempt_no integer NOT NULL
status public.run_item_status NOT NULL DEFAULT 'not_run'
started_at timestamptz
finished_at timestamptz
duration_ms integer
executor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
logs_ref text
error_signature text
evidence jsonb NOT NULL DEFAULT '[]'::jsonb
notes text
created_at timestamptz NOT NULL DEFAULT now()
UNIQUE (run_item_id, attempt_no)

### `jobs`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id uuid
project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE
kind text NOT NULL
status public.job_status NOT NULL DEFAULT 'queued'
priority int NOT NULL DEFAULT 100
payload jsonb NOT NULL DEFAULT '{}'::jsonb
result jsonb
error jsonb
attempt_count int NOT NULL DEFAULT 0
max_attempts int NOT NULL DEFAULT 3
run_after timestamptz NOT NULL DEFAULT now()
locked_at timestamptz
locked_by text
idempotency_key text UNIQUE
progress int NOT NULL DEFAULT 0
progress_message text
checkpoint jsonb
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `job_attempts`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE
attempt_no int NOT NULL
started_at timestamptz NOT NULL DEFAULT now()
finished_at timestamptz
status public.job_status NOT NULL DEFAULT 'running'
error jsonb
logs text

### `job_artifacts`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE
kind text NOT NULL
ref text NOT NULL
meta jsonb NOT NULL DEFAULT '{}'::jsonb
created_at timestamptz NOT NULL DEFAULT now()

### `ci_integrations`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
provider text NOT NULL
name text NOT NULL
secret_hash text NOT NULL
default_environment_id uuid REFERENCES public.environments(id) ON DELETE SET NULL
default_release_id uuid REFERENCES public.releases(id) ON DELETE SET NULL
branch_release_map jsonb NOT NULL DEFAULT '{}'::jsonb
is_active boolean NOT NULL DEFAULT true
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `ci_runs`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
integration_id uuid REFERENCES public.ci_integrations(id) ON DELETE SET NULL
build_id uuid REFERENCES public.builds(id) ON DELETE SET NULL
provider text NOT NULL
provider_run_id text
branch text
commit_sha text
status text NOT NULL DEFAULT 'received'
url text
started_at timestamptz
finished_at timestamptz
raw jsonb NOT NULL DEFAULT '{}'::jsonb
created_at timestamptz NOT NULL DEFAULT now()

### `automation_mappings`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
test_case_id uuid REFERENCES public.test_cases(id) ON DELETE CASCADE
framework text NOT NULL
test_id_pattern text NOT NULL
created_at timestamptz NOT NULL DEFAULT now()

### `requirements`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
key text
title text NOT NULL
description text
source_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL
status public.requirement_status NOT NULL DEFAULT 'proposed'
priority int NOT NULL DEFAULT 2
tags text[]
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `acceptance_criteria`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
requirement_id uuid NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE
text text NOT NULL
order_index int NOT NULL DEFAULT 0
created_at timestamptz NOT NULL DEFAULT now()

### `requirement_links`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
requirement_id uuid NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE
linked_type text NOT NULL
linked_id uuid NOT NULL
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()
UNIQUE(requirement_id, linked_type, linked_id)

### `quality_gates`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE
name text NOT NULL
description text
scope text NOT NULL DEFAULT 'cycle_run'
enabled boolean NOT NULL DEFAULT true
blocks_release boolean NOT NULL DEFAULT true
rules jsonb NOT NULL DEFAULT '{}'::jsonb
environment_id uuid REFERENCES public.environments(id) ON DELETE SET NULL
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `gate_evaluations`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
gate_id uuid NOT NULL REFERENCES public.quality_gates(id) ON DELETE CASCADE
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE
release_id uuid REFERENCES public.releases(id) ON DELETE CASCADE
cycle_run_id uuid REFERENCES public.cycle_runs(id) ON DELETE CASCADE
build_id uuid REFERENCES public.builds(id) ON DELETE CASCADE
status text NOT NULL
blocks_release boolean NOT NULL DEFAULT false
metrics jsonb NOT NULL DEFAULT '{}'::jsonb
rule_results jsonb NOT NULL DEFAULT '[]'::jsonb
evaluated_at timestamptz NOT NULL DEFAULT now()
created_at timestamptz NOT NULL DEFAULT now()

### `release_evaluations`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE
release_id uuid REFERENCES public.releases(id) ON DELETE CASCADE
cycle_run_id uuid REFERENCES public.cycle_runs(id) ON DELETE CASCADE
deployment_id uuid REFERENCES public.deployments(id) ON DELETE CASCADE
verdict text NOT NULL DEFAULT 'pending'
score numeric(5,2)
summary text
failure_themes jsonb DEFAULT '[]'::jsonb
next_actions jsonb DEFAULT '[]'::jsonb
metrics jsonb DEFAULT '{}'::jsonb
model text
feedback_score smallint
feedback_note text
feedback_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `runners`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id uuid NOT NULL
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
environment_id uuid REFERENCES public.environments(id) ON DELETE SET NULL
name text NOT NULL
kind text NOT NULL DEFAULT 'webhook',           -- webhook | github_actions | gitlab_ci | docker | local
status text NOT NULL DEFAULT 'idle',            -- idle | busy | offline | disabled
capabilities jsonb NOT NULL DEFAULT '{}'::jsonb, -- {browsers:[], os:[], tags:[]}
config jsonb NOT NULL DEFAULT '{}'::jsonb,       -- webhook_url, dispatch_ref, etc.
token_hash text,                                 -- sha256 of registration token (for runner -> us calls)
last_seen_at timestamptz
current_job_id uuid
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `runner_jobs`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id uuid NOT NULL
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
runner_id uuid REFERENCES public.runners(id) ON DELETE SET NULL
cycle_run_id uuid REFERENCES public.cycle_runs(id) ON DELETE CASCADE
cycle_id uuid REFERENCES public.test_cycles(id) ON DELETE SET NULL
suite_id uuid REFERENCES public.test_suites(id) ON DELETE SET NULL
environment_id uuid REFERENCES public.environments(id) ON DELETE SET NULL
release_id uuid REFERENCES public.releases(id) ON DELETE SET NULL
status text NOT NULL DEFAULT 'queued',  -- queued | dispatched | running | succeeded | failed | cancelled | timeout
attempt int NOT NULL DEFAULT 1
max_attempts int NOT NULL DEFAULT 1
priority int NOT NULL DEFAULT 100
payload jsonb NOT NULL DEFAULT '{}'::jsonb
result jsonb
error jsonb
logs_url text
progress int NOT NULL DEFAULT 0
queued_at timestamptz NOT NULL DEFAULT now()
dispatched_at timestamptz
started_at timestamptz
finished_at timestamptz
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `test_plan_documents_v2`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
slug text NOT NULL
title text NOT NULL
kind text NOT NULL
content text NOT NULL DEFAULT ''
sort_order int NOT NULL DEFAULT 0
created_by uuid REFERENCES auth.users(id)
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
UNIQUE (test_plan_id, slug)

### `test_plan_specs`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
document_id uuid REFERENCES public.test_plan_documents_v2(id) ON DELETE SET NULL
filename text NOT NULL
content text NOT NULL DEFAULT ''
language text NOT NULL DEFAULT 'typescript'
created_by uuid REFERENCES auth.users(id)
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
UNIQUE (test_plan_id, filename)

### `spec_runs`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
spec_id uuid NOT NULL REFERENCES public.test_plan_specs(id) ON DELETE CASCADE
test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
runner_job_id uuid REFERENCES public.runner_jobs(id) ON DELETE SET NULL
status text NOT NULL DEFAULT 'queued'
stdout text
stderr text
result_json jsonb
started_at timestamptz
finished_at timestamptz
created_by uuid REFERENCES auth.users(id)
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `suite_runs`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
status text NOT NULL DEFAULT 'queued'
browser text NOT NULL DEFAULT 'chromium'
headless boolean NOT NULL DEFAULT true
retries integer NOT NULL DEFAULT 0
total_specs integer NOT NULL DEFAULT 0
completed_specs integer NOT NULL DEFAULT 0
passed_specs integer NOT NULL DEFAULT 0
failed_specs integer NOT NULL DEFAULT 0
config_json jsonb NOT NULL DEFAULT '{}'::jsonb
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
finished_at timestamptz

### `organizations`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
name text NOT NULL
slug text UNIQUE
owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
description text
settings jsonb NOT NULL DEFAULT '{}'::jsonb
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `project_members`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
role text NOT NULL DEFAULT 'member'
created_at timestamptz NOT NULL DEFAULT now()
UNIQUE (project_id, user_id)

### `repositories`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
provider text NOT NULL DEFAULT 'github'
url text NOT NULL
default_branch text DEFAULT 'main'
external_id text
metadata jsonb NOT NULL DEFAULT '{}'::jsonb
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `repository_branches`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
repository_id uuid NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE
name text NOT NULL
head_sha text
is_default boolean NOT NULL DEFAULT false
protected boolean NOT NULL DEFAULT false
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
UNIQUE (repository_id, name)

### `pull_requests`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
repository_id uuid NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE
number integer NOT NULL
title text NOT NULL
body text
state text NOT NULL DEFAULT 'open'
author text
source_branch text
target_branch text
head_sha text
merged_at timestamptz
url text
metadata jsonb NOT NULL DEFAULT '{}'::jsonb
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
UNIQUE (repository_id, number)

### `commits`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
repository_id uuid NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE
sha text NOT NULL
branch text
message text
author_name text
author_email text
committed_at timestamptz
url text
metadata jsonb NOT NULL DEFAULT '{}'::jsonb
created_at timestamptz NOT NULL DEFAULT now()
UNIQUE (repository_id, sha)

### `requirement_versions`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
requirement_id uuid NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE
version integer NOT NULL
snapshot jsonb NOT NULL
change_note text
changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()
UNIQUE (requirement_id, version)

### `test_parameters`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
test_case_id uuid NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE
name text NOT NULL
data_type text NOT NULL DEFAULT 'string'
default_value text
description text
required boolean NOT NULL DEFAULT false
created_at timestamptz NOT NULL DEFAULT now()

### `test_data_sets`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
test_case_id uuid REFERENCES public.test_cases(id) ON DELETE CASCADE
name text NOT NULL
description text
rows jsonb NOT NULL DEFAULT '[]'::jsonb
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `test_case_links`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
test_case_id uuid NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE
link_type text NOT NULL
target_kind text NOT NULL
target_id uuid NOT NULL
metadata jsonb NOT NULL DEFAULT '{}'::jsonb
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()

### `milestones`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
release_id uuid REFERENCES public.releases(id) ON DELETE SET NULL
name text NOT NULL
description text
due_date date
status text NOT NULL DEFAULT 'planned'
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `automation_assets`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
name text NOT NULL
kind text NOT NULL DEFAULT 'spec'
framework text
language text
repository_id uuid REFERENCES public.repositories(id) ON DELETE SET NULL
path text
content text
metadata jsonb NOT NULL DEFAULT '{}'::jsonb
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `runner_groups`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE
name text NOT NULL
description text
labels text[] NOT NULL DEFAULT '{}'
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `schedules`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
name text NOT NULL
cron text NOT NULL
timezone text NOT NULL DEFAULT 'UTC'
target_kind text NOT NULL
target_id uuid
enabled boolean NOT NULL DEFAULT true
last_run_at timestamptz
next_run_at timestamptz
payload jsonb NOT NULL DEFAULT '{}'::jsonb
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `defect_comments`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
defect_id uuid NOT NULL REFERENCES public.defects(id) ON DELETE CASCADE
author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
body text NOT NULL
metadata jsonb NOT NULL DEFAULT '{}'::jsonb
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `defect_links`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
defect_id uuid NOT NULL REFERENCES public.defects(id) ON DELETE CASCADE
link_type text NOT NULL
target_kind text NOT NULL
target_id uuid NOT NULL
metadata jsonb NOT NULL DEFAULT '{}'::jsonb
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()

### `defect_history`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
defect_id uuid NOT NULL REFERENCES public.defects(id) ON DELETE CASCADE
changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
field_name text NOT NULL
old_value jsonb
new_value jsonb
created_at timestamptz NOT NULL DEFAULT now()

### `defect_slas`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
name text NOT NULL
severity text NOT NULL
response_hours integer
resolution_hours integer
enabled boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `root_cause_records`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
defect_id uuid NOT NULL REFERENCES public.defects(id) ON DELETE CASCADE
category text
summary text NOT NULL
details text
preventive_actions text
identified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
identified_at timestamptz NOT NULL DEFAULT now()
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `approvals`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
subject_kind text NOT NULL
subject_id uuid NOT NULL
requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
approver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
status text NOT NULL DEFAULT 'pending'
decision text
decided_at timestamptz
notes text
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `waivers`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
subject_kind text NOT NULL
subject_id uuid NOT NULL
reason text NOT NULL
granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
granted_at timestamptz NOT NULL DEFAULT now()
expires_at timestamptz
revoked_at timestamptz
metadata jsonb NOT NULL DEFAULT '{}'::jsonb
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `integrations`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
slug text UNIQUE NOT NULL
name text NOT NULL
category text NOT NULL
description text
config_schema jsonb NOT NULL DEFAULT '{}'::jsonb
enabled boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `integration_connections`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE
project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE
integration_id uuid REFERENCES public.integrations(id) ON DELETE SET NULL
slug text NOT NULL
name text
config jsonb NOT NULL DEFAULT '{}'::jsonb
status text NOT NULL DEFAULT 'connected'
last_sync_at timestamptz
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `webhook_events`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE
project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE
connection_id uuid REFERENCES public.integration_connections(id) ON DELETE SET NULL
source text NOT NULL
event_type text NOT NULL
payload jsonb NOT NULL DEFAULT '{}'::jsonb
headers jsonb NOT NULL DEFAULT '{}'::jsonb
signature text
processed_at timestamptz
status text NOT NULL DEFAULT 'received'
error text
created_at timestamptz NOT NULL DEFAULT now()

### `sync_logs`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
connection_id uuid REFERENCES public.integration_connections(id) ON DELETE CASCADE
workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE
direction text NOT NULL DEFAULT 'inbound'
status text NOT NULL
started_at timestamptz NOT NULL DEFAULT now()
finished_at timestamptz
records_processed integer NOT NULL DEFAULT 0
details jsonb NOT NULL DEFAULT '{}'::jsonb
error text
created_at timestamptz NOT NULL DEFAULT now()

### `ai_jobs`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE
project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE
kind text NOT NULL
status text NOT NULL DEFAULT 'queued'
model text
prompt jsonb
context jsonb NOT NULL DEFAULT '{}'::jsonb
cost_usd numeric(10,4)
tokens_in integer
tokens_out integer
started_at timestamptz
finished_at timestamptz
error text
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `ai_outputs`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
ai_job_id uuid NOT NULL REFERENCES public.ai_jobs(id) ON DELETE CASCADE
output_kind text NOT NULL
target_kind text
target_id uuid
content jsonb NOT NULL
created_at timestamptz NOT NULL DEFAULT now()

### `ai_evaluations`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
ai_output_id uuid REFERENCES public.ai_outputs(id) ON DELETE CASCADE
evaluator text NOT NULL
score numeric(5,2)
verdict text
metrics jsonb NOT NULL DEFAULT '{}'::jsonb
notes text
created_at timestamptz NOT NULL DEFAULT now()

### `ai_feedback`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
ai_output_id uuid REFERENCES public.ai_outputs(id) ON DELETE CASCADE
user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
rating integer
thumbs text
comment text
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `ai_audit_events`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE
ai_job_id uuid REFERENCES public.ai_jobs(id) ON DELETE SET NULL
actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
action text NOT NULL
details jsonb NOT NULL DEFAULT '{}'::jsonb
created_at timestamptz NOT NULL DEFAULT now()

### `audit_logs`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE
project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE
actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
action text NOT NULL
entity_kind text
entity_id uuid
before_state jsonb
after_state jsonb
ip_address text
user_agent text
created_at timestamptz NOT NULL DEFAULT now()

### `activity_events`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE
project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE
actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
verb text NOT NULL
object_kind text
object_id uuid
summary text
metadata jsonb NOT NULL DEFAULT '{}'::jsonb
created_at timestamptz NOT NULL DEFAULT now()

### `jira_project_mappings`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
jira_cloud_id text NOT NULL
jira_site_url text
jira_project_key text NOT NULL
auto_link_rule jsonb NOT NULL DEFAULT '{"match":"summary","labels":[]}'::jsonb
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
UNIQUE (project_id, jira_project_key)

### `github_repo_mappings`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
owner text NOT NULL
repo text NOT NULL
default_branch text NOT NULL DEFAULT 'main'
test_plan_id uuid REFERENCES public.test_plans(id) ON DELETE SET NULL
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
UNIQUE (project_id, owner, repo)

### `integration_activity_log`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE
provider text NOT NULL
kind text NOT NULL,            -- oauth_connect | oauth_callback | sync | disconnect | reconnect
status text NOT NULL,          -- ok | error
message text
counts jsonb
user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
occurred_at timestamptz NOT NULL DEFAULT now()

### `organization_members`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE
user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
role public.org_role NOT NULL DEFAULT 'member'
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
UNIQUE (org_id, user_id)

### `plans`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
key text UNIQUE NOT NULL
name text NOT NULL
monthly_price_cents integer NOT NULL DEFAULT 0
yearly_price_cents integer NOT NULL DEFAULT 0
entitlements jsonb NOT NULL DEFAULT '{}'::jsonb
is_active boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `subscriptions`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
org_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE
plan_key text NOT NULL REFERENCES public.plans(key)
status public.subscription_status NOT NULL DEFAULT 'active'
current_period_start timestamptz NOT NULL DEFAULT now()
current_period_end timestamptz NOT NULL DEFAULT (now() + interval '30 days')
trial_ends_at timestamptz
cancel_at_period_end boolean NOT NULL DEFAULT false
stripe_customer_id text
stripe_subscription_id text
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `usage_events`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE
kind text NOT NULL
quantity numeric NOT NULL DEFAULT 1
occurred_at timestamptz NOT NULL DEFAULT now()
ref jsonb NOT NULL DEFAULT '{}'::jsonb
created_at timestamptz NOT NULL DEFAULT now()

### `mfa_recovery_codes`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
code_hash text NOT NULL
used_at timestamptz
created_at timestamptz NOT NULL DEFAULT now()

### `sso_connections`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE
provider text NOT NULL CHECK (provider IN ('saml','oidc'))
display_name text
domains text[] NOT NULL DEFAULT '{}'
config jsonb NOT NULL DEFAULT '{}'::jsonb
enabled boolean NOT NULL DEFAULT false
supabase_provider_id text
created_by uuid REFERENCES auth.users(id)
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `deletion_requests`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
kind text NOT NULL CHECK (kind IN ('organization','account'))
org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE
user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
requested_by uuid NOT NULL
status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','completed','cancelled','failed'))
reason text
completed_at timestamptz
created_at timestamptz NOT NULL DEFAULT now()

### `api_keys`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE
workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE
name text NOT NULL
key_prefix text NOT NULL
key_hash text NOT NULL UNIQUE
scopes text[] NOT NULL DEFAULT ARRAY[]::text[]
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
last_used_at timestamptz
revoked_at timestamptz
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `webhook_endpoints`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE
workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE
name text NOT NULL DEFAULT 'Webhook'
url text NOT NULL
secret text NOT NULL
event_types text[] NOT NULL DEFAULT ARRAY[]::text[]
enabled boolean NOT NULL DEFAULT true
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `webhook_deliveries`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
endpoint_id uuid NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE
event_type text NOT NULL
payload jsonb NOT NULL DEFAULT '{}'::jsonb
status text NOT NULL DEFAULT 'pending'
response_code integer
response_body text
attempts integer NOT NULL DEFAULT 0
last_attempt_at timestamptz
next_retry_at timestamptz
created_at timestamptz NOT NULL DEFAULT now()

### `share_links`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
org_id uuid
workspace_id uuid
resource_type text NOT NULL CHECK (resource_type IN ('release','report','dashboard'))
resource_id uuid NOT NULL
token text NOT NULL UNIQUE
watermark_label text
expires_at timestamptz
revoked_at timestamptz
created_by uuid
view_count integer NOT NULL DEFAULT 0
last_viewed_at timestamptz
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `share_link_views`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
share_link_id uuid REFERENCES public.share_links(id) ON DELETE SET NULL
token text NOT NULL
resource_type text
resource_id uuid
granted boolean NOT NULL DEFAULT false
reason text
user_agent text
created_at timestamptz NOT NULL DEFAULT now()

### `email_send_log`

```
```sql
-- columns
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
message_id TEXT
template_name TEXT NOT NULL
recipient_email TEXT NOT NULL
status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq'))
error_message TEXT
metadata JSONB
created_at TIMESTAMPTZ NOT NULL DEFAULT now()

### `email_send_state`

```
```sql
-- columns
id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1)
retry_after_until TIMESTAMPTZ
batch_size INTEGER NOT NULL DEFAULT 10
send_delay_ms INTEGER NOT NULL DEFAULT 200
auth_email_ttl_minutes INTEGER NOT NULL DEFAULT 15
transactional_email_ttl_minutes INTEGER NOT NULL DEFAULT 60
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

### `suppressed_emails`

```
```sql
-- columns
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
email TEXT NOT NULL
reason TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint'))
metadata JSONB
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE(email)

### `email_unsubscribe_tokens`

```
```sql
-- columns
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
token TEXT NOT NULL UNIQUE
email TEXT NOT NULL UNIQUE
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
used_at TIMESTAMPTZ

### `project_generated_docs`

```
```sql
-- columns
id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY
project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
job_id TEXT NOT NULL
slug TEXT NOT NULL
filename TEXT NOT NULL
title TEXT NOT NULL
content TEXT NOT NULL DEFAULT ''
source_bytes INTEGER
source_hash TEXT
edited BOOLEAN NOT NULL DEFAULT false
edited_by UUID REFERENCES auth.users(id)
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
UNIQUE(project_id, slug)

### `plan_test_runs`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE
project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL
workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL
codegen_job_ref text
forge_run_id text
base_url text
status text NOT NULL DEFAULT 'queued'
progress_message text
total_tests integer NOT NULL DEFAULT 0
passed_tests integer NOT NULL DEFAULT 0
failed_tests integer NOT NULL DEFAULT 0
running_tests integer NOT NULL DEFAULT 0
exit_code integer
events jsonb NOT NULL DEFAULT '[]'::jsonb
artifacts jsonb NOT NULL DEFAULT '[]'::jsonb
result jsonb
last_polled_at timestamptz
started_at timestamptz
finished_at timestamptz
created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `test_plan_document_versions`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
document_id uuid NOT NULL REFERENCES public.test_plan_documents_v2(id) ON DELETE CASCADE
test_plan_id uuid NOT NULL
project_id uuid
version integer NOT NULL DEFAULT 1
title text
slug text
kind text
content text
change_note text
created_by uuid
created_at timestamptz NOT NULL DEFAULT now()

### `generation_stage_logs`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE
kind text NOT NULL
stage text NOT NULL
message text NOT NULL
dry_run boolean NOT NULL DEFAULT false
install_skipped boolean NOT NULL DEFAULT false
execution_skipped boolean NOT NULL DEFAULT false
meta jsonb NOT NULL DEFAULT '{}'::jsonb
created_at timestamptz NOT NULL DEFAULT now()

### `suite_grouping_versions`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
workspace_id uuid
version integer NOT NULL DEFAULT 1
rules jsonb NOT NULL DEFAULT '{}'::jsonb
assignments jsonb NOT NULL DEFAULT '[]'::jsonb
note text
is_current boolean NOT NULL DEFAULT false
created_by uuid
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `doc_diff_comments`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
document_id uuid NOT NULL REFERENCES public.test_plan_documents_v2(id) ON DELETE CASCADE
project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE
left_version integer
right_version integer
line_key text NOT NULL
line_text text
body text NOT NULL
decision text NOT NULL DEFAULT 'comment'
parent_id uuid REFERENCES public.doc_diff_comments(id) ON DELETE CASCADE
resolved boolean NOT NULL DEFAULT false
resolved_by uuid
resolved_at timestamptz
author_id uuid NOT NULL DEFAULT auth.uid()
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `ingest_jobs`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
workspace_id uuid
job_ref text
ingest_type text NOT NULL DEFAULT 'repo_clone'
source_name text
status text NOT NULL DEFAULT 'queued'
stage text
progress integer NOT NULL DEFAULT 0
error text
document_errors jsonb NOT NULL DEFAULT '[]'::jsonb
documents jsonb NOT NULL DEFAULT '[]'::jsonb
stages jsonb NOT NULL DEFAULT '[]'::jsonb
payload jsonb NOT NULL DEFAULT '{}'::jsonb
document_id uuid
created_by uuid
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `manual_execution_sessions`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE
project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE
workspace_id uuid
name text NOT NULL
status text NOT NULL DEFAULT 'in_progress'
environment text
base_url text
build_version text
browser text
device text
tags text[] NOT NULL DEFAULT '{}'
scope jsonb NOT NULL DEFAULT '{}'::jsonb
notes text
summary jsonb NOT NULL DEFAULT '{}'::jsonb
tester_id uuid
started_at timestamptz NOT NULL DEFAULT now()
finished_at timestamptz
created_by uuid
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()

### `manual_execution_items`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
session_id uuid NOT NULL REFERENCES public.manual_execution_sessions(id) ON DELETE CASCADE
test_case_id uuid NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE
suite_id uuid
project_id uuid NOT NULL
status public.execution_status NOT NULL DEFAULT 'pending'
sort_order integer NOT NULL DEFAULT 0
actual_result text
notes text
step_results jsonb NOT NULL DEFAULT '[]'::jsonb
defect_id uuid REFERENCES public.defects(id) ON DELETE SET NULL
duration_seconds integer
executed_by uuid
executed_at timestamptz
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
UNIQUE (session_id, test_case_id)

### `locator_analyses`

```
```sql
-- columns
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE
project_id uuid NOT NULL
suite_id uuid
base_url text
status text NOT NULL DEFAULT 'running'
verdict text
health_score integer
totals jsonb NOT NULL DEFAULT '{}'::jsonb
findings jsonb NOT NULL DEFAULT '[]'::jsonb
error text
applied_count integer NOT NULL DEFAULT 0
created_by uuid
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
```
