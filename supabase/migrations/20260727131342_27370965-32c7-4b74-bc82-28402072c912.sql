CREATE OR REPLACE FUNCTION public.gen_test_plan_uid()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT 'TP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
$$;

ALTER TABLE public.test_plans
  ADD COLUMN IF NOT EXISTS plan_uid text;

UPDATE public.test_plans
   SET plan_uid = public.gen_test_plan_uid()
 WHERE plan_uid IS NULL;

ALTER TABLE public.test_plans
  ALTER COLUMN plan_uid SET DEFAULT public.gen_test_plan_uid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_test_plans_plan_uid ON public.test_plans(plan_uid);