
-- 1. Enums
DO $$ BEGIN
  CREATE TYPE public.project_role AS ENUM ('lead','contributor','viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.plan_role AS ENUM ('owner','assignee','reviewer','viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.project_visibility AS ENUM ('inherited','restricted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Migrate project_members.role -> project_role
ALTER TABLE public.project_members ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.project_members
  ALTER COLUMN role TYPE public.project_role
  USING (
    CASE lower(coalesce(role,''))
      WHEN 'owner' THEN 'lead'
      WHEN 'admin' THEN 'lead'
      WHEN 'lead' THEN 'lead'
      WHEN 'editor' THEN 'contributor'
      WHEN 'member' THEN 'contributor'
      WHEN 'contributor' THEN 'contributor'
      WHEN 'viewer' THEN 'viewer'
      ELSE 'contributor'
    END::public.project_role
  );
ALTER TABLE public.project_members ALTER COLUMN role SET DEFAULT 'contributor'::public.project_role;

-- Migrate test_plan_assignees.role -> plan_role
ALTER TABLE public.test_plan_assignees ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.test_plan_assignees
  ALTER COLUMN role TYPE public.plan_role
  USING (
    CASE lower(coalesce(role,''))
      WHEN 'owner' THEN 'owner'
      WHEN 'tester' THEN 'assignee'
      WHEN 'assignee' THEN 'assignee'
      WHEN 'reviewer' THEN 'reviewer'
      WHEN 'viewer' THEN 'viewer'
      ELSE 'assignee'
    END::public.plan_role
  );
ALTER TABLE public.test_plan_assignees ALTER COLUMN role SET DEFAULT 'assignee'::public.plan_role;

-- Add visibility on projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS visibility public.project_visibility NOT NULL DEFAULT 'inherited';

-- 3. Helper functions
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.project_id = _project_id AND pm.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1
    FROM public.projects p
    JOIN public.workspace_members wm ON wm.workspace_id = p.workspace_id
    WHERE p.id = _project_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner','admin')
  ) OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id AND p.workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.project_role_of(_project_id uuid)
RETURNS public.project_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.projects p
      LEFT JOIN public.workspace_members wm
        ON wm.workspace_id = p.workspace_id AND wm.user_id = auth.uid()
      WHERE p.id = _project_id
        AND (
          wm.role IN ('owner','admin')
          OR EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = p.workspace_id AND w.owner_id = auth.uid())
        )
    ) THEN 'lead'::public.project_role
    ELSE (
      SELECT role FROM public.project_members
      WHERE project_id = _project_id AND user_id = auth.uid()
      LIMIT 1
    )
  END;
$$;

-- Visibility gate: true when caller may see a given project id
CREATE OR REPLACE FUNCTION public.can_access_project(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _project_id IS NULL OR EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id
      AND (
        (p.visibility = 'inherited' AND public.is_workspace_member(p.workspace_id, auth.uid()))
        OR (p.visibility = 'restricted' AND public.is_project_member(p.id))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_project_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_role_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_project(uuid) TO authenticated;

-- 4. RLS updates on projects
DROP POLICY IF EXISTS "ws members view projects" ON public.projects;
DROP POLICY IF EXISTS "ws editors+ manage projects" ON public.projects;

CREATE POLICY "projects visibility select" ON public.projects
FOR SELECT TO authenticated
USING (
  (visibility = 'inherited' AND public.is_workspace_member(workspace_id, auth.uid()))
  OR (visibility = 'restricted' AND public.is_project_member(id))
);

CREATE POLICY "projects manage by ws admin or project lead" ON public.projects
FOR ALL TO authenticated
USING (
  public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin')
  OR public.project_role_of(id) = 'lead'
)
WITH CHECK (
  public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin')
  OR public.project_role_of(id) = 'lead'
);

-- Restrictive visibility policies on project-scoped child tables.
-- These AND with existing permissive policies to hide rows in restricted projects.

DROP POLICY IF EXISTS "project visibility gate" ON public.documents;
CREATE POLICY "project visibility gate" ON public.documents
AS RESTRICTIVE FOR ALL TO authenticated
USING (public.can_access_project(project_id))
WITH CHECK (public.can_access_project(project_id));

DROP POLICY IF EXISTS "project visibility gate" ON public.test_plans;
CREATE POLICY "project visibility gate" ON public.test_plans
AS RESTRICTIVE FOR ALL TO authenticated
USING (public.can_access_project(project_id))
WITH CHECK (public.can_access_project(project_id));

DROP POLICY IF EXISTS "project visibility gate" ON public.test_cases;
CREATE POLICY "project visibility gate" ON public.test_cases
AS RESTRICTIVE FOR ALL TO authenticated
USING (public.can_access_project(project_id))
WITH CHECK (public.can_access_project(project_id));

DROP POLICY IF EXISTS "project visibility gate" ON public.test_cycles;
CREATE POLICY "project visibility gate" ON public.test_cycles
AS RESTRICTIVE FOR ALL TO authenticated
USING (public.can_access_project(project_id))
WITH CHECK (public.can_access_project(project_id));

DROP POLICY IF EXISTS "project visibility gate" ON public.defects;
CREATE POLICY "project visibility gate" ON public.defects
AS RESTRICTIVE FOR ALL TO authenticated
USING (public.can_access_project(project_id))
WITH CHECK (public.can_access_project(project_id));

DROP POLICY IF EXISTS "project visibility gate" ON public.requirements;
CREATE POLICY "project visibility gate" ON public.requirements
AS RESTRICTIVE FOR ALL TO authenticated
USING (public.can_access_project(project_id))
WITH CHECK (public.can_access_project(project_id));

DROP POLICY IF EXISTS "project visibility gate" ON public.api_endpoints;
CREATE POLICY "project visibility gate" ON public.api_endpoints
AS RESTRICTIVE FOR ALL TO authenticated
USING (public.can_access_project(project_id))
WITH CHECK (public.can_access_project(project_id));

-- 5. Auto-add project creator as lead
CREATE OR REPLACE FUNCTION public.add_project_creator_as_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'lead'::public.project_role)
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_add_project_creator_as_lead ON public.projects;
CREATE TRIGGER trg_add_project_creator_as_lead
AFTER INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.add_project_creator_as_lead();
