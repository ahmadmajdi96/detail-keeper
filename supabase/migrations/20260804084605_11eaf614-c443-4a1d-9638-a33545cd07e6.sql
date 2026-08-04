-- ============ Manual execution ============
CREATE TABLE IF NOT EXISTS public.manual_execution_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  workspace_id uuid,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  environment text,
  base_url text,
  build_version text,
  browser text,
  device text,
  tags text[] NOT NULL DEFAULT '{}',
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  tester_id uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_execution_sessions TO authenticated;
GRANT ALL ON public.manual_execution_sessions TO service_role;
ALTER TABLE public.manual_execution_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members manage manual sessions"
  ON public.manual_execution_sessions FOR ALL TO authenticated
  USING (public.can_access_project(project_id))
  WITH CHECK (public.can_access_project(project_id));
CREATE TRIGGER trg_mes_updated BEFORE UPDATE ON public.manual_execution_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_mes_plan ON public.manual_execution_sessions(test_plan_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.manual_execution_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.manual_execution_sessions(id) ON DELETE CASCADE,
  test_case_id uuid NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
  suite_id uuid,
  project_id uuid NOT NULL,
  status public.execution_status NOT NULL DEFAULT 'pending',
  sort_order integer NOT NULL DEFAULT 0,
  actual_result text,
  notes text,
  step_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  defect_id uuid REFERENCES public.defects(id) ON DELETE SET NULL,
  duration_seconds integer,
  executed_by uuid,
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, test_case_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_execution_items TO authenticated;
GRANT ALL ON public.manual_execution_items TO service_role;
ALTER TABLE public.manual_execution_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members manage manual items"
  ON public.manual_execution_items FOR ALL TO authenticated
  USING (public.can_access_project(project_id))
  WITH CHECK (public.can_access_project(project_id));
CREATE TRIGGER trg_mei_updated BEFORE UPDATE ON public.manual_execution_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_mei_session ON public.manual_execution_items(session_id, sort_order);

-- evidence linkage for manual runs
ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS manual_session_id uuid REFERENCES public.manual_execution_sessions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS manual_item_id uuid REFERENCES public.manual_execution_items(id) ON DELETE CASCADE;

-- ============ AI Locator Intelligence ============
CREATE TABLE IF NOT EXISTS public.locator_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE,
  project_id uuid NOT NULL,
  suite_id uuid,
  base_url text,
  status text NOT NULL DEFAULT 'running',
  verdict text,
  health_score integer,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  applied_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locator_analyses TO authenticated;
GRANT ALL ON public.locator_analyses TO service_role;
ALTER TABLE public.locator_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members manage locator analyses"
  ON public.locator_analyses FOR ALL TO authenticated
  USING (public.can_access_project(project_id))
  WITH CHECK (public.can_access_project(project_id));
CREATE TRIGGER trg_la_updated BEFORE UPDATE ON public.locator_analyses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_la_plan ON public.locator_analyses(test_plan_id, created_at DESC);

-- ============ Automated run settings + AI failure analysis ============
ALTER TABLE public.plan_test_runs
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS environment text,
  ADD COLUMN IF NOT EXISTS browser text,
  ADD COLUMN IF NOT EXISTS device text,
  ADD COLUMN IF NOT EXISTS build_version text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_analysis jsonb,
  ADD COLUMN IF NOT EXISTS ai_analysis_status text,
  ADD COLUMN IF NOT EXISTS locator_analysis_id uuid REFERENCES public.locator_analyses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS skipped_tests integer NOT NULL DEFAULT 0;
