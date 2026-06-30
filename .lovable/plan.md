## Plan: AI-Native Test Plan with Executable Playwright + QA/CI Hardening

### Part A — Test Plan Two-Stage Generation, Editor & Execution

**Stage 1 — Generate 10 testing documents (AI-decided per project)**

Add a "Generate Documents" action on `TestPlanDetailPage`. Calls a new edge function `tp-generate-docs` which:
- Loads project context (PRDs, requirements, suites, endpoints).
- Asks Lovable AI (`google/gemini-3-flash-preview`) to decide the 10 most relevant QA artifact types for *this* project (could include Test Strategy, Risk Matrix, Traceability Matrix, Env Plan, Data Plan, Entry/Exit Criteria, Defect Workflow, Automation Plan, Performance Plan, Security Plan — model picks based on project).
- Returns `[{ slug, title, kind, content_md }, ...]` (length 10) via structured output.
- Persists each as a row in new `test_plan_documents_v2` table linked to the plan.

**Stage 2 — Generate test cases + Playwright code (one suite per doc)**

New action "Generate Test Cases & Code". Calls `tp-generate-cases-and-code` edge function which:
- Sends all 10 documents back to the model.
- For each document, produces (a) a set of test case rows and (b) one Playwright `.spec.ts` file targeting that document's scope.
- Inserts `test_cases` + `test_plan_test_cases` links.
- Persists each spec to new `test_plan_specs` table (`filename`, `content`, `doc_id`).

**Editor — Monaco multi-tab**

New `TestPlanWorkbench` tab on `TestPlanDetailPage`:
- Left rail: file tree grouped by Document (`.md`) and Spec (`.ts`).
- Right pane: Monaco editor (`@monaco-editor/react`) with one tab per opened file.
- Save persists to `test_plan_documents_v2` / `test_plan_specs` with optimistic updates and `queryClient.invalidateQueries`.
- Realtime subscription on both tables so multi-user edits sync.

**Execution — registered runner**

"Run" button on each spec tab dispatches via existing `runner-dispatch` with `{ spec_id, cycle_id }`. New table `spec_runs` records attempt → links to `runner_jobs`. Runner agent executes Playwright, posts back via `runner-callback` with stdout/stderr/result JSON. UI shows a Results panel below Monaco with stream of logs and pass/fail summary, subscribed via realtime on `spec_runs` + `runner_jobs`.

### Part B — Audit doc, regression, invalidation asserts, CI hardening

1. **`.lovable/page-audit.md`** — per-page CRUD coverage table, realtime subscription table, dead-button findings (scan each `src/pages/*.tsx`).
2. **Realtime regression** — extend `tests/e2e/realtime-regression.py` with a second scenario: dispatch → `running` → `failed` callback, assert `cycle_run.status === 'failed'` reflected in UI without URL change. Add explicit assertions that fresh `cycle_runs` and `runner_jobs` rows fetched via Supabase REST after each transition match the realtime-updated UI state (proves `invalidateQueries` fired correctly).
3. **CI smoke job hardening**:
   - Enable Playwright tracing per route, upload `.zip` traces.
   - Generate an HTML report (simple template that embeds screenshots + console errors per route) and upload it.
   - Capture `console.warning` alongside errors; new `console_warnings` field in `report.json`.
   - Job fails if any **new** warning appears vs. a checked-in `tests/smoke/baseline-warnings.json` allowlist.
   - Summary section appended to `report.json` containing aggregated console errors/warnings across all routes.

### Technical Notes

- **DB**: 3 new tables (`test_plan_documents_v2`, `test_plan_specs`, `spec_runs`), all with `GRANT` + RLS scoped via `is_workspace_member(workspace_of_project(project_id), auth.uid())`, and added to `supabase_realtime` publication.
- **Edge functions**: `tp-generate-docs`, `tp-generate-cases-and-code` use `Output.object` with Zod schemas; both use `google/gemini-3-flash-preview` per defaults. Reuses `_shared/ai-gateway.ts` (create if missing).
- **Monaco**: `bun add @monaco-editor/react monaco-editor`. Dark theme to match Qualixa.
- **Runner protocol**: extend `runner-dispatch` accepted body to include `spec_id`; runner-callback already accepts result payload — extend to upsert `spec_runs.result_json`, `stdout`, `stderr`.
- **No mock execution** — runner is responsible; if no runner registered, UI shows "Register a runner to execute" CTA.

### Files

- New: `supabase/functions/tp-generate-docs/index.ts`, `supabase/functions/tp-generate-cases-and-code/index.ts`, `supabase/functions/_shared/ai-gateway.ts` (if missing), `src/components/testplans/TestPlanWorkbench.tsx`, `src/components/testplans/MonacoFileTabs.tsx`, `src/components/testplans/SpecRunPanel.tsx`, `.lovable/page-audit.md`, `tests/smoke/baseline-warnings.json`, `tests/smoke/render_html_report.py`.
- Edit: `src/pages/TestPlanDetailPage.tsx` (add Workbench tab + Generate buttons), `src/hooks/useRealtimeUpdates.ts` (add `spec_runs`, `test_plan_documents_v2`, `test_plan_specs`), `supabase/functions/runner-dispatch/index.ts` + `runner-callback/index.ts` (spec_id support), `tests/smoke/run.py` (warnings + tracing), `tests/e2e/realtime-regression.py` (failure scenario + REST verification), `.github/workflows/smoke.yml` (artifacts + warning gate).

### Out of Scope (this turn)

- Multi-user cursor sync in Monaco (single-user save only).
- Auto-running every spec on every push (manual Run button).
- Editing the 10 doc *types* per project (model decides; no UI override).
