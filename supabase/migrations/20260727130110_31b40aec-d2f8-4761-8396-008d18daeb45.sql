ALTER TABLE public.test_cases
  ADD COLUMN IF NOT EXISTS suite_id uuid REFERENCES public.test_suites(id) ON DELETE SET NULL;

ALTER TABLE public.test_executions
  ADD COLUMN IF NOT EXISTS suite_id uuid REFERENCES public.test_suites(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_test_cases_suite_id ON public.test_cases(suite_id);
CREATE INDEX IF NOT EXISTS idx_test_executions_suite_id ON public.test_executions(suite_id);
CREATE INDEX IF NOT EXISTS idx_test_suites_project_id ON public.test_suites(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_suites TO authenticated;
GRANT ALL ON public.test_suites TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suite_test_cases TO authenticated;
GRANT ALL ON public.suite_test_cases TO service_role;

DROP TRIGGER IF EXISTS trg_test_suites_updated_at ON public.test_suites;
CREATE TRIGGER trg_test_suites_updated_at
BEFORE UPDATE ON public.test_suites
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();