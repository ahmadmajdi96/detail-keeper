
-- ============================================================
-- 1) Fix functions missing search_path
-- ============================================================
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;

-- ============================================================
-- 2) Revoke SELECT from anon on all public tables
--    (fixes pg_graphql anon exposure; no public-facing tables in this app)
-- ============================================================
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;

-- ============================================================
-- 3) Revoke EXECUTE from anon on all public functions
-- ============================================================
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon, PUBLIC;

-- ============================================================
-- 4) Revoke EXECUTE from authenticated on internal-only
--    SECURITY DEFINER functions (triggers, cron, edge-function helpers).
--    Keep EXECUTE for helpers referenced by RLS policies / client RPCs.
-- ============================================================
DO $$
DECLARE
  fn text;
  internal text[] := ARRAY[
    'accept_pending_invitations()',
    'add_org_owner_as_member()',
    'add_project_creator_as_lead()',
    'add_workspace_owner_as_member()',
    'claim_jobs(text,integer,integer)',
    'claim_runner_jobs(uuid,integer)',
    'create_free_subscription_for_org()',
    'defect_status_timestamps()',
    'delete_email(text,bigint)',
    'email_queue_dispatch()',
    'email_queue_wake()',
    'emit_defect_assigned()',
    'emit_defect_created()',
    'emit_gate_blocked()',
    'emit_notification_dispatch()',
    'emit_release_verdict()',
    'emit_run_finished()',
    'emit_testplan_generated()',
    'emit_webhook(uuid,uuid,text,jsonb)',
    'enqueue_cycle_run_evaluations()',
    'enqueue_email(text,jsonb)',
    'handle_new_user()',
    'log_audit(uuid,uuid,text,text,uuid,jsonb)',
    'move_to_dlq(text,text,bigint,jsonb)',
    'notify_build_status()',
    'notify_cycle_run_status()',
    'notify_defect_assignment()',
    'notify_defect_comment_mentions()',
    'notify_defect_created()',
    'notify_defect_status_change()',
    'notify_document_ready()',
    'notify_execution_completion()',
    'notify_project_created()',
    'notify_project_status()',
    'notify_runner_job_status()',
    'notify_test_plan_assignee()',
    'notify_test_plan_created()',
    'notify_workspace_created()',
    'notify_workspace_managers(uuid,text,text,text,jsonb,uuid)',
    'notify_workspace_member_added()',
    'read_email_batch(text,integer,integer)',
    'recount_workspace_counters()',
    'rollup_suite_run_counters()',
    'sync_cycle_run_from_runner_job()',
    'sync_spec_run_from_runner_job()',
    'trg_audit_invitations()',
    'trg_audit_org_members()',
    'trg_audit_plan_assignees()',
    'trg_audit_project_members()',
    'trg_audit_project_visibility()',
    'trg_audit_subscriptions()',
    'trg_audit_workspace_members()',
    'update_updated_at_column()',
    '_share_links_updated_at()'
  ];
BEGIN
  FOREACH fn IN ARRAY internal LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM authenticated', fn);
    EXCEPTION WHEN undefined_function THEN
      -- ignore functions that don't exist under that signature
      NULL;
    END;
  END LOOP;
END $$;

-- ============================================================
-- 5) profiles: restrict SELECT to self + fellow workspace/org members
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can view profiles of shared workspaces"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace_members me
      JOIN public.workspace_members them
        ON them.workspace_id = me.workspace_id
      WHERE me.user_id = auth.uid()
        AND them.user_id = public.profiles.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.organization_members me
      JOIN public.organization_members them
        ON them.org_id = me.org_id
      WHERE me.user_id = auth.uid()
        AND them.user_id = public.profiles.id
    )
  );

-- ============================================================
-- 6) Tenant-scoped SELECT policies for AI/testing tables
-- ============================================================

-- agent_execution_logs: internal QA staff only
DROP POLICY IF EXISTS "Users can view execution logs" ON public.agent_execution_logs;
CREATE POLICY "QA staff can view execution logs"
  ON public.agent_execution_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin'::user_role,'qa_manager'::user_role,'qa_engineer'::user_role)
    )
  );

-- agent_learning_sessions
DROP POLICY IF EXISTS "Users can view learning sessions" ON public.agent_learning_sessions;
CREATE POLICY "QA staff can view learning sessions"
  ON public.agent_learning_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin'::user_role,'qa_manager'::user_role,'qa_engineer'::user_role)
    )
  );

-- ai_agents
DROP POLICY IF EXISTS "Users can view all agents" ON public.ai_agents;
DROP POLICY IF EXISTS "Users can view agents" ON public.ai_agents;
CREATE POLICY "QA staff can view agents"
  ON public.ai_agents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin'::user_role,'qa_manager'::user_role,'qa_engineer'::user_role)
    )
  );

-- ai_evaluations: scoped through parent AI output/job when possible
DROP POLICY IF EXISTS "ai evals authed" ON public.ai_evaluations;
CREATE POLICY "QA staff can manage AI evaluations"
  ON public.ai_evaluations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin'::user_role,'qa_manager'::user_role,'qa_engineer'::user_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin'::user_role,'qa_manager'::user_role,'qa_engineer'::user_role)
    )
  );

-- ai_feedback: users can only see their own feedback
DROP POLICY IF EXISTS "read ai feedback" ON public.ai_feedback;
CREATE POLICY "Users can view own AI feedback"
  ON public.ai_feedback FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- api_test_executions: workspace-scoped
DROP POLICY IF EXISTS "Users can view all executions" ON public.api_test_executions;
CREATE POLICY "Workspace members can view API test executions"
  ON public.api_test_executions FOR SELECT
  TO authenticated
  USING (
    (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
    OR (project_id IS NOT NULL AND public.can_access_project(project_id))
    OR executor_id = auth.uid()
  );

-- endpoint_prds: workspace-scoped
DROP POLICY IF EXISTS "Users can view all PRDs" ON public.endpoint_prds;
CREATE POLICY "Workspace members can view endpoint PRDs"
  ON public.endpoint_prds FOR SELECT
  TO authenticated
  USING (
    (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
    OR (project_id IS NOT NULL AND public.can_access_project(project_id))
  );

-- endpoint_test_plans: workspace-scoped
DROP POLICY IF EXISTS "Users can view all test plans" ON public.endpoint_test_plans;
CREATE POLICY "Workspace members can view endpoint test plans"
  ON public.endpoint_test_plans FOR SELECT
  TO authenticated
  USING (
    (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
    OR (project_id IS NOT NULL AND public.can_access_project(project_id))
  );

-- execution_step_results: scoped through parent test_executions
DROP POLICY IF EXISTS "Users can view all step results" ON public.execution_step_results;
CREATE POLICY "Members can view execution step results"
  ON public.execution_step_results FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.test_executions te
      LEFT JOIN public.test_cases tc ON tc.id = te.test_case_id
      WHERE te.id = public.execution_step_results.execution_id
        AND (
          te.executor_id = auth.uid()
          OR (tc.project_id IS NOT NULL AND public.can_access_project(tc.project_id))
        )
    )
  );

-- requirement_versions: scoped through parent requirement/project
DROP POLICY IF EXISTS "req versions authed" ON public.requirement_versions;
CREATE POLICY "Project members can view requirement versions"
  ON public.requirement_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.requirements r
      WHERE r.id = public.requirement_versions.requirement_id
        AND (r.project_id IS NULL OR public.can_access_project(r.project_id))
    )
  );
CREATE POLICY "Project members can insert requirement versions"
  ON public.requirement_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.requirements r
      WHERE r.id = public.requirement_versions.requirement_id
        AND (r.project_id IS NULL OR public.can_access_project(r.project_id))
    )
  );

-- teams: QA staff only
DROP POLICY IF EXISTS "Users can view all teams" ON public.teams;
CREATE POLICY "QA staff can view teams"
  ON public.teams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin'::user_role,'qa_manager'::user_role,'qa_engineer'::user_role,'viewer'::user_role)
    )
  );

-- test_case_links: scoped through parent test case
DROP POLICY IF EXISTS "tc links authed" ON public.test_case_links;
CREATE POLICY "Project members can manage test case links"
  ON public.test_case_links FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.test_cases tc
      WHERE tc.id = public.test_case_links.test_case_id
        AND (tc.project_id IS NULL OR public.can_access_project(tc.project_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.test_cases tc
      WHERE tc.id = public.test_case_links.test_case_id
        AND (tc.project_id IS NULL OR public.can_access_project(tc.project_id))
    )
  );

-- test_case_steps: scoped through parent test case
DROP POLICY IF EXISTS "Users can view all test case steps" ON public.test_case_steps;
CREATE POLICY "Project members can view test case steps"
  ON public.test_case_steps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.test_cases tc
      WHERE tc.id = public.test_case_steps.test_case_id
        AND (tc.project_id IS NULL OR public.can_access_project(tc.project_id))
    )
  );

-- test_case_versions: scoped through parent test case
DROP POLICY IF EXISTS "Users can view all versions" ON public.test_case_versions;
CREATE POLICY "Project members can view test case versions"
  ON public.test_case_versions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.test_cases tc
      WHERE tc.id = public.test_case_versions.test_case_id
        AND (tc.project_id IS NULL OR public.can_access_project(tc.project_id))
    )
  );

-- test_parameters: scoped through parent test case
DROP POLICY IF EXISTS "test params authed" ON public.test_parameters;
CREATE POLICY "Project members can manage test parameters"
  ON public.test_parameters FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.test_cases tc
      WHERE tc.id = public.test_parameters.test_case_id
        AND (tc.project_id IS NULL OR public.can_access_project(tc.project_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.test_cases tc
      WHERE tc.id = public.test_parameters.test_case_id
        AND (tc.project_id IS NULL OR public.can_access_project(tc.project_id))
    )
  );
