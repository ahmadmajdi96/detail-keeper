
ALTER TABLE public.test_plan_specs
  ADD COLUMN IF NOT EXISTS test_case_id uuid REFERENCES public.test_cases(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_test_plan_specs_test_case ON public.test_plan_specs(test_case_id);

ALTER TABLE public.spec_runs
  ADD COLUMN IF NOT EXISTS artifacts_json jsonb;
