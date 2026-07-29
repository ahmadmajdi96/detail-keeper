ALTER TABLE public.test_plans
  ADD COLUMN IF NOT EXISTS docs_status text,
  ADD COLUMN IF NOT EXISTS docs_job_ref text,
  ADD COLUMN IF NOT EXISTS docs_source_job_ref text,
  ADD COLUMN IF NOT EXISTS docs_progress integer,
  ADD COLUMN IF NOT EXISTS docs_progress_message text,
  ADD COLUMN IF NOT EXISTS docs_progress_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS docs_last_run_at timestamptz;