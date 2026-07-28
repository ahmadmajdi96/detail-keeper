CREATE TABLE public.ingest_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  workspace_id uuid,
  job_ref text,
  ingest_type text NOT NULL DEFAULT 'repo_clone',
  source_name text,
  status text NOT NULL DEFAULT 'queued',
  stage text,
  progress integer NOT NULL DEFAULT 0,
  error text,
  document_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  document_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ingest_jobs_project_idx ON public.ingest_jobs (project_id, created_at DESC);
CREATE INDEX ingest_jobs_job_ref_idx ON public.ingest_jobs (job_ref);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingest_jobs TO authenticated;
GRANT ALL ON public.ingest_jobs TO service_role;

ALTER TABLE public.ingest_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view ingest jobs"
  ON public.ingest_jobs FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

CREATE POLICY "Project members can create ingest jobs"
  ON public.ingest_jobs FOR INSERT TO authenticated
  WITH CHECK (public.can_access_project(project_id));

CREATE POLICY "Project members can update ingest jobs"
  ON public.ingest_jobs FOR UPDATE TO authenticated
  USING (public.can_access_project(project_id))
  WITH CHECK (public.can_access_project(project_id));

CREATE POLICY "Project members can delete ingest jobs"
  ON public.ingest_jobs FOR DELETE TO authenticated
  USING (public.can_access_project(project_id));

CREATE TRIGGER ingest_jobs_updated_at
  BEFORE UPDATE ON public.ingest_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();