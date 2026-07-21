CREATE TABLE public.plan_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  codegen_job_ref text,
  forge_run_id text,
  base_url text,
  status text NOT NULL DEFAULT 'queued',
  progress_message text,
  total_tests integer NOT NULL DEFAULT 0,
  passed_tests integer NOT NULL DEFAULT 0,
  failed_tests integer NOT NULL DEFAULT 0,
  running_tests integer NOT NULL DEFAULT 0,
  exit_code integer,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  artifacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  result jsonb,
  last_polled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX plan_test_runs_plan_idx ON public.plan_test_runs (test_plan_id, created_at DESC);
CREATE INDEX plan_test_runs_workspace_idx ON public.plan_test_runs (workspace_id, created_at DESC);
CREATE INDEX plan_test_runs_forge_idx ON public.plan_test_runs (forge_run_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_test_runs TO authenticated;
GRANT ALL ON public.plan_test_runs TO service_role;

ALTER TABLE public.plan_test_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members view plan test runs"
  ON public.plan_test_runs FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members insert plan test runs"
  ON public.plan_test_runs FOR INSERT TO authenticated
  WITH CHECK (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members update plan test runs"
  ON public.plan_test_runs FOR UPDATE TO authenticated
  USING (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace admins delete plan test runs"
  ON public.plan_test_runs FOR DELETE TO authenticated
  USING (
    workspace_id IS NULL
    OR public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin')
  );

CREATE TRIGGER plan_test_runs_updated_at
  BEFORE UPDATE ON public.plan_test_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_test_runs;