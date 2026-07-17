-- Helper: can current user manage test_plan_assignees for a given plan
CREATE OR REPLACE FUNCTION public.can_manage_plan_assignees(_plan_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.test_plans tp
    LEFT JOIN public.projects p ON p.id = tp.project_id
    LEFT JOIN public.workspaces w ON w.id = COALESCE(tp.workspace_id, p.workspace_id)
    LEFT JOIN public.workspace_members wm
      ON wm.workspace_id = COALESCE(tp.workspace_id, p.workspace_id) AND wm.user_id = auth.uid()
    WHERE tp.id = _plan_id
      AND (
        w.owner_id = auth.uid()
        OR wm.role IN ('owner','admin')
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.project_id = tp.project_id AND pm.user_id = auth.uid() AND pm.role = 'lead'
        )
        OR EXISTS (
          SELECT 1 FROM public.test_plan_assignees a
          WHERE a.test_plan_id = _plan_id AND a.user_id = auth.uid() AND a.role = 'owner'
        )
      )
  );
$$;

-- Helper: can current user sign off / approve on a plan (owner or reviewer, or workspace owner/admin)
CREATE OR REPLACE FUNCTION public.can_signoff_plan(_plan_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.test_plans tp
    LEFT JOIN public.projects p ON p.id = tp.project_id
    LEFT JOIN public.workspaces w ON w.id = COALESCE(tp.workspace_id, p.workspace_id)
    LEFT JOIN public.workspace_members wm
      ON wm.workspace_id = COALESCE(tp.workspace_id, p.workspace_id) AND wm.user_id = auth.uid()
    WHERE tp.id = _plan_id
      AND (
        w.owner_id = auth.uid()
        OR wm.role IN ('owner','admin')
        OR EXISTS (
          SELECT 1 FROM public.test_plan_assignees a
          WHERE a.test_plan_id = _plan_id AND a.user_id = auth.uid() AND a.role IN ('owner','reviewer')
        )
      )
  );
$$;

-- Replace existing policies with tighter, role-aware ones
DROP POLICY IF EXISTS "members can view assignees" ON public.test_plan_assignees;
DROP POLICY IF EXISTS "members can manage assignees" ON public.test_plan_assignees;

CREATE POLICY "assignees viewable to project members"
ON public.test_plan_assignees
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.test_plans tp
    WHERE tp.id = test_plan_assignees.test_plan_id
      AND (tp.project_id IS NULL OR public.can_access_project(tp.project_id))
  )
);

CREATE POLICY "assignees manageable by plan managers"
ON public.test_plan_assignees
FOR INSERT WITH CHECK (public.can_manage_plan_assignees(test_plan_id));

CREATE POLICY "assignees updatable by plan managers"
ON public.test_plan_assignees
FOR UPDATE USING (public.can_manage_plan_assignees(test_plan_id))
WITH CHECK (public.can_manage_plan_assignees(test_plan_id));

CREATE POLICY "assignees deletable by plan managers"
ON public.test_plan_assignees
FOR DELETE USING (public.can_manage_plan_assignees(test_plan_id));

-- Trigger: notify user when newly assigned to a test plan
CREATE OR REPLACE FUNCTION public.notify_test_plan_assignee()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _plan_name text;
BEGIN
  SELECT name INTO _plan_name FROM public.test_plans WHERE id = NEW.test_plan_id;
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    NEW.user_id,
    'info',
    'Assigned to test plan: ' || COALESCE(_plan_name, 'Untitled'),
    'You were added as ' || NEW.role::text,
    jsonb_build_object(
      'test_plan_id', NEW.test_plan_id,
      'role', NEW.role,
      'link', '/test-plans/' || NEW.test_plan_id::text
    )
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_test_plan_assignee ON public.test_plan_assignees;
CREATE TRIGGER trg_notify_test_plan_assignee
AFTER INSERT ON public.test_plan_assignees
FOR EACH ROW EXECUTE FUNCTION public.notify_test_plan_assignee();