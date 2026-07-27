-- 1. Reviewer assignment + due dates on all reviewable artifacts
ALTER TABLE public.test_plan_documents_v2
  ADD COLUMN IF NOT EXISTS reviewer_id uuid,
  ADD COLUMN IF NOT EXISTS review_due_at timestamptz;
ALTER TABLE public.test_suites
  ADD COLUMN IF NOT EXISTS reviewer_id uuid,
  ADD COLUMN IF NOT EXISTS review_due_at timestamptz;
ALTER TABLE public.test_cases
  ADD COLUMN IF NOT EXISTS reviewer_id uuid,
  ADD COLUMN IF NOT EXISTS review_due_at timestamptz;
ALTER TABLE public.test_plan_specs
  ADD COLUMN IF NOT EXISTS reviewer_id uuid,
  ADD COLUMN IF NOT EXISTS review_due_at timestamptz;

-- 2. Provenance: which doc version + traceability mappings produced this artifact
ALTER TABLE public.test_suites
  ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.test_cases
  ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.test_plan_specs
  ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3. Playwright code validation results
ALTER TABLE public.test_plan_specs
  ADD COLUMN IF NOT EXISTS validation_status text,
  ADD COLUMN IF NOT EXISTS validation_report jsonb,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_docs_v2_reviewer ON public.test_plan_documents_v2(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_specs_reviewer ON public.test_plan_specs(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_cases_reviewer ON public.test_cases(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_suites_reviewer ON public.test_suites(reviewer_id);

-- 4. Inline comments + resolution threads on the Markdown diff view
CREATE TABLE IF NOT EXISTS public.doc_diff_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.test_plan_documents_v2(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  left_version integer,
  right_version integer,
  line_key text NOT NULL,
  line_text text,
  body text NOT NULL,
  decision text NOT NULL DEFAULT 'comment',
  parent_id uuid REFERENCES public.doc_diff_comments(id) ON DELETE CASCADE,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz,
  author_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.doc_diff_comments TO authenticated;
GRANT ALL ON public.doc_diff_comments TO service_role;

ALTER TABLE public.doc_diff_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project members read doc diff comments"
  ON public.doc_diff_comments FOR SELECT TO authenticated
  USING (public.can_access_project(project_id));

CREATE POLICY "Project members create doc diff comments"
  ON public.doc_diff_comments FOR INSERT TO authenticated
  WITH CHECK (public.can_access_project(project_id) AND author_id = auth.uid());

CREATE POLICY "Project members update doc diff comments"
  ON public.doc_diff_comments FOR UPDATE TO authenticated
  USING (public.can_access_project(project_id))
  WITH CHECK (public.can_access_project(project_id));

CREATE POLICY "Authors delete their doc diff comments"
  ON public.doc_diff_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_doc_diff_comments_doc ON public.doc_diff_comments(document_id, line_key);

CREATE TRIGGER trg_doc_diff_comments_updated_at
  BEFORE UPDATE ON public.doc_diff_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();