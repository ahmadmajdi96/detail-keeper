GRANT SELECT, INSERT, UPDATE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_jobs TO authenticated;
GRANT ALL ON public.ai_jobs TO service_role;

GRANT SELECT ON public.job_attempts TO authenticated;
GRANT ALL ON public.job_attempts TO service_role;

GRANT SELECT ON public.job_artifacts TO authenticated;
GRANT ALL ON public.job_artifacts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_plans TO authenticated;
GRANT ALL ON public.test_plans TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_plan_documents_v2 TO authenticated;
GRANT ALL ON public.test_plan_documents_v2 TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_plan_test_cases TO authenticated;
GRANT ALL ON public.test_plan_test_cases TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_plan_specs TO authenticated;
GRANT ALL ON public.test_plan_specs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.spec_runs TO authenticated;
GRANT ALL ON public.spec_runs TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_cases TO authenticated;
GRANT ALL ON public.test_cases TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_case_steps TO authenticated;
GRANT ALL ON public.test_case_steps TO service_role;