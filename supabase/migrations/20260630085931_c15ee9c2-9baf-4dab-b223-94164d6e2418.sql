ALTER TYPE public.run_status ADD VALUE IF NOT EXISTS 'queued';
ALTER TYPE public.run_status ADD VALUE IF NOT EXISTS 'failed';