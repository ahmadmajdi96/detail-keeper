
CREATE TABLE IF NOT EXISTS public.project_generated_docs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  job_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  filename TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  source_bytes INTEGER,
  source_hash TEXT,
  edited BOOLEAN NOT NULL DEFAULT false,
  edited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_generated_docs TO authenticated;
GRANT ALL ON public.project_generated_docs TO service_role;

ALTER TABLE public.project_generated_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members can view generated docs"
ON public.project_generated_docs FOR SELECT
TO authenticated
USING (public.is_project_member(project_id));

CREATE POLICY "Project members can insert generated docs"
ON public.project_generated_docs FOR INSERT
TO authenticated
WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "Project members can update generated docs"
ON public.project_generated_docs FOR UPDATE
TO authenticated
USING (public.is_project_member(project_id))
WITH CHECK (public.is_project_member(project_id));

CREATE POLICY "Project members can delete generated docs"
ON public.project_generated_docs FOR DELETE
TO authenticated
USING (public.is_project_member(project_id));

CREATE INDEX IF NOT EXISTS idx_project_generated_docs_project ON public.project_generated_docs(project_id);

CREATE TRIGGER update_project_generated_docs_updated_at
BEFORE UPDATE ON public.project_generated_docs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS github_repo_visibility TEXT NOT NULL DEFAULT 'public' CHECK (github_repo_visibility IN ('public','private'));
