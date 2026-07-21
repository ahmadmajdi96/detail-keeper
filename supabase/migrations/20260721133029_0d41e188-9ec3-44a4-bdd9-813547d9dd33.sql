
ALTER TABLE public.test_plans
  ADD COLUMN IF NOT EXISTS codegen_status text,
  ADD COLUMN IF NOT EXISTS codegen_job_ref text,
  ADD COLUMN IF NOT EXISTS codegen_progress integer,
  ADD COLUMN IF NOT EXISTS codegen_progress_message text,
  ADD COLUMN IF NOT EXISTS codegen_progress_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS codegen_last_run_at timestamptz;
