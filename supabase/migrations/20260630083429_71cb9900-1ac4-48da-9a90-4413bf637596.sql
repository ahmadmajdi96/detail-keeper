
-- =========================================================
-- Runners
-- =========================================================
CREATE TABLE IF NOT EXISTS public.runners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  environment_id uuid REFERENCES public.environments(id) ON DELETE SET NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'webhook',           -- webhook | github_actions | gitlab_ci | docker | local
  status text NOT NULL DEFAULT 'idle',            -- idle | busy | offline | disabled
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb, -- {browsers:[], os:[], tags:[]}
  config jsonb NOT NULL DEFAULT '{}'::jsonb,       -- webhook_url, dispatch_ref, etc.
  token_hash text,                                 -- sha256 of registration token (for runner -> us calls)
  last_seen_at timestamptz,
  current_job_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runners_project ON public.runners(project_id);
CREATE INDEX IF NOT EXISTS idx_runners_workspace ON public.runners(workspace_id);
CREATE INDEX IF NOT EXISTS idx_runners_env ON public.runners(environment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.runners TO authenticated;
GRANT ALL ON public.runners TO service_role;

ALTER TABLE public.runners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "runners_workspace_members_all"
  ON public.runners FOR ALL
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE TRIGGER trg_runners_updated
  BEFORE UPDATE ON public.runners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Runner Jobs (executor attempts)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.runner_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  runner_id uuid REFERENCES public.runners(id) ON DELETE SET NULL,
  cycle_run_id uuid REFERENCES public.cycle_runs(id) ON DELETE CASCADE,
  cycle_id uuid REFERENCES public.test_cycles(id) ON DELETE SET NULL,
  suite_id uuid REFERENCES public.test_suites(id) ON DELETE SET NULL,
  environment_id uuid REFERENCES public.environments(id) ON DELETE SET NULL,
  release_id uuid REFERENCES public.releases(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued',  -- queued | dispatched | running | succeeded | failed | cancelled | timeout
  attempt int NOT NULL DEFAULT 1,
  max_attempts int NOT NULL DEFAULT 1,
  priority int NOT NULL DEFAULT 100,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error jsonb,
  logs_url text,
  progress int NOT NULL DEFAULT 0,
  queued_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runner_jobs_project ON public.runner_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_runner_jobs_runner ON public.runner_jobs(runner_id);
CREATE INDEX IF NOT EXISTS idx_runner_jobs_cycle_run ON public.runner_jobs(cycle_run_id);
CREATE INDEX IF NOT EXISTS idx_runner_jobs_status ON public.runner_jobs(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.runner_jobs TO authenticated;
GRANT ALL ON public.runner_jobs TO service_role;

ALTER TABLE public.runner_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "runner_jobs_workspace_members_all"
  ON public.runner_jobs FOR ALL
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));

CREATE TRIGGER trg_runner_jobs_updated
  BEFORE UPDATE ON public.runner_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.runners;
ALTER PUBLICATION supabase_realtime ADD TABLE public.runner_jobs;

-- =========================================================
-- Atomic claim function (worker side) — same SKIP LOCKED pattern
-- =========================================================
CREATE OR REPLACE FUNCTION public.claim_runner_jobs(_runner uuid, _limit int DEFAULT 1)
RETURNS SETOF public.runner_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT id FROM public.runner_jobs
    WHERE status = 'queued'
      AND (
        runner_id = _runner
        OR runner_id IS NULL  -- pickup unassigned
      )
    ORDER BY priority ASC, queued_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT _limit
  )
  UPDATE public.runner_jobs j
    SET status = 'dispatched',
        runner_id = _runner,
        dispatched_at = now(),
        attempt = j.attempt,
        updated_at = now()
  FROM cte WHERE j.id = cte.id
  RETURNING j.*;
END $$;

-- =========================================================
-- Notify on runner job terminal state
-- =========================================================
CREATE OR REPLACE FUNCTION public.notify_runner_job_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _ws uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('succeeded','failed','timeout','cancelled') THEN
    SELECT workspace_id INTO _ws FROM public.projects WHERE id = NEW.project_id;
    IF _ws IS NOT NULL THEN
      PERFORM public.notify_workspace_managers(
        _ws,
        'runner_job_' || NEW.status,
        'Runner job ' || NEW.status,
        COALESCE('Cycle run ' || NEW.cycle_run_id::text, 'A runner job') || ' finished',
        jsonb_build_object('runner_job_id', NEW.id, 'cycle_run_id', NEW.cycle_run_id, 'status', NEW.status),
        NEW.created_by);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_runner_job_status ON public.runner_jobs;
CREATE TRIGGER trg_runner_job_status
  AFTER UPDATE ON public.runner_jobs
  FOR EACH ROW EXECUTE FUNCTION public.notify_runner_job_status();

-- Mirror runner_job status into the parent cycle_run when it terminates
CREATE OR REPLACE FUNCTION public.sync_cycle_run_from_runner_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cycle_run_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = 'running' AND OLD.status IS DISTINCT FROM 'running' THEN
    UPDATE public.cycle_runs
       SET status = 'in_progress', started_at = COALESCE(started_at, now())
     WHERE id = NEW.cycle_run_id AND status IN ('queued','not_started','planned');
  ELSIF NEW.status IN ('succeeded','failed','timeout','cancelled')
        AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.cycle_runs
       SET status = CASE NEW.status
                      WHEN 'succeeded' THEN 'completed'
                      WHEN 'cancelled' THEN 'cancelled'
                      ELSE 'failed' END,
           finished_at = now()
     WHERE id = NEW.cycle_run_id AND status NOT IN ('completed','cancelled','failed');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_cycle_run_from_runner ON public.runner_jobs;
CREATE TRIGGER trg_sync_cycle_run_from_runner
  AFTER UPDATE ON public.runner_jobs
  FOR EACH ROW EXECUTE FUNCTION public.sync_cycle_run_from_runner_job();
