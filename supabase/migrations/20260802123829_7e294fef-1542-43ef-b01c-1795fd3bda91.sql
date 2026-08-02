
-- Helper: current profile role
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS public.user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_qa_manager()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_app_role() IN ('admin','qa_manager')
$$;

-- Test plans: edit rights
CREATE OR REPLACE FUNCTION public.can_edit_test_plan(_plan_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_qa_manager()
    OR EXISTS (SELECT 1 FROM public.test_plans tp WHERE tp.id = _plan_id AND tp.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.test_plan_assignees a
               WHERE a.test_plan_id = _plan_id AND a.user_id = auth.uid()
                 AND a.role IN ('owner','assignee'))
$$;

CREATE OR REPLACE FUNCTION public.can_delete_test_plan(_plan_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_qa_manager()
    OR EXISTS (SELECT 1 FROM public.test_plans tp WHERE tp.id = _plan_id AND tp.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.test_plan_assignees a
               WHERE a.test_plan_id = _plan_id AND a.user_id = auth.uid() AND a.role = 'owner')
$$;

CREATE OR REPLACE FUNCTION public.can_execute_test_plan(_plan_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _plan_id IS NULL
    OR public.is_qa_manager()
    OR EXISTS (SELECT 1 FROM public.test_plan_assignees a
               WHERE a.test_plan_id = _plan_id AND a.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.test_plans tp WHERE tp.id = _plan_id AND tp.created_by = auth.uid())
$$;

-- ---- test_plans policies
DROP POLICY IF EXISTS "project visibility gate" ON public.test_plans;
DROP POLICY IF EXISTS "Members update test plans" ON public.test_plans;
DROP POLICY IF EXISTS "Members delete test plans" ON public.test_plans;

CREATE POLICY "Members view test plans scope" ON public.test_plans FOR SELECT TO authenticated
USING (public.can_access_project(project_id)
   OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid())));

CREATE POLICY "Owners update test plans" ON public.test_plans FOR UPDATE TO authenticated
USING (
  (public.can_access_project(project_id)
   OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid())))
  AND public.can_edit_test_plan(id)
)
WITH CHECK (
  (public.can_access_project(project_id)
   OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid())))
  AND public.can_edit_test_plan(id)
);

CREATE POLICY "Owners delete test plans" ON public.test_plans FOR DELETE TO authenticated
USING (
  (public.can_access_project(project_id)
   OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid())))
  AND public.can_delete_test_plan(id)
);

-- ---- test_cases policies
DROP POLICY IF EXISTS "project visibility gate" ON public.test_cases;
DROP POLICY IF EXISTS "Members update test cases" ON public.test_cases;
DROP POLICY IF EXISTS "Members delete test cases" ON public.test_cases;

CREATE POLICY "Reporters update test cases" ON public.test_cases FOR UPDATE TO authenticated
USING (public.can_access_project(project_id) AND (public.is_qa_manager() OR created_by = auth.uid() OR created_by IS NULL))
WITH CHECK (public.can_access_project(project_id) AND (public.is_qa_manager() OR created_by = auth.uid() OR created_by IS NULL));

CREATE POLICY "Reporters delete test cases" ON public.test_cases FOR DELETE TO authenticated
USING (public.can_access_project(project_id) AND (public.is_qa_manager() OR created_by = auth.uid()));

-- ---- test_executions: engineers only on assigned plans
DROP POLICY IF EXISTS "Members write executions" ON public.test_executions;
DROP POLICY IF EXISTS "Members update executions" ON public.test_executions;
DROP POLICY IF EXISTS "Members delete executions" ON public.test_executions;

CREATE POLICY "Assigned write executions" ON public.test_executions FOR INSERT TO authenticated
WITH CHECK ((project_id IS NULL OR public.can_access_project(project_id)) AND public.can_execute_test_plan(test_plan_id));

CREATE POLICY "Assigned update executions" ON public.test_executions FOR UPDATE TO authenticated
USING ((project_id IS NULL OR public.can_access_project(project_id)) AND public.can_execute_test_plan(test_plan_id))
WITH CHECK ((project_id IS NULL OR public.can_access_project(project_id)) AND public.can_execute_test_plan(test_plan_id));

CREATE POLICY "Managers delete executions" ON public.test_executions FOR DELETE TO authenticated
USING ((project_id IS NULL OR public.can_access_project(project_id))
       AND (public.is_qa_manager() OR executor_id = auth.uid()));

-- ---- workspaces: align delete with UI (managers + admins, and owner)
DROP POLICY IF EXISTS "Admins can delete workspaces" ON public.workspaces;
CREATE POLICY "Managers can delete workspaces" ON public.workspaces FOR DELETE TO authenticated
USING (public.is_qa_manager() OR owner_id = auth.uid());
