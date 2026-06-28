
-- Test plan assignees (many-to-many with profiles)
CREATE TABLE public.test_plan_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'tester',
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(test_plan_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_plan_assignees TO authenticated;
GRANT ALL ON public.test_plan_assignees TO service_role;
ALTER TABLE public.test_plan_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can view assignees" ON public.test_plan_assignees FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.test_plans tp WHERE tp.id = test_plan_id AND (tp.workspace_id IS NULL OR public.is_workspace_member(tp.workspace_id, auth.uid()))));
CREATE POLICY "members can manage assignees" ON public.test_plan_assignees FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.test_plans tp WHERE tp.id = test_plan_id AND (tp.workspace_id IS NULL OR public.is_workspace_member(tp.workspace_id, auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.test_plans tp WHERE tp.id = test_plan_id AND (tp.workspace_id IS NULL OR public.is_workspace_member(tp.workspace_id, auth.uid()))));

-- Test plan source documents (many-to-many with documents)
CREATE TABLE public.test_plan_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(test_plan_id, document_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_plan_documents TO authenticated;
GRANT ALL ON public.test_plan_documents TO service_role;
ALTER TABLE public.test_plan_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can view plan docs" ON public.test_plan_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.test_plans tp WHERE tp.id = test_plan_id AND (tp.workspace_id IS NULL OR public.is_workspace_member(tp.workspace_id, auth.uid()))));
CREATE POLICY "members can manage plan docs" ON public.test_plan_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.test_plans tp WHERE tp.id = test_plan_id AND (tp.workspace_id IS NULL OR public.is_workspace_member(tp.workspace_id, auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.test_plans tp WHERE tp.id = test_plan_id AND (tp.workspace_id IS NULL OR public.is_workspace_member(tp.workspace_id, auth.uid()))));

-- Link test_cases to test_plans (many-to-many)
CREATE TABLE public.test_plan_test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE,
  test_case_id uuid NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(test_plan_id, test_case_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_plan_test_cases TO authenticated;
GRANT ALL ON public.test_plan_test_cases TO service_role;
ALTER TABLE public.test_plan_test_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can view plan cases" ON public.test_plan_test_cases FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.test_plans tp WHERE tp.id = test_plan_id AND (tp.workspace_id IS NULL OR public.is_workspace_member(tp.workspace_id, auth.uid()))));
CREATE POLICY "members can manage plan cases" ON public.test_plan_test_cases FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.test_plans tp WHERE tp.id = test_plan_id AND (tp.workspace_id IS NULL OR public.is_workspace_member(tp.workspace_id, auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.test_plans tp WHERE tp.id = test_plan_id AND (tp.workspace_id IS NULL OR public.is_workspace_member(tp.workspace_id, auth.uid()))));

-- Test plan versions (snapshot history)
CREATE TABLE public.test_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE,
  version int NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_summary text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(test_plan_id, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_plan_versions TO authenticated;
GRANT ALL ON public.test_plan_versions TO service_role;
ALTER TABLE public.test_plan_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can view plan versions" ON public.test_plan_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.test_plans tp WHERE tp.id = test_plan_id AND (tp.workspace_id IS NULL OR public.is_workspace_member(tp.workspace_id, auth.uid()))));
CREATE POLICY "members can create plan versions" ON public.test_plan_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.test_plans tp WHERE tp.id = test_plan_id AND (tp.workspace_id IS NULL OR public.is_workspace_member(tp.workspace_id, auth.uid()))));

-- Add columns to test_plans for AI tracking and versioning
ALTER TABLE public.test_plans ADD COLUMN IF NOT EXISTS objective text;
ALTER TABLE public.test_plans ADD COLUMN IF NOT EXISTS scope text;
ALTER TABLE public.test_plans ADD COLUMN IF NOT EXISTS ai_status text DEFAULT 'idle';
ALTER TABLE public.test_plans ADD COLUMN IF NOT EXISTS ai_last_run_at timestamptz;
ALTER TABLE public.test_plans ADD COLUMN IF NOT EXISTS current_version int NOT NULL DEFAULT 1;

-- Add test_plan_id to test_executions for direct plan->execution lookup
ALTER TABLE public.test_executions ADD COLUMN IF NOT EXISTS test_plan_id uuid REFERENCES public.test_plans(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_test_executions_test_plan_id ON public.test_executions(test_plan_id);
