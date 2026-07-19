
DROP POLICY IF EXISTS "projects manage by ws admin or project lead" ON public.projects;

-- Allow workspace owners/admins/editors to create projects; owners/admins or project leads can update/delete.
CREATE POLICY "projects insert by ws writer"
ON public.projects FOR INSERT TO authenticated
WITH CHECK (
  public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin','editor')
);

CREATE POLICY "projects update by ws admin or lead"
ON public.projects FOR UPDATE TO authenticated
USING (
  public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin')
  OR public.project_role_of(id) = 'lead'
)
WITH CHECK (
  public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin')
  OR public.project_role_of(id) = 'lead'
);

CREATE POLICY "projects delete by ws admin"
ON public.projects FOR DELETE TO authenticated
USING (
  public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin')
);
