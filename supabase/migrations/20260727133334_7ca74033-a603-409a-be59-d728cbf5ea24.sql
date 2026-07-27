-- 1. Markdown document version history -------------------------------------
CREATE TABLE public.test_plan_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.test_plan_documents_v2(id) ON DELETE CASCADE,
  test_plan_id uuid NOT NULL,
  project_id uuid,
  version integer NOT NULL DEFAULT 1,
  title text,
  slug text,
  kind text,
  content text,
  change_note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.test_plan_document_versions TO authenticated;
GRANT ALL ON public.test_plan_document_versions TO service_role;

ALTER TABLE public.test_plan_document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tpdv workspace members read"
  ON public.test_plan_document_versions FOR SELECT TO authenticated
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));

CREATE POLICY "tpdv workspace members insert"
  ON public.test_plan_document_versions FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));

CREATE INDEX idx_tpdv_document ON public.test_plan_document_versions(document_id, version DESC);
CREATE INDEX idx_tpdv_plan ON public.test_plan_document_versions(test_plan_id);

-- Snapshot every document revision automatically.
CREATE OR REPLACE FUNCTION public.snapshot_test_plan_document()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _next integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.content IS NOT DISTINCT FROM OLD.content
     AND NEW.title IS NOT DISTINCT FROM OLD.title THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO _next
  FROM public.test_plan_document_versions WHERE document_id = NEW.id;

  INSERT INTO public.test_plan_document_versions
    (document_id, test_plan_id, project_id, version, title, slug, kind, content, change_note, created_by)
  VALUES
    (NEW.id, NEW.test_plan_id, NEW.project_id, _next, NEW.title, NEW.slug, NEW.kind, NEW.content,
     CASE WHEN TG_OP = 'INSERT' THEN 'Initial version' ELSE 'Edited' END,
     COALESCE(auth.uid(), NEW.created_by));
  RETURN NEW;
END $$;

CREATE TRIGGER trg_snapshot_tp_document
AFTER INSERT OR UPDATE ON public.test_plan_documents_v2
FOR EACH ROW EXECUTE FUNCTION public.snapshot_test_plan_document();

-- Seed a v1 snapshot for documents that already exist.
INSERT INTO public.test_plan_document_versions
  (document_id, test_plan_id, project_id, version, title, slug, kind, content, change_note, created_by)
SELECT d.id, d.test_plan_id, d.project_id, 1, d.title, d.slug, d.kind, d.content, 'Imported baseline', d.created_by
FROM public.test_plan_documents_v2 d
WHERE NOT EXISTS (SELECT 1 FROM public.test_plan_document_versions v WHERE v.document_id = d.id);

-- 2. Review state for generated artifacts -----------------------------------
ALTER TABLE public.test_plan_documents_v2
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

ALTER TABLE public.test_plan_specs
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

ALTER TABLE public.test_suites
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

ALTER TABLE public.test_cases
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text;

-- 3. Playwright skeleton / skip-stub generation preference -------------------
ALTER TABLE public.test_plans
  ADD COLUMN IF NOT EXISTS codegen_skip_stubs boolean NOT NULL DEFAULT false;