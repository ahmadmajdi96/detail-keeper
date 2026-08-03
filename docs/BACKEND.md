# Qualixa — Full Backend Specification (self-hosting)

This document describes everything the Qualixa frontend needs from a backend, so
you can rebuild/host it on your own server. It is written against the current
production behaviour of the app (110 tables, 78 migrations, 59 serverless
functions).

---

## 1. Target architecture

```
                     ┌──────────────────────────────┐
  Browser (Vite/React)│  static bundle on Nginx      │
                     └──────────────┬───────────────┘
                                    │ HTTPS (JWT bearer)
        ┌───────────────────────────▼─────────────────────────────┐
        │  API gateway (Nginx / Traefik) — TLS, CORS, rate limit   │
        └───┬─────────────┬──────────────┬───────────────┬────────┘
            │             │              │               │
    ┌───────▼──────┐ ┌────▼──────┐ ┌─────▼──────┐ ┌──────▼───────┐
    │ Core API     │ │ Auth svc  │ │ Realtime   │ │ Job worker(s)│
    │ (REST+RPC)   │ │ (JWT/OIDC)│ │ (WebSocket)│ │ (queue pull) │
    └───────┬──────┘ └────┬──────┘ └─────┬──────┘ └──────┬───────┘
            │             │              │               │
        ┌───▼─────────────▼──────────────▼───────────────▼───┐
        │  PostgreSQL 15+ (RLS, pgcrypto, pg_trgm, uuid-ossp) │
        └───┬──────────────────────────────┬──────────────────┘
            │                              │
    ┌───────▼───────┐              ┌───────▼────────┐
    │ Object storage│              │ Redis (queue,  │
    │ (S3/MinIO)    │              │ cache, pubsub) │
    └───────────────┘              └────────────────┘

  External services called by the backend:
   • Repo Reader     https://reporeader.qualixa.cortanexai.com  (ingestion, SQA plan,
                     test-case generation, Playwright codegen + execution)
   • LLM gateway     (OpenAI-compatible) for PRD/plan/judge generation
   * Resend / SMTP   transactional email
   • Stripe / Paddle billing
   • GitHub / Jira   OAuth integrations
```

**Recommended stack:** Node 20 + NestJS (or Fastify) in TypeScript — the existing
functions are TS/Deno and port with minimal change. Postgres 15, Redis 7,
MinIO (S3 API), BullMQ for the job queue, Socket.IO or `pg_notify`→WS for realtime.

Any equivalent stack works as long as it satisfies the contracts below.

---

## 2. Data model

The complete schema already exists as SQL in `supabase/migrations/*.sql` (78
files, applied in filename order). On a plain Postgres they run almost verbatim;
the only Supabase-specific pieces to replace are:

| Supabase construct | Self-hosted replacement |
|---|---|
| `auth.users` table | your own `public.users` table (id uuid, email citext unique, encrypted_password, email_confirmed_at, mfa fields, created_at) |
| `auth.uid()` | `current_setting('app.user_id', true)::uuid` — set per request/transaction |
| `auth.jwt()` | `current_setting('app.claims', true)::jsonb` |
| `storage.objects` / buckets | S3/MinIO buckets + a `files` table |
| `supabase_functions` triggers | Postgres `NOTIFY` + worker, or direct enqueue |
| `pgmq` email queue | Redis/BullMQ queue (`email` queue) |

### 2.1 Domain map (110 tables)

**Tenancy & identity**
`organizations`, `organization_members`, `workspaces`, `workspace_members`,
`workspace_invitations`, `projects`, `project_members`, `profiles`, `teams`,
`sso_connections`, `mfa_recovery_codes`, `deletion_requests`.

**Requirements & documents**
`documents`, `project_generated_docs`, `ingest_jobs`, `requirements`,
`requirement_versions`, `requirement_links`, `acceptance_criteria`,
`doc_diff_comments`, `endpoint_prds`, `api_endpoints`, `endpoint_test_plans`.

**Test design**
`test_plans`, `test_plan_versions`, `test_plan_documents`,
`test_plan_documents_v2`, `test_plan_document_versions`, `test_plan_specs`,
`test_plan_assignees`, `test_plan_test_cases`, `test_cases`, `test_case_steps`,
`test_case_versions`, `test_case_links`, `test_suites`, `suite_test_cases`,
`suite_grouping_versions`, `test_data_sets`, `test_parameters`,
`automation_assets`, `automation_mappings`.

**Execution**
`test_cycles`, `cycle_runs`, `cycle_run_items`, `cycle_attempts`, `suite_runs`,
`plan_test_runs`, `spec_runs`, `test_executions`, `execution_step_results`,
`evidence`, `environments`, `builds`, `deployments`, `releases`,
`release_evaluations`, `milestones`, `schedules`.

**Defects & quality**
`defects`, `defect_comments`, `defect_history`, `defect_links`, `defect_slas`,
`root_cause_records`, `quality_gates`, `gate_evaluations`, `waivers`,
`approvals`.

**AI**
`ai_agents`, `agent_execution_logs`, `agent_learning_sessions`, `ai_jobs`,
`ai_outputs`, `ai_evaluations`, `ai_feedback`, `ai_audit_events`,
`generation_stage_logs`.

**Infrastructure / jobs**
`jobs`, `job_attempts`, `job_artifacts`, `runners`, `runner_groups`,
`runner_jobs`, `integrations`, `integration_connections`,
`integration_activity_log`, `ci_integrations`, `ci_runs`, `repositories`,
`repository_branches`, `commits`, `pull_requests`, `github_repo_mappings`,
`jira_project_mappings`, `sync_logs`, `webhook_endpoints`, `webhook_events`,
`webhook_deliveries`, `api_keys`.

**Billing / platform**
`plans`, `subscriptions`, `usage_events`, `audit_logs`, `notifications`,
`activity_events`, `share_links`, `share_link_views`, `email_send_log`,
`email_send_state`, `email_unsubscribe_tokens`, `suppressed_emails`.

### 2.2 Enums (create verbatim)

```
agent_status, automation_status, build_status, cycle_status, defect_priority,
defect_severity, deployment_status, environment_type, execution_status,
invitation_status, job_status, org_role, plan_role, project_role,
project_source, project_status, project_visibility, release_status,
requirement_status, review_status, run_item_status, run_status,
subscription_status, test_case_status, user_role, workspace_role
```

Key values: `org_role = owner|billing_admin|security_admin|member`,
`workspace_role = owner|admin|editor|viewer`,
`project_role = lead|contributor|viewer`,
`plan_role = owner|assignee|reviewer|viewer`,
`project_visibility = inherited|restricted`,
`user_role = admin|qa_manager|qa_engineer|viewer`,
`job_status = queued|running|waiting|retrying|completed|failed|cancelled|dead_letter`.

### 2.3 Conventions every table follows

- `id uuid primary key default gen_random_uuid()`
- `created_at`, `updated_at timestamptz not null default now()` + an
  `update_updated_at_column()` BEFORE UPDATE trigger
- tenant scoping column: `org_id` / `workspace_id` / `project_id` (indexed)
- RLS enabled, plus explicit `GRANT` to the authenticated role
- soft ownership columns: `created_by`, `reported_by`, `executor_id`

---

## 3. Authorization model (must be enforced server-side)

Four nested tiers; permissions inherit downward, and can be narrowed:

1. **Organization** — billing/identity root. `org_role`.
2. **Workspace** — `workspace_role`.
3. **Project** — `project_role`; `projects.visibility`
   (`inherited` = every workspace member sees it, `restricted` = only
   `project_members` plus workspace owner/admin).
4. **Test plan** — `plan_role` (owner / assignee / reviewer / viewer).

Plus an account-level `user_role` (admin, qa_manager, qa_engineer, viewer) used
for feature gating (e.g. only managers reach Reporting).

**Helper functions to reimplement** (currently SECURITY DEFINER SQL — keep them
in the DB so both API and any direct SQL share one truth):

```
is_org_member(org_id)            org_role_of(org_id)
is_workspace_member(ws, user)    workspace_role_of(ws, user)
is_project_member(project_id)    project_role_of(project_id)
can_access_project(project_id)   workspace_of_project(project_id)
can_edit_test_plan(plan_id)      can_delete_test_plan(plan_id)
can_execute_test_plan(plan_id)   can_signoff_plan(plan_id)
can_manage_plan_assignees(plan_id)
current_app_role()               is_qa_manager()
can_use_feature(org_id, feature) within_quota(org_id, kind, additional)
org_entitlements(org_id)         org_usage_this_period(org_id, kind)
```

Concrete rules already enforced today:
- test plans: edit/delete by creator, plan owner/assignee, or qa_manager+
- test cases: edit/delete by reporter (`created_by`) or qa_manager+
- executions: qa_engineer only on plans they are assigned to
- workspace delete: workspace owner **and** qa_manager+
- reporting/audit/billing: qa_manager / admin / billing_admin only

**Request pipeline:** verify JWT → load claims → open a transaction with
`SET LOCAL app.user_id = <uuid>` and `app.claims = <jsonb>` → run the query as a
non-superuser role so RLS applies. Never expose a service-role connection to
user-facing routes.

---

## 4. Auth service

Endpoints the frontend expects (currently supplied by GoTrue; keep the shapes or
adapt `src/integrations/supabase/client.ts`):

| Purpose | Endpoint |
|---|---|
| Sign up (email+password, email confirm) | `POST /auth/v1/signup` |
| Sign in | `POST /auth/v1/token?grant_type=password` |
| Refresh | `POST /auth/v1/token?grant_type=refresh_token` |
| Sign out | `POST /auth/v1/logout` |
| Password reset request / update | `POST /auth/v1/recover`, `PUT /auth/v1/user` |
| Google OAuth | `GET /auth/v1/authorize?provider=google` + callback |
| SAML/OIDC SSO per org | `sso_connections` + JIT provisioning |
| TOTP MFA | enroll / challenge / verify + `mfa_recovery_codes` |
| OAuth 2.1 authorization server (for MCP) | `/authorize`, `/token`, DCR, consent page at `/.lovable/oauth/consent` |

Tokens: RS256 JWT, 1h access / 30d rotating refresh. Required claims:
`sub`, `email`, `role`, `aud=authenticated`, `exp`, and `client_id` for
OAuth-client tokens.

On signup, run the `handle_new_user()` equivalent: insert `profiles`, accept any
pending `workspace_invitations` for that email, create a default org +
free subscription.

---

## 5. HTTP API surface

Two styles are in use today; keep both.

### 5.1 Data API (PostgREST-compatible)

The frontend issues `supabase.from('table').select(...)` calls, which become
`GET /rest/v1/<table>?select=…&filter=…`. Cheapest path: run **PostgREST** in
front of your Postgres with the RLS above and a JWT secret. Otherwise implement
a generic resource router supporting `select`, `eq/neq/gt/lt/in/is/like`,
`order`, `limit`, `range`, embedded selects (`project:projects(name)`),
`Prefer: return=representation`, and upserts.

### 5.2 Service endpoints (former edge functions)

Port each of these as a route (`POST /fn/<name>` keeps the client unchanged):

**Ingestion & docs** — `process-document`, `ingest-github`, `ingest-zip`,
`repo-reader`, `extract-from-generated-docs`, `generate-prd`,
`tp-rr-download`.

**Test plan generation (Repo Reader)** — `tp-forge-generate`, `tp-forge-check`,
`tp-forge-cancel`, `tp-sqa-check`, `tp-generate-cases`, `tp-generate-docs`,
`tp-generate-cases-and-code`, `generate-test-plan`,
`generate-test-plan-from-docs`, `cancel-test-plan-job`, `suite-grouping`.

**Automation & execution** — `tp-forge-codegen`, `tp-forge-codegen-check`,
`tp-forge-run-start`, `tp-forge-run-check`, `tp-forge-run-cancel`,
`tp-generate-code`, `execute-api-test`, `create-cycle-from-suite`,
`spec-run-dispatch`, `runner-dispatch`, `runner-callback`, `runner-heartbeat`.

**Integrations** — `oauth-start`, `oauth-github-callback`, `oauth-jira-callback`,
`integrations-callback-info`, `integrations-disconnect`, `github-sync`,
`jira-sync`, `ci-webhook`, `dispatch-webhooks`.

**Org, billing, comms** — `redeem-invitation`, `send-invitation-email`,
`dispatch-notification`, `process-email-queue`, `auth-email-hook`,
`send-trial-reminder`, `create-checkout-session`, `create-billing-portal`,
`stripe-webhook`, `stripe-mode`, `payments-webhook`, `paddle-portal`,
`get-paddle-price`, `export-org-data`, `delete-account`, `delete-org`,
`sso-jit-provision`.

**Public / machine** — `api-v1` (API-key REST), `mcp` (agent integrations),
`job-worker`.

Auth policy per route: user JWT by default; **no JWT** for
`ci-webhook`, `stripe-webhook`, `payments-webhook`, `runner-heartbeat`,
`runner-callback`, `oauth-*-callback`, `auth-email-hook`, `api-v1`, `mcp` —
these authenticate by signature, shared secret, or API key instead.

### 5.3 Public REST API (`api-v1`)

`Authorization: Bearer qxa_<random>`; the key is SHA-256 hashed into
`api_keys.key_hash`, carries `scopes[]`, is org-scoped and revocable.
Scope matching supports `*`, `<ns>:*`, exact.

```
GET  /v1/me                      → key metadata + scopes
GET  /v1/projects                → projects:read
GET  /v1/test-plans?project_id=  → testplans:read
GET  /v1/test-cases?project_id=  → testcases:read
GET  /v1/defects?project_id=     → defects:read
POST /v1/defects                 → defects:write
```
Update `last_used_at` on each call; rate-limit per key (e.g. 600 req/min).

### 5.4 MCP server

Streamable-HTTP MCP endpoint at `/functions/v1/mcp` with OAuth 2.1 bearer
verification (issuer = your auth service, audience `authenticated`), exposing
`list_projects`, `list_test_plans`, `list_test_cases`, `list_defects`,
`create_defect`. Each tool must run queries **as the calling user** so RLS
applies; never with an admin key.

---

## 6. Job system (durable, must survive 25+ minute runs)

`jobs` table: `kind`, `payload jsonb`, `status job_status`, `priority`,
`attempt_count`, `max_attempts`, `run_after`, `locked_at`, `locked_by`,
`progress int`, `progress_message`, `checkpoint jsonb`, `result jsonb`,
`error jsonb`, plus `org_id/workspace_id/project_id`.
`job_attempts` records each try; `job_artifacts` stores outputs.

Worker loop (currently `claim_jobs(worker, limit, visibility_sec)` using
`FOR UPDATE SKIP LOCKED`):

1. Claim ≤5 jobs where `status in (queued, retrying)` and `run_after <= now()`
   and (`locked_at is null` or older than 300 s).
2. Run the handler for `kind`.
3. Handler may return `{__job_control:'waiting', checkpoint, run_after}` — this
   is how long external Repo Reader jobs are polled without holding a worker.
4. Success → `completed`, progress 100, meter usage.
   Failure → `retrying` with exponential backoff `min(900, 2^attempt*15)` s,
   or `dead_letter` at `max_attempts` / non-retryable errors.
5. Cancellation: set `status='cancelled'`; handlers check before each step and
   call the external cancel endpoint.

Job kinds in use: `generate_test_plan_from_docs`, `tp_generate_cases`,
`tp_generate_code`, `tp_generate_docs`, `generate_prd`, `ai_release_judge`,
ingestion, runner dispatch, gate evaluation, email dispatch.

Run workers as a separate always-on process (2–4 replicas), not per-request.
AI job kinds insert a `usage_events` row (`kind='ai_job'`) for quota metering.

---

## 7. Realtime

Frontend subscribes to row changes on: `notifications`, `defects`,
`test_executions`, `jobs`, `plan_test_runs`, `cycle_runs`, `ingest_jobs`,
`project_generated_docs`.

Implementation: logical replication or `AFTER INSERT/UPDATE` triggers issuing
`pg_notify('table_changes', json)`, a fan-out service holding WS connections,
and **per-subscriber authorization** — re-check RLS visibility before pushing a
row. Payload shape: `{ type: 'INSERT'|'UPDATE'|'DELETE', table, record, old_record }`.

---

## 8. Storage

Buckets: `avatars` (public read), `documents`, `evidence`, `artifacts`,
`exports` (all private, signed URLs, 1 h TTL).
Limits: 25 MB per document/evidence upload, 200 MB per repo zip.
Provide `POST /storage/upload` (multipart, virus-scan optional) and
`GET /storage/sign?path=` returning a presigned URL. Store metadata rows in
`evidence` / `job_artifacts` / `documents`.

---

## 9. External service contracts

### 9.1 Repo Reader — `https://reporeader.qualixa.cortanexai.com`
Header `X-API-Key: <DOC_GENERATOR_API_KEY>`.

| Purpose | Call |
|---|---|
| Clone repo / upload zip | `POST /v1/jobs` (git url or multipart zip) |
| Poll | `GET /v1/jobs/{id}` → `status`, `progress`, `stage` |
| Extracted documents | `GET /v1/jobs/{id}/documents`, `/branches`, `/files` |
| SQA test plan | `POST /v1/jobs/{id}/sqa-plan` → markdown + coverage JSON |
| Test cases | `POST /v1/jobs/{id}/test-cases` (test types, max smoke/regression, priority) |
| Playwright codegen | `POST /v1/jobs/{id}/codegen` (optional `suite_id`) |
| Execution | `POST /v1/jobs/{id}/playwright-execution` → `live_view_url`, log tail, per-test progress; `DELETE` to cancel |

Requires env vars `PLAYWRIGHT_BASE_URL`, `API_BASE_URL`, `E2E_AUTH_TOKEN` to be
supplied with codegen/execution requests (mandatory).

### 9.2 LLM gateway
OpenAI-compatible `POST /v1/chat/completions` used for PRD generation, release
judge, suite grouping, evaluations. Configure `AI_BASE_URL`, `AI_API_KEY`,
default model, and per-org token budgets.

### 9.3 Billing
Stripe Checkout + Customer Portal + `stripe-webhook` (verify
`Stripe-Signature`) syncing `subscriptions` (trialing/active/past_due/canceled)
and plan entitlements. Paddle is wired as an alternative.

### 9.4 Email
Resend API or SMTP. Queue → `process-email-queue` worker → provider, with
`email_send_log`, `email_send_state` (idempotency), `suppressed_emails`
(bounces/complaints) and `email_unsubscribe_tokens`.

---

## 10. Configuration (environment variables)

```
# core
DATABASE_URL=postgres://qualixa:***@db:5432/qualixa
REDIS_URL=redis://redis:6379
PUBLIC_APP_URL=https://app.example.com
API_URL=https://api.example.com

# auth
JWT_PRIVATE_KEY / JWT_PUBLIC_KEY   (RS256 PEM)
JWT_ISSUER=https://api.example.com/auth/v1
ACCESS_TOKEN_TTL=3600
GOOGLE_OAUTH_CLIENT_ID / _SECRET

# storage
S3_ENDPOINT / S3_REGION / S3_ACCESS_KEY / S3_SECRET_KEY / S3_BUCKET_PREFIX

# external
DOC_GENERATOR_BASE_URL=https://reporeader.qualixa.cortanexai.com
DOC_GENERATOR_API_KEY=***
AI_BASE_URL / AI_API_KEY / AI_DEFAULT_MODEL

# integrations
GITHUB_OAUTH_CLIENT_ID / _SECRET
JIRA_OAUTH_CLIENT_ID / _SECRET

# billing
STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_PRO_MONTHLY / _YEARLY / STRIPE_PRICE_ENTERPRISE_MONTHLY / _YEARLY

# email
RESEND_API_KEY / RESEND_FROM_EMAIL   (or SMTP_*)

# internal
JOB_WORKER_SECRET=***        # authorizes worker/cron calls
WEBHOOK_SIGNING_SECRET=***   # outbound webhook HMAC
```

Frontend build vars to repoint: `VITE_SUPABASE_URL` → your API URL,
`VITE_SUPABASE_PUBLISHABLE_KEY` → your public anon key/JWT audience key,
`VITE_SUPABASE_PROJECT_ID`.

---

## 11. Deployment topology

`docker-compose.yml` services: `postgres`, `redis`, `minio`, `api` (2+),
`worker` (2+), `realtime`, `nginx`, `backup`.
Cron (systemd timers or a scheduler container):

| Schedule | Task |
|---|---|
| every 30 s | `job-worker` tick |
| every 1 min | `process-email-queue` |
| every 5 min | runner heartbeat sweep (mark stale runners offline) |
| hourly | webhook delivery retries, usage rollups |
| daily | trial reminders, SLA breach check, `pg_dump` backup, log rotation |

Sizing to start: DB 4 vCPU / 8 GB / 100 GB SSD; API 2 vCPU / 4 GB each;
workers 2 vCPU / 4 GB each (execution polling is IO-bound).

---

## 12. Security requirements

- RLS on **every** public table; no default grants — grant explicitly per role.
- Service-role/DB-superuser credentials only inside worker and webhook paths.
- API keys hashed (SHA-256), shown once, prefix stored for display, revocable.
- Outbound webhooks signed `X-Signature: sha256=HMAC(secret, timestamp.body)`,
  retried with backoff, deliveries logged.
- Inbound webhooks verify provider signatures before touching the DB.
- Audit every privileged mutation into `audit_logs`
  (actor, action, entity, before/after, ip, user agent).
- TOTP MFA with recovery codes; org-level enforcement flag.
- GDPR: `export-org-data` (JSON/CSV bundle) and `deletion_requests` with a
  30-day grace period.
- Rate limits: 100 req/min per user, 600 req/min per API key, 5 login attempts
  per 15 min per IP+email.
- Leaked-password check (HIBP) at signup and password change.

---

## 13. Migration path from the current hosted backend

1. `pg_dump --no-owner --no-acl` the current database; restore into your Postgres.
2. Create `public.users` from the exported auth users; keep the same UUIDs so
   every FK stays valid. Force a password reset (hashes are bcrypt-compatible if
   you can export them; otherwise email a reset link to all users).
3. Replace `auth.uid()` with `current_setting('app.user_id')::uuid` across all
   policies and SECURITY DEFINER functions (one migration, mechanical sed).
4. Copy storage objects into MinIO/S3 under the same paths.
5. Stand up PostgREST (or your API) + auth + workers; port the 59 functions.
6. Point the frontend at the new URLs, run `tests/rls/probe.py` and
   `tests/smoke/run.py` against the new stack, then cut DNS over.

---

## 14. Acceptance checklist

- [ ] All 110 tables restored with RLS enabled and grants applied
- [ ] Auth: signup/login/refresh/reset/Google/SSO/MFA all pass
- [ ] RLS probe suite green for all four roles and both visibility modes
- [ ] A 25-minute generation job survives worker restart and reports live progress
- [ ] Playwright execution shows live view + streaming logs, and cancels cleanly
- [ ] Realtime pushes defects/executions/jobs within 1 s and never leaks rows
- [ ] Stripe checkout → webhook → entitlements update end-to-end
- [ ] Invitation email → accept link → membership created
- [ ] `api-v1` and MCP both authenticate and respect scopes/RLS
- [ ] Nightly backup restores into a clean database
