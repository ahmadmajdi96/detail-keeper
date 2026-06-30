
# Qualixa → Quality Operations Platform: Phased Roadmap

## Guiding principle
Remove the "single active test plan owns the whole project" assumption. The **Test Cycle** becomes the operational scope (release × environment × build × suite). Test Plans go back to being strategy documents. Multiple cycles run in parallel.

---

## Phase 1 — Core QA Operations (Foundation)

### 1.1 Release & Delivery Model (FIRST SLICE — build now)

New entities:

```text
releases            (project_id, name, version, status, target_date, owner_id)
environments        (project_id, name, type, base_url, secrets_ref)
builds              (project_id, release_id, branch, commit_sha, artifact_url, ci_run_url, status)
deployments         (build_id, environment_id, deployed_at, deployed_by, status)
test_suites         (project_id, name, parent_id, tags)
test_cycles         (release_id, environment_id, build_id, suite_id, name, status, start_at, end_at, owner_id)
test_runs           (cycle_id, executor_id, status, started_at, finished_at)
test_run_items      (run_id, test_case_id, status, attempt_no, duration_ms, evidence_ref)
test_attempts       (run_item_id, attempt_no, status, logs_ref, error_signature)
```

Behavior changes:
- Drop demote-others-to-draft logic. `test_plans.status` = strategy lifecycle (`draft|approved|archived`), no longer "the active one".
- `ActiveTestPlanContext` → `ActiveCycleContext` (per project, multi-select allowed in UI).
- Executions page lists cycles, not plans. "0 runnable cases" issue disappears: runnable = cases linked to the cycle's suite + cycle status `in_progress`.
- Realtime channel per cycle so parallel hotfix + feature work don't collide.

User stories shipped:
- Create Release 2.4, link branch/build/env.
- Run regression on staging without touching UAT results.
- Two parallel cycles (hotfix + feature) on one project.
- Stakeholder release-readiness view per release.

### 1.2 Requirements Traceability Layer
Tables: `requirements`, `acceptance_criteria`, `requirement_versions`, `requirement_links` (polymorphic to test_cases, defects, risks).
Coverage statuses computed in a view: `not_analyzed | no_coverage | manual | automated | covered_failing | covered_passing | blocked | obsolete | needs_review`.
AI extraction writes to a **review queue** (status `proposed`) — humans approve into baseline. Source citations stored (`document_id`, `page`, `span`).

### 1.3 Test Case Governance
Add to `test_cases`: `review_status`, `reviewer_id`, `owner_id`, `risk_score`, `estimated_duration_min`, `automation_status`, `automation_path`, `component_tags`, `env_requirements`.
New: `test_case_reviews`, `test_case_baselines` (frozen sets per release), `shared_steps`, `test_parameters`, `test_data_sets`.
Versioning: every approved edit creates a `test_case_versions` row; baselines pin a version per release.

### 1.4 Execution Workspace upgrades
Per-step results already partially exist (`execution_step_results`) — extend with evidence per step (screenshot/video/HAR/console/API response). Add `not_run`, `in_progress`, `not_applicable`. Pause/resume, bulk execute, "re-run failed", "re-run for fixed defects". Exploratory module: `exploration_sessions` (charter, timebox, notes, findings, linked defects/requirements).

### 1.5 Defect Lifecycle
Add: `severity` and `priority` separate, `sla_policy_id`, `found_in_build_id`, `fixed_in_build_id`, `verified_in_build_id`, `root_cause_category`, `source` (manual/automation/customer/prod/security/monitoring), `reopen_count`, `duplicate_of`. New tables: `defect_slas`, `defect_history` (immutable), `root_cause_records`. Duplicate detection via embedding similarity on title+repro.

### 1.6 CI/CD Ingestion
New: `ci_integrations`, `ci_runs`, edge function `ingest-ci-results` accepting JUnit XML, Playwright JSON, Allure, Cypress, pytest, k6, Lighthouse via signed webhook. Maps to test cases via `automation_mappings(test_case_id, framework, test_id_pattern)`. Posts PR check status back via GitHub/GitLab connectors.

### 1.7 Quality Gates & Release Decisions
Tables: `quality_gates` (rules), `release_decisions` (Go/Conditional/Block + rationale), `approvals`, `waivers`. Evaluation function runs on cycle completion and writes a decision draft.

### 1.8 Durable Job System (replaces `EdgeRuntime.waitUntil` for long work)
Tables: `jobs`, `job_attempts`, `job_artifacts`. Statuses: `queued|scheduled|running|waiting_for_input|retrying|completed|failed|cancelled|expired`. Worker = scheduled edge function pulling FIFO with `FOR UPDATE SKIP LOCKED`, checkpoints, idempotency keys, dead-letter. Realtime stream on `jobs` row for UI progress. `waitUntil` retained only for <30s fire-and-forget.

---

## Phase 2 — Automation & Quality Dimensions

- **Runner architecture:** `runners`, `runner_groups`, `runner_tokens` (scoped), capability tags, hosted + self-hosted agents (Docker image polling jobs queue), concurrency + quotas per workspace, secret injection via short-lived JWT.
- **API quality module:** OpenAPI diff + breaking-change detection, contract tests (consumer/provider), request chaining, environment variables, auth profiles (OAuth2/JWT/APIKey/Basic/mTLS), mock server, negative/boundary/rate-limit generators, response-time assertions, OWASP API Top 10 checks.
- **UI automation:** Playwright/Cypress trace + video + screenshot ingestion, browser project matrix, shard awareness.
- **Performance:** k6 integration, thresholds → pass/fail, Core Web Vitals + Lighthouse CI trends, perf budgets per release.
- **Accessibility:** WCAG 2.2 axe-core scans, manual checklists, contrast/keyboard/ARIA evidence.
- **Visual regression + cross-browser/device matrix.**
- **Test data & environment management:** datasets versioned, env health pings, "env ready for cycle" gate.

---

## Phase 3 — AI Quality Intelligence (Differentiator)

Each AI module writes to `ai_jobs` → `ai_outputs` → human review → `ai_evaluations` + `ai_feedback`. Every output stores model+prompt version, source citations, confidence, reviewer decision (NIST AI RMF aligned).

- **Requirement Quality Analyst** — ambiguity, contradictions, missing AC, untestable items.
- **Test Architect** — scenarios, negative/boundary, BDD, test data, dedupe suggestions, risk scoring.
- **Failure Triage Agent** — cluster failures, compare to history, suggest component + root cause, link/create defect drafts.
- **Test-Maintenance Agent** — detect stale tests on requirement/API change, propose diffs (never auto-apply approved assets).
- **Release Quality Judge** — flagship. Inputs: coverage, executions, defects, security, perf, a11y, flakiness, env stability, history. Output: Go/Conditional/Block + confidence + blocking issues + required actions. **Advises only; humans approve.**

---

## Phase 1.1 Implementation Detail (next concrete sprint)

Migrations (one file):
1. Create `releases`, `environments`, `builds`, `deployments`, `test_suites`, `test_cycles`, `test_runs`, `test_run_items`, `test_attempts` with GRANTs + RLS scoped via `is_workspace_member(project.workspace_id, auth.uid())`.
2. Backfill: for each existing project with an active test plan, create Release "Initial", Environment "Default", a Suite from the plan's cases, and one open Cycle so current data keeps working.
3. Drop the trigger/code path that demotes other plans on activation.

Frontend:
- New routes: `/releases`, `/releases/:id`, `/cycles`, `/cycles/:id`.
- `ActiveTestPlanContext` → `ActiveCycleContext` (allows multiple selected cycles).
- `ExecutionsPage` rewritten around cycles; "runnable" = `test_run_items` for the chosen cycle. Removes the status-filter workaround.
- `TestPlansPage` becomes strategy-only (no more "active plan" toggle).
- Sidebar: add Releases + Cycles, keep Test Plans under "Strategy".

Edge functions:
- `create-cycle-from-suite` (snapshots case versions into `test_run_items` at cycle start → baseline).
- `ingest-ci-results` (skeleton; full parsers in Phase 1.6).
- Refactor `generate-test-plan-from-docs` to enqueue a `job` row instead of relying on `waitUntil` for >30s work.

### Technical notes
- All new public-schema tables include `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` + `GRANT ALL ... TO service_role`, RLS enabled, policies use `has_role` / `is_workspace_member`.
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE test_run_items, jobs, test_cycles`.
- Keep dark "Qualixa" cyan/purple aesthetic; no new design tokens needed in Phase 1.1.
- No breaking removal of `test_plans` — kept as strategy, with a deprecation note in code comments only.

---

## Deliverable order if you approve

1. **Sprint A (Phase 1.1):** Releases + Cycles + parallel Runs + migration + UI swap + executions rewrite.
2. **Sprint B (Phase 1.8 + 1.6):** Jobs system + CI ingestion + PR checks.
3. **Sprint C (Phase 1.2 + 1.3):** Requirements traceability + test case governance.
4. **Sprint D (Phase 1.4 + 1.5 + 1.7):** Execution evidence, defect lifecycle, quality gates.
5. **Phase 2** sprints (runners, API quality, perf, a11y, visual).
6. **Phase 3** sprints (AI modules, ending with Release Quality Judge).

Approve to start Sprint A.
