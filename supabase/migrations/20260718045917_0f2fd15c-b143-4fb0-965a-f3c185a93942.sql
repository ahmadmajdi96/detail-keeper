
-- Tighten RLS: drop legacy "everyone authenticated can see everything" policies
-- and replace with scoped ones using existing helper functions.

-- workspaces
DROP POLICY IF EXISTS "Users can view all workspaces" ON public.workspaces;
CREATE POLICY "Members can view their workspaces"
  ON public.workspaces FOR SELECT
  USING (
    owner_id = auth.uid()
    OR public.is_workspace_member(id, auth.uid())
    OR (organization_id IS NOT NULL AND public.is_org_member(organization_id))
  );

-- test_plans
DROP POLICY IF EXISTS "Users can view all test plans" ON public.test_plans;
DROP POLICY IF EXISTS "Authenticated users can insert test plans" ON public.test_plans;
DROP POLICY IF EXISTS "Authenticated users can update test plans" ON public.test_plans;
DROP POLICY IF EXISTS "Admins and managers can delete test plans" ON public.test_plans;
CREATE POLICY "Members view test plans"
  ON public.test_plans FOR SELECT
  USING (
    public.can_access_project(project_id)
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
  );
CREATE POLICY "Members write test plans"
  ON public.test_plans FOR INSERT
  WITH CHECK (
    public.can_access_project(project_id)
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
  );
CREATE POLICY "Members update test plans"
  ON public.test_plans FOR UPDATE
  USING (
    public.can_access_project(project_id)
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
  );
CREATE POLICY "Members delete test plans"
  ON public.test_plans FOR DELETE
  USING (
    public.can_access_project(project_id)
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
  );

-- test_cases
DROP POLICY IF EXISTS "Users can view all test cases" ON public.test_cases;
DROP POLICY IF EXISTS "Authenticated users can insert test cases" ON public.test_cases;
DROP POLICY IF EXISTS "Authenticated users can update test cases" ON public.test_cases;
DROP POLICY IF EXISTS "Authenticated users can delete test cases" ON public.test_cases;
CREATE POLICY "Members view test cases"
  ON public.test_cases FOR SELECT USING (public.can_access_project(project_id));
CREATE POLICY "Members write test cases"
  ON public.test_cases FOR INSERT WITH CHECK (public.can_access_project(project_id));
CREATE POLICY "Members update test cases"
  ON public.test_cases FOR UPDATE USING (public.can_access_project(project_id));
CREATE POLICY "Members delete test cases"
  ON public.test_cases FOR DELETE USING (public.can_access_project(project_id));

-- documents
DROP POLICY IF EXISTS "Users can view all documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated users can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated users can update documents" ON public.documents;
DROP POLICY IF EXISTS "Admins and managers can delete documents" ON public.documents;
CREATE POLICY "Members view documents"
  ON public.documents FOR SELECT USING (public.can_access_project(project_id));
CREATE POLICY "Members write documents"
  ON public.documents FOR INSERT WITH CHECK (public.can_access_project(project_id));
CREATE POLICY "Members update documents"
  ON public.documents FOR UPDATE USING (public.can_access_project(project_id));
CREATE POLICY "Members delete documents"
  ON public.documents FOR DELETE USING (public.can_access_project(project_id));

-- defects
DROP POLICY IF EXISTS "Authenticated users can view defects" ON public.defects;
DROP POLICY IF EXISTS "Authenticated users can insert defects" ON public.defects;
DROP POLICY IF EXISTS "Authenticated users can update defects" ON public.defects;
DROP POLICY IF EXISTS "Authenticated users can delete defects" ON public.defects;
CREATE POLICY "Members view defects"
  ON public.defects FOR SELECT USING (public.can_access_project(project_id));
CREATE POLICY "Members write defects"
  ON public.defects FOR INSERT WITH CHECK (public.can_access_project(project_id));
CREATE POLICY "Members update defects"
  ON public.defects FOR UPDATE USING (public.can_access_project(project_id));
CREATE POLICY "Members delete defects"
  ON public.defects FOR DELETE USING (public.can_access_project(project_id));

-- test_executions
DROP POLICY IF EXISTS "Users can view all executions" ON public.test_executions;
DROP POLICY IF EXISTS "Authenticated users can insert executions" ON public.test_executions;
DROP POLICY IF EXISTS "Authenticated users can update executions" ON public.test_executions;
DROP POLICY IF EXISTS "Authenticated users can delete executions" ON public.test_executions;
CREATE POLICY "Members view executions"
  ON public.test_executions FOR SELECT USING (
    project_id IS NULL OR public.can_access_project(project_id)
  );
CREATE POLICY "Members write executions"
  ON public.test_executions FOR INSERT WITH CHECK (
    project_id IS NULL OR public.can_access_project(project_id)
  );
CREATE POLICY "Members update executions"
  ON public.test_executions FOR UPDATE USING (
    project_id IS NULL OR public.can_access_project(project_id)
  );
CREATE POLICY "Members delete executions"
  ON public.test_executions FOR DELETE USING (
    project_id IS NULL OR public.can_access_project(project_id)
  );

-- Auto-create a hidden personal workspace `qualixa-<uid-prefix>` for every new user,
-- so free-plan accounts have a scope without seeing multi-workspace UI.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _name text;
  _org_id uuid;
  _slug text;
  _ws_id uuid;
BEGIN
  _name := COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, email, name, role, status)
  VALUES (
    NEW.id, NEW.email, _name,
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.user_role, 'qa_engineer'),
    'active'
  )
  ON CONFLICT (id) DO NOTHING;

  _slug := lower(regexp_replace(_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(NEW.id::text, 1, 8);
  INSERT INTO public.organizations (name, slug, owner_id)
  VALUES (_name || '''s Organization', _slug, NEW.id)
  RETURNING id INTO _org_id;

  UPDATE public.profiles SET last_organization_id = _org_id WHERE id = NEW.id;

  -- Personal workspace (hidden default scope for free plan)
  INSERT INTO public.workspaces (name, description, owner_id, organization_id, status)
  VALUES (
    'qualixa-' || substr(NEW.id::text, 1, 8),
    'Personal workspace',
    NEW.id, _org_id, 'active'
  )
  RETURNING id INTO _ws_id;

  UPDATE public.profiles SET last_workspace_id = _ws_id WHERE id = NEW.id;

  RETURN NEW;
END $$;
