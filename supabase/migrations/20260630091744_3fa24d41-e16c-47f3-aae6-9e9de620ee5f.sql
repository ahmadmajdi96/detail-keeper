
-- 1. test_plan_documents_v2
CREATE TABLE public.test_plan_documents_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  kind text NOT NULL,
  content text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (test_plan_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_plan_documents_v2 TO authenticated;
GRANT ALL ON public.test_plan_documents_v2 TO service_role;
ALTER TABLE public.test_plan_documents_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tpd2 workspace members"
  ON public.test_plan_documents_v2 FOR ALL TO authenticated
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()))
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));

CREATE TRIGGER tpd2_updated_at BEFORE UPDATE ON public.test_plan_documents_v2
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.test_plan_documents_v2;
ALTER TABLE public.test_plan_documents_v2 REPLICA IDENTITY FULL;

-- 2. test_plan_specs
CREATE TABLE public.test_plan_specs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.test_plan_documents_v2(id) ON DELETE SET NULL,
  filename text NOT NULL,
  content text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT 'typescript',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (test_plan_id, filename)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_plan_specs TO authenticated;
GRANT ALL ON public.test_plan_specs TO service_role;
ALTER TABLE public.test_plan_specs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tps workspace members"
  ON public.test_plan_specs FOR ALL TO authenticated
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()))
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));

CREATE TRIGGER tps_updated_at BEFORE UPDATE ON public.test_plan_specs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.test_plan_specs;
ALTER TABLE public.test_plan_specs REPLICA IDENTITY FULL;

-- 3. spec_runs
CREATE TABLE public.spec_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id uuid NOT NULL REFERENCES public.test_plan_specs(id) ON DELETE CASCADE,
  test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  runner_job_id uuid REFERENCES public.runner_jobs(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued',
  stdout text,
  stderr text,
  result_json jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spec_runs TO authenticated;
GRANT ALL ON public.spec_runs TO service_role;
ALTER TABLE public.spec_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spec_runs workspace members"
  ON public.spec_runs FOR ALL TO authenticated
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()))
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));

CREATE TRIGGER spec_runs_updated_at BEFORE UPDATE ON public.spec_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.spec_runs;
ALTER TABLE public.spec_runs REPLICA IDENTITY FULL;

CREATE INDEX idx_tpd2_plan ON public.test_plan_documents_v2(test_plan_id, sort_order);
CREATE INDEX idx_tps_plan ON public.test_plan_specs(test_plan_id);
CREATE INDEX idx_spec_runs_spec ON public.spec_runs(spec_id, created_at DESC);
