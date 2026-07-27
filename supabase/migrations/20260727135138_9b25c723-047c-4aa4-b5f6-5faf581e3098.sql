CREATE TABLE public.suite_grouping_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  workspace_id uuid,
  version integer NOT NULL DEFAULT 1,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  assignments jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  is_current boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sgv_project ON public.suite_grouping_versions (project_id, version DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suite_grouping_versions TO authenticated;
GRANT ALL ON public.suite_grouping_versions TO service_role;

ALTER TABLE public.suite_grouping_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sgv_select_project_access" ON public.suite_grouping_versions
FOR SELECT TO authenticated
USING (public.can_access_project(project_id));

CREATE POLICY "sgv_insert_project_member" ON public.suite_grouping_versions
FOR INSERT TO authenticated
WITH CHECK (public.can_access_project(project_id));

CREATE POLICY "sgv_update_project_member" ON public.suite_grouping_versions
FOR UPDATE TO authenticated
USING (public.can_access_project(project_id))
WITH CHECK (public.can_access_project(project_id));

CREATE POLICY "sgv_delete_lead" ON public.suite_grouping_versions
FOR DELETE TO authenticated
USING (public.project_role_of(project_id) = 'lead'::public.project_role);

CREATE TRIGGER trg_sgv_updated_at
BEFORE UPDATE ON public.suite_grouping_versions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();