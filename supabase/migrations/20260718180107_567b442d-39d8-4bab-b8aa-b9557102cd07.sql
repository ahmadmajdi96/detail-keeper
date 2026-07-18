ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS repo_job_id text,
  ADD COLUMN IF NOT EXISTS repo_job_status text,
  ADD COLUMN IF NOT EXISTS repo_job_progress int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repo_job_meta jsonb;