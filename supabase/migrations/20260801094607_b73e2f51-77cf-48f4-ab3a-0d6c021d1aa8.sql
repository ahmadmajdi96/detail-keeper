ALTER TABLE public.test_plans ADD COLUMN IF NOT EXISTS codegen_suite_id uuid REFERENCES public.test_suites(id) ON DELETE SET NULL;
ALTER TABLE public.plan_test_runs ADD COLUMN IF NOT EXISTS suite_id uuid REFERENCES public.test_suites(id) ON DELETE SET NULL;
ALTER TABLE public.plan_test_runs ADD COLUMN IF NOT EXISTS test_case_progress jsonb NOT NULL DEFAULT '{}'::jsonb;