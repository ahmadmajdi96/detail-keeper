ALTER TABLE public.test_cases
  ADD COLUMN IF NOT EXISTS test_type text,
  ADD COLUMN IF NOT EXISTS priority_score integer;

ALTER TABLE public.test_plans
  ADD COLUMN IF NOT EXISTS ai_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_test_cases_test_type ON public.test_cases(test_type);