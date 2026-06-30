
CREATE TABLE public.suite_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued',
  browser text NOT NULL DEFAULT 'chromium',
  headless boolean NOT NULL DEFAULT true,
  retries integer NOT NULL DEFAULT 0,
  total_specs integer NOT NULL DEFAULT 0,
  completed_specs integer NOT NULL DEFAULT 0,
  passed_specs integer NOT NULL DEFAULT 0,
  failed_specs integer NOT NULL DEFAULT 0,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suite_runs TO authenticated;
GRANT ALL ON public.suite_runs TO service_role;

ALTER TABLE public.suite_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read suite_runs" ON public.suite_runs FOR SELECT TO authenticated
USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));
CREATE POLICY "members write suite_runs" ON public.suite_runs FOR INSERT TO authenticated
WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));
CREATE POLICY "members update suite_runs" ON public.suite_runs FOR UPDATE TO authenticated
USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));

CREATE TRIGGER trg_suite_runs_updated BEFORE UPDATE ON public.suite_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.suite_runs;
ALTER TABLE public.suite_runs REPLICA IDENTITY FULL;

-- Link spec_runs back to a suite_run, and persist per-spec run config
ALTER TABLE public.spec_runs
  ADD COLUMN IF NOT EXISTS suite_run_id uuid REFERENCES public.suite_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS browser text,
  ADD COLUMN IF NOT EXISTS headless boolean,
  ADD COLUMN IF NOT EXISTS retries integer;

CREATE INDEX IF NOT EXISTS idx_spec_runs_suite ON public.spec_runs(suite_run_id);

-- Roll up spec_run status changes into the parent suite_run counters
CREATE OR REPLACE FUNCTION public.rollup_suite_run_counters()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sid uuid;
BEGIN
  _sid := COALESCE(NEW.suite_run_id, OLD.suite_run_id);
  IF _sid IS NULL THEN RETURN NEW; END IF;
  UPDATE public.suite_runs s SET
    total_specs    = (SELECT count(*) FROM public.spec_runs WHERE suite_run_id = _sid),
    completed_specs= (SELECT count(*) FROM public.spec_runs WHERE suite_run_id = _sid AND status IN ('succeeded','failed','timeout','cancelled')),
    passed_specs   = (SELECT count(*) FROM public.spec_runs WHERE suite_run_id = _sid AND status = 'succeeded'),
    failed_specs   = (SELECT count(*) FROM public.spec_runs WHERE suite_run_id = _sid AND status IN ('failed','timeout')),
    status = CASE
      WHEN (SELECT count(*) FROM public.spec_runs WHERE suite_run_id = _sid AND status NOT IN ('succeeded','failed','timeout','cancelled')) > 0 THEN 'running'
      WHEN (SELECT count(*) FROM public.spec_runs WHERE suite_run_id = _sid AND status IN ('failed','timeout')) > 0 THEN 'failed'
      WHEN (SELECT count(*) FROM public.spec_runs WHERE suite_run_id = _sid) > 0 THEN 'succeeded'
      ELSE s.status END,
    finished_at = CASE
      WHEN (SELECT count(*) FROM public.spec_runs WHERE suite_run_id = _sid AND status NOT IN ('succeeded','failed','timeout','cancelled')) = 0
       AND (SELECT count(*) FROM public.spec_runs WHERE suite_run_id = _sid) > 0
      THEN now() ELSE s.finished_at END,
    updated_at = now()
  WHERE s.id = _sid;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_spec_run_rollup ON public.spec_runs;
CREATE TRIGGER trg_spec_run_rollup
AFTER INSERT OR UPDATE OF status ON public.spec_runs
FOR EACH ROW EXECUTE FUNCTION public.rollup_suite_run_counters();
