
# Sprint B + C — Durable Jobs, CI Ingestion, Traceability

This batch covers Phase 1.8 (durable jobs), Phase 1.6 (CI ingestion + result parsing), the realtime/notification layer those feed, plus a first slice of Phase 1.2/1.3 (requirements traceability + test case governance) and the missing CRUD wiring around the entities Sprint A introduced.

Out of scope for this batch (will be later sprints to keep this shippable): full Phase 2 (runners, perf, a11y, visual), Phase 3 AI judges, and the heavier defect-lifecycle / quality-gates work (Phase 1.5/1.7).

---

## 1. Durable Job Orchestration (Phase 1.8)

### Schema (one migration)
- `jobs(id, workspace_id, project_id, kind, status, priority, payload jsonb, result jsonb, error jsonb, attempt_count, max_attempts, run_after, locked_at, locked_by, idempotency_key UNIQUE, progress int, checkpoint jsonb, created_by, created_at, updated_at)`
  - `status`: `queued | running | waiting | retrying | completed | failed | cancelled | dead_letter`
  - `kind`: `generate_test_plan_from_docs | generate_test_cases | ingest_ci_results | ingest_junit | …`
- `job_attempts(id, job_id, attempt_no, started_at, finished_at, status, error jsonb, logs text)`
- `job_artifacts(id, job_id, kind, ref text, meta jsonb, created_at)`
- GRANTs to `authenticated` (select on own workspace) + `service_role` (all); RLS via `is_workspace_member(workspace_id, auth.uid())`.
- `ALTER PUBLICATION supabase_realtime ADD TABLE jobs, job_attempts;`

### Worker
- New edge function `job-worker` (verify_jwt = false, called by cron). Loop:
  1. `SELECT … FROM jobs WHERE status IN ('queued','retrying') AND run_after <= now() ORDER BY priority, created_at FOR UPDATE SKIP LOCKED LIMIT N;`
  2. Mark `running`, insert `job_attempts` row, dispatch by `kind`.
  3. Handler streams `progress`/`checkpoint` updates so UI sees motion.
  4. On success → `completed`; on retryable failure → `retrying` with exp backoff and `attempt_count++`; when `attempt_count >= max_attempts` → `dead_letter`.
- pg_cron schedule: every minute hit `job-worker` via `net.http_post` (uses anon key + project URL; user-specific so done via `insert` tool, not migration).
- Idempotency: `idempotency_key` unique constraint; producers reuse keys to dedupe.

### Producer refactor
- `generate-test-plan-from-docs`: replace `EdgeRuntime.waitUntil(runGeneration(...))` with `INSERT INTO jobs(kind='generate_test_plan_from_docs', payload={test_plan_id})` and return `{job_id}`. The actual generation logic moves to `_shared/handlers/generate-test-plan.ts` and is invoked by `job-worker`.
- Same pattern for any future >30s work (CI ingestion below uses it too).
- `test_plans.ai_status` keeps working but is now mirrored from the job row.

### UI
- `useJob(jobId)` hook: realtime subscription on `jobs` row for live progress.
- `TestPlanDetailPage` shows progress bar + attempt count + last error from the job instead of polling `ai_status`.
- Navigation away no longer cancels anything (worker owns the lifecycle).

---

## 2. CI Webhook + Result Ingestion (Phase 1.6)

### Schema
- `ci_integrations(id, project_id, provider, name, secret_hash, default_environment_id, default_release_id, branch_release_map jsonb, created_by, created_at)`
- `ci_runs(id, project_id, integration_id, provider_run_id, branch, commit_sha, status, started_at, finished_at, url, raw jsonb)`
- `automation_mappings(id, project_id, test_case_id, framework, test_id_pattern)` — links automation test ids to manual cases.
- GRANTs + RLS + realtime on `ci_runs`.

### Edge functions (public, no JWT, HMAC-validated)
- `ci-webhook` — accepts `{ provider, event: 'build'|'deployment'|'results', release, environment, branch, commit_sha, build_url, status, artifacts[] }`. Creates/updates `builds` + `deployments` rows under the right `release`/`environment`, enqueues `ingest_ci_results` job per artifact.
- `ingest-ci-results` (called by worker): downloads artifact, detects format (JUnit XML / Playwright JSON / Allure / Cypress JSON), parses to a normalized shape, then:
  1. Resolves `test_cycle` (auto-create one named `CI {commit_sha[:7]}` if none exists for that release+env+build).
  2. Creates a `cycle_run` (executor = ci_integration), and per parsed test:
     - Resolve `test_case_id` via `automation_mappings` (fallback: by `coverage_tags`/title match, otherwise create a ghost case flagged `ai_generated=false, source='ci'`).
     - Insert `cycle_run_item` with status, duration, attempt_no.
     - Insert `cycle_attempt` with logs/error_signature.
     - Upload screenshots/videos/HAR to `job_artifacts` (bucket `ci-evidence`, created in migration).
  3. Updates `builds.status`, posts notifications.
- Parser code in `supabase/functions/_shared/parsers/{junit,playwright,allure,cypress}.ts`.

### UI
- `IntegrationsPage`: add "CI Integrations" tab — create integration, copy webhook URL + signing secret (shown once), map branches → releases.
- `ReleasesPage` / `CycleDetailPage`: show linked builds + commit SHA + CI run link.

---

## 3. Realtime + Notifications

- New trigger `notify_build_status` on `builds`: notify workspace managers on `failed`/`succeeded` transitions.
- New trigger `notify_cycle_run_status` on `cycle_runs`: notify cycle owner + executor on completion.
- Extend `useRealtimeUpdates` to subscribe to `cycle_runs`, `cycle_run_items`, `builds`, `jobs` and invalidate the matching React Query keys + toast on terminal status.
- `CycleDetailPage` already lives — add live progress (`pending/passed/failed/blocked` counts) computed from realtime stream.

---

## 4. Requirements Traceability — first slice (Phase 1.2)

Lightweight to unblock the UI; deeper governance later.
- `requirements(id, project_id, key, title, description, source_document_id, status, priority, created_by, created_at, updated_at)`
- `acceptance_criteria(id, requirement_id, text, order_index)`
- `requirement_links(id, requirement_id, linked_type, linked_id)` polymorphic to `test_cases | defects`.
- View `requirement_coverage` computing status from linked test_case execution results.
- New page `/requirements` with list + detail + link-to-test-case dialog. Sidebar entry under "Strategy".

## 5. Test Case Governance — first slice (Phase 1.3)

- Add columns to `test_cases`: `review_status`, `reviewer_id`, `owner_id`, `automation_status`, `automation_path`, `estimated_duration_min` (only what UI uses now).
- Already-existing `test_case_versions` table: add trigger to snapshot on approved edits.
- `TestCaseEditorPage`: review/approve buttons, owner picker, version history drawer.

## 6. CRUD + Wiring Gaps from Sprint A

- `ReleasesPage`: add edit + delete + status transitions (`planned → in_progress → released → archived`).
- `CyclesPage`: add edit + close + clone-from-suite action that calls new `create-cycle-from-suite` edge function (snapshots case versions into `cycle_run_items`).
- `ExecutionsPage`: wire to `cycle_runs` instead of legacy `test_executions` for cycle-scoped runs; keep legacy for ad-hoc.
- `AppSidebar`: add Requirements + CI Integrations entries.
- `ActiveCycleContext`: persist multi-select in localStorage per project.

---

## Technical notes

- Every new `public` table gets `GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated` + `GRANT ALL … TO service_role`, RLS enabled, policies via `is_workspace_member` / `has_role`.
- New secrets: `CI_WEBHOOK_SIGNING_SECRET` (generate_secret, 64 chars).
- New storage bucket `ci-evidence` (private), policy: workspace members read, service_role write.
- Cron registration uses the `insert` tool (contains project URL + anon key), not migrations.
- Validation: after deploy, hit `job-worker` via `supabase--curl_edge_functions`, post a sample JUnit XML to `ci-webhook` (HMAC-signed) and confirm a `cycle_run` appears; load `/cycles/:id` and watch realtime progress.

## Delivery order inside this batch

1. Jobs schema + worker + producer refactor (test plan generation no longer cancellable).
2. CI schema + `ci-webhook` + JUnit parser + `ingest-ci-results` handler.
3. Add Playwright/Allure/Cypress parsers.
4. Realtime triggers + UI live progress + notification routing.
5. Requirements + governance slice.
6. CRUD wiring (releases/cycles/executions/sidebar).
7. End-to-end validation pass with `supabase--curl_edge_functions` + Playwright screenshots of `/cycles/:id` and `/requirements`.

Approve to start.
