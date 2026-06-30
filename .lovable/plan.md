## Goal

Harden, expose, and operate the 30 tables added in the last migration: prove they work, type them, build an isolated admin to drive them, and seed sample data.

## 1. Database verification (no schema changes expected)

- Confirm last migration applied cleanly by introspecting `information_schema` for all 30 target tables, their `rowsecurity`, and at least one policy each.
- Add a tiny helper migration **only if gaps surface** (e.g. missing `GRANT`, missing policy on a child table). Otherwise zero migrations in this step.
- Enable `pg_graphql` extension in the `graphql` schema (Supabase ships it; just `CREATE EXTENSION IF NOT EXISTS pg_graphql`).
- Add `COMMENT ON TABLE` directives so pg_graphql generates clean type names for the new tables (organizations, repositories, requirement_versions, defect_comments/links/history/slas, approvals, waivers, ai_jobs/outputs/audit_events, etc.).

## 2. CRUD + RLS probe (`tests/rls/probe.py`)

Standalone Python script driven by `psql` + the Supabase REST endpoint with two synthetic users in two workspaces.

For every new table:
1. User A inserts a row scoped to workspace A — expect success.
2. User B selects/updates/deletes — expect 0 rows / permission error.
3. User A selects own row — expect success.
4. Cleanup.

Output: `tests/rls/report.json` + console summary. Wired into `.github/workflows/smoke.yml` as a separate job before the existing Playwright smoke.

## 3. GraphQL layer (pg_graphql + codegen)

- Add deps: `bun add graphql graphql-request` and `bun add -d @graphql-codegen/cli @graphql-codegen/client-preset @graphql-codegen/typescript @graphql-codegen/typescript-operations`.
- `codegen.ts` at repo root pointing at `${VITE_SUPABASE_URL}/graphql/v1` with the publishable key header.
- `src/graphql/client.ts` — `GraphQLClient` wired to Supabase GraphQL endpoint, injects current session JWT.
- `src/graphql/operations/*.graphql` — queries + mutations for: organizations, repositories, requirement_versions, defects (+ comments/links/history), approvals, waivers, ai_jobs, ai_outputs, ai_audit_events.
- `bun run codegen` generates `src/graphql/generated.ts` (typed hooks via `graphql-request`).
- Doc in `README.md` for how to regenerate.

## 4. Isolated `/admin` dashboard

Mounted at `/admin/*` in `App.tsx` with its own `AdminLayout` — no `AppSidebar`, no `WorkflowNav`, distinct slate/amber theme so it's visually clearly separate. Gated by `useAuth().hasPermission('admin')`; non-admins get a 403 panel.

```text
/admin
  /repositories          (CRUD + branches drawer)
  /requirement-versions  (browse, diff, restore)
  /defects               (list + detail with comments/links/history/slas)
  /approvals             (approvals + waivers tabs)
  /ai-jobs               (read-only: jobs, outputs, audit events)
```

Pages use the new GraphQL hooks. Shared primitives: `AdminPageHeader`, `AdminDataTable` (TanStack table), `AdminDrawer`.

## 5. Seed fixtures (`supabase/seed/admin-fixtures.sql`)

Idempotent SQL (guarded with `ON CONFLICT DO NOTHING` and stable UUIDs):
- 1 organization, 1 workspace, 1 project, 1 repository + 2 branches, 1 pull_request, 2 commits.
- 1 requirement + 2 requirement_versions, 1 test_plan + 1 test_plan_version.
- 1 defect with 1 comment, 1 link, 1 history entry, 1 SLA row.
- 1 approval, 1 waiver.
- 1 ai_job → 1 ai_output → 1 ai_audit_event.

Runner: `bun run seed:admin` (psql via `$SUPABASE_DB_URL`). Documented in README under "Local fixtures".

## 6. End-to-end smoke for `/admin`

Extend `tests/smoke/run.py` with the 5 admin routes (auth as seeded admin via existing storage-key injection), then add `tests/e2e/admin-crud.py` that exercises create/edit/delete on Repositories and Approvals pages and screenshots each state.

## Technical details

- pg_graphql respects RLS automatically — no extra auth shim needed.
- Codegen runs offline against a saved `schema.graphql` snapshot (`bun run codegen:schema` first) so CI doesn't need DB access.
- Admin theme tokens live in `src/admin/theme.css` (slate-950 bg, amber-400 accents, JetBrains Mono headings) — fully scoped under `.admin-shell` so it can't bleed into the main app.
- Probe script uses `service_role` only to provision the two test users + workspaces; all assertions go through user-scoped anon JWTs.

## Out of scope

- No changes to existing pages, sidebar, or workflow nav.
- No new background jobs.
- No real AI calls in seed data — `ai_outputs.content` is static JSON.

## Deliverables checklist

- [ ] pg_graphql enabled + table comments migration
- [ ] `tests/rls/probe.py` + CI job
- [ ] codegen config + generated types + 5 operation files
- [ ] `/admin` shell + 5 pages
- [ ] `supabase/seed/admin-fixtures.sql` + `bun run seed:admin`
- [ ] admin routes added to smoke + new `admin-crud.py`
- [ ] README section: "Admin dashboard, GraphQL, seeds, RLS probe"
