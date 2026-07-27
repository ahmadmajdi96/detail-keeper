ALTER TABLE public.test_suites
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.test_cases
  ADD COLUMN IF NOT EXISTS suite_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS proposed_suite_name text,
  ADD COLUMN IF NOT EXISTS suite_assignment_status text NOT NULL DEFAULT 'confirmed';

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS suite_grouping_rules jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_test_suites_sort ON public.test_suites (project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_test_cases_suite_order ON public.test_cases (suite_id, suite_order);
CREATE INDEX IF NOT EXISTS idx_test_cases_assignment_status ON public.test_cases (project_id, suite_assignment_status);

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY project_id ORDER BY name) AS rn
  FROM public.test_suites
)
UPDATE public.test_suites s SET sort_order = r.rn FROM ranked r WHERE r.id = s.id AND s.sort_order = 0;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY suite_id ORDER BY created_at) AS rn
  FROM public.test_cases
)
UPDATE public.test_cases c SET suite_order = r.rn FROM ranked r WHERE r.id = c.id AND c.suite_order = 0;