ALTER TABLE public.test_plans
  ADD COLUMN IF NOT EXISTS coverage_summary jsonb,
  ADD COLUMN IF NOT EXISTS test_type_coverage jsonb,
  ADD COLUMN IF NOT EXISTS coverage_source jsonb;