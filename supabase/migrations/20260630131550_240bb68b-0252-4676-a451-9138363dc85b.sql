
-- ============================================================
-- ORG TIER
-- ============================================================
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  description text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org owners manage" ON public.organizations FOR ALL
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "org members view" ON public.organizations FOR SELECT
  USING (auth.uid() IS NOT NULL);

ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "project members ws-scoped" ON public.project_members FOR ALL
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()))
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));

-- ============================================================
-- SOURCE CONTROL
-- ============================================================
CREATE TABLE public.repositories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'github',
  url text NOT NULL,
  default_branch text DEFAULT 'main',
  external_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repositories TO authenticated;
GRANT ALL ON public.repositories TO service_role;
ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "repos ws-scoped" ON public.repositories FOR ALL
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()))
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));

CREATE TABLE public.repository_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id uuid NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  name text NOT NULL,
  head_sha text,
  is_default boolean NOT NULL DEFAULT false,
  protected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repository_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repository_branches TO authenticated;
GRANT ALL ON public.repository_branches TO service_role;
ALTER TABLE public.repository_branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branches via repo" ON public.repository_branches FOR ALL
  USING (EXISTS (SELECT 1 FROM public.repositories r WHERE r.id = repository_id
    AND public.is_workspace_member(public.workspace_of_project(r.project_id), auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.repositories r WHERE r.id = repository_id
    AND public.is_workspace_member(public.workspace_of_project(r.project_id), auth.uid())));

CREATE TABLE public.pull_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id uuid NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  number integer NOT NULL,
  title text NOT NULL,
  body text,
  state text NOT NULL DEFAULT 'open',
  author text,
  source_branch text,
  target_branch text,
  head_sha text,
  merged_at timestamptz,
  url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repository_id, number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pull_requests TO authenticated;
GRANT ALL ON public.pull_requests TO service_role;
ALTER TABLE public.pull_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "PRs via repo" ON public.pull_requests FOR ALL
  USING (EXISTS (SELECT 1 FROM public.repositories r WHERE r.id = repository_id
    AND public.is_workspace_member(public.workspace_of_project(r.project_id), auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.repositories r WHERE r.id = repository_id
    AND public.is_workspace_member(public.workspace_of_project(r.project_id), auth.uid())));

CREATE TABLE public.commits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id uuid NOT NULL REFERENCES public.repositories(id) ON DELETE CASCADE,
  sha text NOT NULL,
  branch text,
  message text,
  author_name text,
  author_email text,
  committed_at timestamptz,
  url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repository_id, sha)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commits TO authenticated;
GRANT ALL ON public.commits TO service_role;
ALTER TABLE public.commits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commits via repo" ON public.commits FOR ALL
  USING (EXISTS (SELECT 1 FROM public.repositories r WHERE r.id = repository_id
    AND public.is_workspace_member(public.workspace_of_project(r.project_id), auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.repositories r WHERE r.id = repository_id
    AND public.is_workspace_member(public.workspace_of_project(r.project_id), auth.uid())));

-- ============================================================
-- REQUIREMENTS / TESTS extra tables
-- ============================================================
CREATE TABLE public.requirement_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  change_note text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requirement_id, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requirement_versions TO authenticated;
GRANT ALL ON public.requirement_versions TO service_role;
ALTER TABLE public.requirement_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "req versions authed" ON public.requirement_versions FOR ALL
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE public.test_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id uuid NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
  name text NOT NULL,
  data_type text NOT NULL DEFAULT 'string',
  default_value text,
  description text,
  required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_parameters TO authenticated;
GRANT ALL ON public.test_parameters TO service_role;
ALTER TABLE public.test_parameters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "test params authed" ON public.test_parameters FOR ALL
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE public.test_data_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  test_case_id uuid REFERENCES public.test_cases(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_data_sets TO authenticated;
GRANT ALL ON public.test_data_sets TO service_role;
ALTER TABLE public.test_data_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "data sets ws-scoped" ON public.test_data_sets FOR ALL
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()))
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));

CREATE TABLE public.test_case_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_case_id uuid NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
  link_type text NOT NULL,
  target_kind text NOT NULL,
  target_id uuid NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_case_links TO authenticated;
GRANT ALL ON public.test_case_links TO service_role;
ALTER TABLE public.test_case_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tc links authed" ON public.test_case_links FOR ALL
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- PLANNING
-- ============================================================
CREATE TABLE public.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  release_id uuid REFERENCES public.releases(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  due_date date,
  status text NOT NULL DEFAULT 'planned',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.milestones TO authenticated;
GRANT ALL ON public.milestones TO service_role;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "milestones ws-scoped" ON public.milestones FOR ALL
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()))
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));

-- ============================================================
-- AUTOMATION
-- ============================================================
CREATE TABLE public.automation_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'spec',
  framework text,
  language text,
  repository_id uuid REFERENCES public.repositories(id) ON DELETE SET NULL,
  path text,
  content text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_assets TO authenticated;
GRANT ALL ON public.automation_assets TO service_role;
ALTER TABLE public.automation_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auto assets ws-scoped" ON public.automation_assets FOR ALL
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()))
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));

CREATE TABLE public.runner_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  labels text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.runner_groups TO authenticated;
GRANT ALL ON public.runner_groups TO service_role;
ALTER TABLE public.runner_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "runner groups ws-scoped" ON public.runner_groups FOR ALL
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

ALTER TABLE public.runners ADD COLUMN IF NOT EXISTS runner_group_id uuid REFERENCES public.runner_groups(id) ON DELETE SET NULL;

CREATE TABLE public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  cron text NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  target_kind text NOT NULL,
  target_id uuid,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedules TO authenticated;
GRANT ALL ON public.schedules TO service_role;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedules ws-scoped" ON public.schedules FOR ALL
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()))
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));

-- ============================================================
-- DEFECTS extras
-- ============================================================
CREATE TABLE public.defect_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  defect_id uuid NOT NULL REFERENCES public.defects(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.defect_comments TO authenticated;
GRANT ALL ON public.defect_comments TO service_role;
ALTER TABLE public.defect_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "defect comments via defect" ON public.defect_comments FOR ALL
  USING (EXISTS (SELECT 1 FROM public.defects d WHERE d.id = defect_id
    AND public.is_workspace_member(public.workspace_of_project(d.project_id), auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.defects d WHERE d.id = defect_id
    AND public.is_workspace_member(public.workspace_of_project(d.project_id), auth.uid())));

CREATE TABLE public.defect_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  defect_id uuid NOT NULL REFERENCES public.defects(id) ON DELETE CASCADE,
  link_type text NOT NULL,
  target_kind text NOT NULL,
  target_id uuid NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.defect_links TO authenticated;
GRANT ALL ON public.defect_links TO service_role;
ALTER TABLE public.defect_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "defect links via defect" ON public.defect_links FOR ALL
  USING (EXISTS (SELECT 1 FROM public.defects d WHERE d.id = defect_id
    AND public.is_workspace_member(public.workspace_of_project(d.project_id), auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.defects d WHERE d.id = defect_id
    AND public.is_workspace_member(public.workspace_of_project(d.project_id), auth.uid())));

CREATE TABLE public.defect_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  defect_id uuid NOT NULL REFERENCES public.defects(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  field_name text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.defect_history TO authenticated;
GRANT ALL ON public.defect_history TO service_role;
ALTER TABLE public.defect_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "defect history via defect" ON public.defect_history FOR ALL
  USING (EXISTS (SELECT 1 FROM public.defects d WHERE d.id = defect_id
    AND public.is_workspace_member(public.workspace_of_project(d.project_id), auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.defects d WHERE d.id = defect_id
    AND public.is_workspace_member(public.workspace_of_project(d.project_id), auth.uid())));

CREATE TABLE public.defect_slas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  severity text NOT NULL,
  response_hours integer,
  resolution_hours integer,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.defect_slas TO authenticated;
GRANT ALL ON public.defect_slas TO service_role;
ALTER TABLE public.defect_slas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "defect slas ws-scoped" ON public.defect_slas FOR ALL
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()))
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));

CREATE TABLE public.root_cause_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  defect_id uuid NOT NULL REFERENCES public.defects(id) ON DELETE CASCADE,
  category text,
  summary text NOT NULL,
  details text,
  preventive_actions text,
  identified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  identified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.root_cause_records TO authenticated;
GRANT ALL ON public.root_cause_records TO service_role;
ALTER TABLE public.root_cause_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rca via defect" ON public.root_cause_records FOR ALL
  USING (EXISTS (SELECT 1 FROM public.defects d WHERE d.id = defect_id
    AND public.is_workspace_member(public.workspace_of_project(d.project_id), auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.defects d WHERE d.id = defect_id
    AND public.is_workspace_member(public.workspace_of_project(d.project_id), auth.uid())));

-- ============================================================
-- GOVERNANCE
-- ============================================================
CREATE TABLE public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  subject_kind text NOT NULL,
  subject_id uuid NOT NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  decision text,
  decided_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approvals TO authenticated;
GRANT ALL ON public.approvals TO service_role;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approvals ws-scoped" ON public.approvals FOR ALL
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()))
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));

CREATE TABLE public.waivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  subject_kind text NOT NULL,
  subject_id uuid NOT NULL,
  reason text NOT NULL,
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waivers TO authenticated;
GRANT ALL ON public.waivers TO service_role;
ALTER TABLE public.waivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "waivers ws-scoped" ON public.waivers FOR ALL
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()))
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));

-- ============================================================
-- INTEGRATIONS
-- ============================================================
CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  description text,
  config_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.integrations TO authenticated;
GRANT ALL ON public.integrations TO service_role;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integrations read all" ON public.integrations FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE TABLE public.integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.integrations(id) ON DELETE SET NULL,
  slug text NOT NULL,
  name text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'connected',
  last_sync_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_connections TO authenticated;
GRANT ALL ON public.integration_connections TO service_role;
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "int conns ws-scoped" ON public.integration_connections FOR ALL
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE TABLE public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.integration_connections(id) ON DELETE SET NULL,
  source text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature text,
  processed_at timestamptz,
  status text NOT NULL DEFAULT 'received',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook events ws read" ON public.webhook_events FOR SELECT
  USING (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()));

CREATE TABLE public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'inbound',
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  records_processed integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sync_logs TO authenticated;
GRANT ALL ON public.sync_logs TO service_role;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync logs ws read" ON public.sync_logs FOR SELECT
  USING (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()));

-- ============================================================
-- AI SUBSYSTEM
-- ============================================================
CREATE TABLE public.ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  model text,
  prompt jsonb,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  cost_usd numeric(10,4),
  tokens_in integer,
  tokens_out integer,
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_jobs TO authenticated;
GRANT ALL ON public.ai_jobs TO service_role;
ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai jobs ws-scoped" ON public.ai_jobs FOR ALL
  USING (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()));

CREATE TABLE public.ai_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_job_id uuid NOT NULL REFERENCES public.ai_jobs(id) ON DELETE CASCADE,
  output_kind text NOT NULL,
  target_kind text,
  target_id uuid,
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_outputs TO authenticated;
GRANT ALL ON public.ai_outputs TO service_role;
ALTER TABLE public.ai_outputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai outputs via job" ON public.ai_outputs FOR ALL
  USING (EXISTS (SELECT 1 FROM public.ai_jobs j WHERE j.id = ai_job_id
    AND (j.workspace_id IS NULL OR public.is_workspace_member(j.workspace_id, auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_jobs j WHERE j.id = ai_job_id
    AND (j.workspace_id IS NULL OR public.is_workspace_member(j.workspace_id, auth.uid()))));

CREATE TABLE public.ai_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_output_id uuid REFERENCES public.ai_outputs(id) ON DELETE CASCADE,
  evaluator text NOT NULL,
  score numeric(5,2),
  verdict text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_evaluations TO authenticated;
GRANT ALL ON public.ai_evaluations TO service_role;
ALTER TABLE public.ai_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai evals authed" ON public.ai_evaluations FOR ALL
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE public.ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_output_id uuid REFERENCES public.ai_outputs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer,
  thumbs text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_feedback TO authenticated;
GRANT ALL ON public.ai_feedback TO service_role;
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai feedback" ON public.ai_feedback FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "read ai feedback" ON public.ai_feedback FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE TABLE public.ai_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  ai_job_id uuid REFERENCES public.ai_jobs(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_audit_events TO authenticated;
GRANT ALL ON public.ai_audit_events TO service_role;
ALTER TABLE public.ai_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai audit ws read" ON public.ai_audit_events FOR SELECT
  USING (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()));

-- ============================================================
-- AUDIT / ACTIVITY
-- ============================================================
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_kind text,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit ws read" ON public.audit_logs FOR SELECT
  USING (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()));

CREATE TABLE public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verb text NOT NULL,
  object_kind text,
  object_id uuid,
  summary text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_events TO authenticated;
GRANT ALL ON public.activity_events TO service_role;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity ws read" ON public.activity_events FOR SELECT
  USING (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "activity ws insert" ON public.activity_events FOR INSERT
  WITH CHECK (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()));

-- ============================================================
-- updated_at triggers (reuse update_updated_at_column)
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'organizations','repositories','repository_branches','pull_requests',
    'test_data_sets','milestones','automation_assets','runner_groups','schedules',
    'defect_comments','defect_slas','root_cause_records','approvals','waivers',
    'integrations','integration_connections','ai_jobs','ai_feedback'
  ]) LOOP
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();', t, t);
  END LOOP;
END $$;
