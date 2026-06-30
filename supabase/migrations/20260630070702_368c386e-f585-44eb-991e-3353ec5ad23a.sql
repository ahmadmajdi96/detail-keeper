
CREATE OR REPLACE FUNCTION public.claim_jobs(_worker text, _limit int DEFAULT 5, _visibility_sec int DEFAULT 300)
RETURNS SETOF public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT id FROM public.jobs
    WHERE status IN ('queued','retrying')
      AND run_after <= now()
      AND (locked_at IS NULL OR locked_at < now() - make_interval(secs => _visibility_sec))
    ORDER BY priority ASC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT _limit
  )
  UPDATE public.jobs j
    SET status = 'running',
        locked_at = now(),
        locked_by = _worker,
        attempt_count = j.attempt_count + 1,
        updated_at = now()
  FROM cte
  WHERE j.id = cte.id
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_jobs(text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_jobs(text, int, int) TO service_role;
