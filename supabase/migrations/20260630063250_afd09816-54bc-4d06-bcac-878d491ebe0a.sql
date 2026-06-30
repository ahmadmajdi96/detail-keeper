
-- =========================================================
-- Sprint A: Releases, Environments, Builds, Suites, Cycles
-- =========================================================

-- ---------- enums ----------
DO $$ BEGIN
  CREATE TYPE public.release_status AS ENUM ('planned','in_progress','released','blocked','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.environment_type AS ENUM ('local','dev','qa','uat','staging','production','sandbox','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.build_status AS ENUM ('pending','building','success','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.deployment_status AS ENUM ('pending','deploying','deployed','failed','rolled_back');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cycle_status AS ENUM ('planned','in_progress','paused','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.run_status AS ENUM ('planned','in_progress','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.run_item_status AS ENUM ('not_run','in_progress','passed','failed','blocked','skipped','not_applicable');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- helper: workspace from project ----------
CREATE OR REPLACE FUNCTION public.workspace_of_project(_project uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT workspace_id FROM public.projects WHERE id = _project
$$;

-- ---------- updated_at trigger (reuse if not present) ----------
-- update_updated_at_column() already exists per project context.

-- =========================================================
-- releases
-- =========================================================
CREATE TABLE public.releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  version text,
  description text,
  status public.release_status NOT NULL DEFAULT 'planned',
  target_date date,
  released_at timestamptz,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_releases_project ON public.releases(project_id);
CREATE INDEX idx_releases_status ON public.releases(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.releases TO authenticated;
GRANT ALL ON public.releases TO service_role;
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members manage releases" ON public.releases
  FOR ALL TO authenticated
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()))
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));
CREATE TRIGGER trg_releases_updated_at BEFORE UPDATE ON public.releases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- environments
-- =========================================================
CREATE TABLE public.environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  type public.environment_type NOT NULL DEFAULT 'qa',
  base_url text,
  description text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);
CREATE INDEX idx_environments_project ON public.environments(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.environments TO authenticated;
GRANT ALL ON public.environments TO service_role;
ALTER TABLE public.environments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members manage environments" ON public.environments
  FOR ALL TO authenticated
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()))
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));
CREATE TRIGGER trg_environments_updated_at BEFORE UPDATE ON public.environments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- builds
-- =========================================================
CREATE TABLE public.builds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  release_id uuid REFERENCES public.releases(id) ON DELETE SET NULL,
  name text,
  branch text,
  commit_sha text,
  commit_message text,
  artifact_url text,
  ci_run_url text,
  ci_provider text,
  status public.build_status NOT NULL DEFAULT 'pending',
  built_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_builds_project ON public.builds(project_id);
CREATE INDEX idx_builds_release ON public.builds(release_id);
CREATE INDEX idx_builds_commit ON public.builds(commit_sha);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.builds TO authenticated;
GRANT ALL ON public.builds TO service_role;
ALTER TABLE public.builds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members manage builds" ON public.builds
  FOR ALL TO authenticated
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()))
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));
CREATE TRIGGER trg_builds_updated_at BEFORE UPDATE ON public.builds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- deployments
-- =========================================================
CREATE TABLE public.deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  build_id uuid NOT NULL REFERENCES public.builds(id) ON DELETE CASCADE,
  environment_id uuid NOT NULL REFERENCES public.environments(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status public.deployment_status NOT NULL DEFAULT 'pending',
  deployed_at timestamptz,
  deployed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  url text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_deployments_build ON public.deployments(build_id);
CREATE INDEX idx_deployments_env ON public.deployments(environment_id);
CREATE INDEX idx_deployments_project ON public.deployments(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deployments TO authenticated;
GRANT ALL ON public.deployments TO service_role;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members manage deployments" ON public.deployments
  FOR ALL TO authenticated
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()))
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));
CREATE TRIGGER trg_deployments_updated_at BEFORE UPDATE ON public.deployments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- test_suites + suite_test_cases
-- =========================================================
CREATE TABLE public.test_suites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.test_suites(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  tags text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_test_suites_project ON public.test_suites(project_id);
CREATE INDEX idx_test_suites_parent ON public.test_suites(parent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_suites TO authenticated;
GRANT ALL ON public.test_suites TO service_role;
ALTER TABLE public.test_suites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members manage test_suites" ON public.test_suites
  FOR ALL TO authenticated
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()))
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));
CREATE TRIGGER trg_test_suites_updated_at BEFORE UPDATE ON public.test_suites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.suite_test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suite_id uuid NOT NULL REFERENCES public.test_suites(id) ON DELETE CASCADE,
  test_case_id uuid NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  position integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (suite_id, test_case_id)
);
CREATE INDEX idx_suite_test_cases_suite ON public.suite_test_cases(suite_id);
CREATE INDEX idx_suite_test_cases_case ON public.suite_test_cases(test_case_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suite_test_cases TO authenticated;
GRANT ALL ON public.suite_test_cases TO service_role;
ALTER TABLE public.suite_test_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members manage suite_test_cases" ON public.suite_test_cases
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.test_suites s
                 WHERE s.id = suite_id
                 AND public.is_workspace_member(public.workspace_of_project(s.project_id), auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.test_suites s
                 WHERE s.id = suite_id
                 AND public.is_workspace_member(public.workspace_of_project(s.project_id), auth.uid())));

-- =========================================================
-- test_cycles
-- =========================================================
CREATE TABLE public.test_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  release_id uuid REFERENCES public.releases(id) ON DELETE SET NULL,
  environment_id uuid REFERENCES public.environments(id) ON DELETE SET NULL,
  build_id uuid REFERENCES public.builds(id) ON DELETE SET NULL,
  suite_id uuid REFERENCES public.test_suites(id) ON DELETE SET NULL,
  test_plan_id uuid REFERENCES public.test_plans(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  status public.cycle_status NOT NULL DEFAULT 'planned',
  start_at timestamptz,
  end_at timestamptz,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_test_cycles_project ON public.test_cycles(project_id);
CREATE INDEX idx_test_cycles_release ON public.test_cycles(release_id);
CREATE INDEX idx_test_cycles_env ON public.test_cycles(environment_id);
CREATE INDEX idx_test_cycles_status ON public.test_cycles(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_cycles TO authenticated;
GRANT ALL ON public.test_cycles TO service_role;
ALTER TABLE public.test_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members manage test_cycles" ON public.test_cycles
  FOR ALL TO authenticated
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()))
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));
CREATE TRIGGER trg_test_cycles_updated_at BEFORE UPDATE ON public.test_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- cycle_runs
-- =========================================================
CREATE TABLE public.cycle_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.test_cycles(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text,
  executor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.run_status NOT NULL DEFAULT 'planned',
  started_at timestamptz,
  finished_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cycle_runs_cycle ON public.cycle_runs(cycle_id);
CREATE INDEX idx_cycle_runs_project ON public.cycle_runs(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cycle_runs TO authenticated;
GRANT ALL ON public.cycle_runs TO service_role;
ALTER TABLE public.cycle_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members manage cycle_runs" ON public.cycle_runs
  FOR ALL TO authenticated
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()))
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));
CREATE TRIGGER trg_cycle_runs_updated_at BEFORE UPDATE ON public.cycle_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- cycle_run_items
-- =========================================================
CREATE TABLE public.cycle_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.cycle_runs(id) ON DELETE CASCADE,
  cycle_id uuid NOT NULL REFERENCES public.test_cycles(id) ON DELETE CASCADE,
  test_case_id uuid NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
  test_case_version integer,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.run_item_status NOT NULL DEFAULT 'not_run',
  attempt_count integer NOT NULL DEFAULT 0,
  duration_ms integer,
  last_executed_at timestamptz,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, test_case_id)
);
CREATE INDEX idx_cycle_run_items_run ON public.cycle_run_items(run_id);
CREATE INDEX idx_cycle_run_items_cycle ON public.cycle_run_items(cycle_id);
CREATE INDEX idx_cycle_run_items_case ON public.cycle_run_items(test_case_id);
CREATE INDEX idx_cycle_run_items_status ON public.cycle_run_items(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cycle_run_items TO authenticated;
GRANT ALL ON public.cycle_run_items TO service_role;
ALTER TABLE public.cycle_run_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members manage cycle_run_items" ON public.cycle_run_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cycle_runs r
                 WHERE r.id = run_id
                 AND public.is_workspace_member(public.workspace_of_project(r.project_id), auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cycle_runs r
                 WHERE r.id = run_id
                 AND public.is_workspace_member(public.workspace_of_project(r.project_id), auth.uid())));
CREATE TRIGGER trg_cycle_run_items_updated_at BEFORE UPDATE ON public.cycle_run_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- cycle_attempts
-- =========================================================
CREATE TABLE public.cycle_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_item_id uuid NOT NULL REFERENCES public.cycle_run_items(id) ON DELETE CASCADE,
  attempt_no integer NOT NULL,
  status public.run_item_status NOT NULL DEFAULT 'not_run',
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer,
  executor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  logs_ref text,
  error_signature text,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_item_id, attempt_no)
);
CREATE INDEX idx_cycle_attempts_item ON public.cycle_attempts(run_item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cycle_attempts TO authenticated;
GRANT ALL ON public.cycle_attempts TO service_role;
ALTER TABLE public.cycle_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members manage cycle_attempts" ON public.cycle_attempts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cycle_run_items i
                 JOIN public.cycle_runs r ON r.id = i.run_id
                 WHERE i.id = run_item_id
                 AND public.is_workspace_member(public.workspace_of_project(r.project_id), auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cycle_run_items i
                 JOIN public.cycle_runs r ON r.id = i.run_id
                 WHERE i.id = run_item_id
                 AND public.is_workspace_member(public.workspace_of_project(r.project_id), auth.uid())));

-- =========================================================
-- Realtime
-- =========================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.test_cycles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cycle_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cycle_run_items;

-- =========================================================
-- Backfill: one Release/Env/Suite/Cycle per project that has an active test plan
-- =========================================================
DO $$
DECLARE
  p RECORD;
  v_release_id uuid;
  v_env_id uuid;
  v_suite_id uuid;
  v_cycle_id uuid;
  v_plan RECORD;
BEGIN
  FOR p IN SELECT DISTINCT project_id FROM public.test_plans WHERE status = 'active' AND project_id IS NOT NULL
  LOOP
    -- Pick the first active plan for this project
    SELECT * INTO v_plan FROM public.test_plans
      WHERE project_id = p.project_id AND status = 'active'
      ORDER BY created_at ASC LIMIT 1;

    INSERT INTO public.releases (project_id, name, version, status, created_by)
      VALUES (p.project_id, 'Initial', 'v0.1.0', 'in_progress', v_plan.created_by)
      RETURNING id INTO v_release_id;

    INSERT INTO public.environments (project_id, name, type, created_by)
      VALUES (p.project_id, 'Default', 'qa', v_plan.created_by)
      ON CONFLICT (project_id, name) DO UPDATE SET updated_at = now()
      RETURNING id INTO v_env_id;

    INSERT INTO public.test_suites (project_id, name, description, created_by)
      VALUES (p.project_id, 'Default Suite', 'Auto-created from initial active test plan', v_plan.created_by)
      RETURNING id INTO v_suite_id;

    -- Link the plan's cases into the suite
    INSERT INTO public.suite_test_cases (suite_id, test_case_id, added_by)
      SELECT v_suite_id, ptc.test_case_id, v_plan.created_by
      FROM public.test_plan_test_cases ptc
      WHERE ptc.test_plan_id = v_plan.id
      ON CONFLICT DO NOTHING;

    INSERT INTO public.test_cycles
      (project_id, release_id, environment_id, suite_id, test_plan_id, name, status, start_at, owner_id, created_by)
      VALUES (p.project_id, v_release_id, v_env_id, v_suite_id, v_plan.id,
              'Initial Cycle', 'in_progress', now(), v_plan.created_by, v_plan.created_by)
      RETURNING id INTO v_cycle_id;
  END LOOP;
END $$;
