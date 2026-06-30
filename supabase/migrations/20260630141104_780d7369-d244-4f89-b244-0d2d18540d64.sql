
-- 1. Extend integration_connections
ALTER TABLE public.integration_connections
  ADD COLUMN IF NOT EXISTS sync_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz;

-- 2. Jira project mappings
CREATE TABLE IF NOT EXISTS public.jira_project_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  jira_cloud_id text NOT NULL,
  jira_site_url text,
  jira_project_key text NOT NULL,
  auto_link_rule jsonb NOT NULL DEFAULT '{"match":"summary","labels":[]}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, jira_project_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jira_project_mappings TO authenticated;
GRANT ALL ON public.jira_project_mappings TO service_role;
ALTER TABLE public.jira_project_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage jira mappings"
  ON public.jira_project_mappings FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE TRIGGER jira_project_mappings_updated_at
  BEFORE UPDATE ON public.jira_project_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. GitHub repo mappings
CREATE TABLE IF NOT EXISTS public.github_repo_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner text NOT NULL,
  repo text NOT NULL,
  default_branch text NOT NULL DEFAULT 'main',
  test_plan_id uuid REFERENCES public.test_plans(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, owner, repo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.github_repo_mappings TO authenticated;
GRANT ALL ON public.github_repo_mappings TO service_role;
ALTER TABLE public.github_repo_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage gh mappings"
  ON public.github_repo_mappings FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE TRIGGER github_repo_mappings_updated_at
  BEFORE UPDATE ON public.github_repo_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Integration activity log
CREATE TABLE IF NOT EXISTS public.integration_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL,
  kind text NOT NULL,            -- oauth_connect | oauth_callback | sync | disconnect | reconnect
  status text NOT NULL,          -- ok | error
  message text,
  counts jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.integration_activity_log TO authenticated;
GRANT ALL ON public.integration_activity_log TO service_role;
ALTER TABLE public.integration_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read activity log"
  ON public.integration_activity_log FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_int_activity_ws_time
  ON public.integration_activity_log (workspace_id, occurred_at DESC);

-- 5. Defects Jira link
ALTER TABLE public.defects
  ADD COLUMN IF NOT EXISTS jira_issue_key text,
  ADD COLUMN IF NOT EXISTS jira_issue_url text;
CREATE INDEX IF NOT EXISTS idx_defects_jira_issue_key
  ON public.defects (jira_issue_key) WHERE jira_issue_key IS NOT NULL;

-- 6. Builds GH workflow
ALTER TABLE public.builds
  ADD COLUMN IF NOT EXISTS gh_run_id bigint,
  ADD COLUMN IF NOT EXISTS gh_workflow text,
  ADD COLUMN IF NOT EXISTS gh_html_url text,
  ADD COLUMN IF NOT EXISTS test_plan_id uuid REFERENCES public.test_plans(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_builds_gh_run_unique
  ON public.builds (project_id, gh_run_id) WHERE gh_run_id IS NOT NULL;

-- 7. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.integration_connections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.integration_activity_log;
