CREATE OR REPLACE FUNCTION public.sync_cycle_run_from_runner_job()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.cycle_run_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = 'running' AND OLD.status IS DISTINCT FROM 'running' THEN
    UPDATE public.cycle_runs
       SET status = 'in_progress'::run_status, started_at = COALESCE(started_at, now())
     WHERE id = NEW.cycle_run_id AND status IN ('queued','planned');
  ELSIF NEW.status IN ('succeeded','failed','timeout','cancelled')
        AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.cycle_runs
       SET status = (CASE NEW.status
                      WHEN 'succeeded' THEN 'completed'
                      WHEN 'cancelled' THEN 'cancelled'
                      ELSE 'failed' END)::run_status,
           finished_at = now()
     WHERE id = NEW.cycle_run_id AND status NOT IN ('completed','cancelled','failed');
  END IF;
  RETURN NEW;
END $function$;