
CREATE OR REPLACE FUNCTION public.can_edit_test_plan(_plan_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_qa_manager()
    OR EXISTS (SELECT 1 FROM public.test_plans tp WHERE tp.id = _plan_id AND tp.created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.test_plan_assignees a
               WHERE a.test_plan_id = _plan_id AND a.user_id = auth.uid() AND a.role = 'owner')
$$;
