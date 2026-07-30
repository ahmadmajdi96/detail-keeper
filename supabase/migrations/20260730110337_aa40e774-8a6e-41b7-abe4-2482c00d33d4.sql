ALTER TABLE public.plan_test_runs
  ADD COLUMN IF NOT EXISTS live_view_url text,
  ADD COLUMN IF NOT EXISTS live_view_status text,
  ADD COLUMN IF NOT EXISTS execution_phase text,
  ADD COLUMN IF NOT EXISTS log_tail text,
  ADD COLUMN IF NOT EXISTS download_url text;