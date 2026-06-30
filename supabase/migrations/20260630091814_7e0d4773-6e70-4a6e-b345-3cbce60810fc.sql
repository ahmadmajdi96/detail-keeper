
CREATE OR REPLACE FUNCTION public.sync_spec_run_from_runner_job()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.spec_runs
     SET status = NEW.status,
         started_at = COALESCE(started_at, CASE WHEN NEW.status = 'running' THEN now() END),
         finished_at = CASE WHEN NEW.status IN ('succeeded','failed','timeout','cancelled') THEN now() ELSE finished_at END,
         result_json = COALESCE((NEW.result)::jsonb, result_json),
         stdout = COALESCE(NEW.result->>'stdout', stdout),
         stderr = COALESCE(NEW.result->>'stderr', stderr),
         updated_at = now()
   WHERE runner_job_id = NEW.id;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_spec_run ON public.runner_jobs;
CREATE TRIGGER trg_sync_spec_run
  AFTER UPDATE ON public.runner_jobs
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status OR NEW.result IS DISTINCT FROM OLD.result)
  EXECUTE FUNCTION public.sync_spec_run_from_runner_job();
