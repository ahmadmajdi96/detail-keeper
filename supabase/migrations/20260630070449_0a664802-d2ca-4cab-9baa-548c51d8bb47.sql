
DO $$ BEGIN
  CREATE TYPE public.job_status AS ENUM ('queued','running','waiting','retrying','completed','failed','cancelled','dead_letter');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.requirement_status AS ENUM ('proposed','approved','obsolete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.review_status AS ENUM ('draft','in_review','approved','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.automation_status AS ENUM ('manual','planned','automated','obsolete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  kind text NOT NULL,
  status public.job_status NOT NULL DEFAULT 'queued',
  priority int NOT NULL DEFAULT 100,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  error jsonb,
  attempt_count int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 3,
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  idempotency_key text UNIQUE,
  progress int NOT NULL DEFAULT 0,
  progress_message text,
  checkpoint jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jobs_status_run_after ON public.jobs(status, run_after) WHERE status IN ('queued','retrying');
CREATE INDEX IF NOT EXISTS idx_jobs_project ON public.jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_kind ON public.jobs(kind);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members view jobs" ON public.jobs FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Workspace members enqueue jobs" ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Workspace members cancel jobs" ON public.jobs FOR UPDATE TO authenticated
  USING (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()));

CREATE TRIGGER trg_jobs_updated_at BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.job_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  attempt_no int NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status public.job_status NOT NULL DEFAULT 'running',
  error jsonb,
  logs text
);
CREATE INDEX IF NOT EXISTS idx_job_attempts_job ON public.job_attempts(job_id);
GRANT SELECT ON public.job_attempts TO authenticated;
GRANT ALL ON public.job_attempts TO service_role;
ALTER TABLE public.job_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members view job_attempts" ON public.job_attempts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_attempts.job_id
                 AND (j.workspace_id IS NULL OR public.is_workspace_member(j.workspace_id, auth.uid()))));

CREATE TABLE IF NOT EXISTS public.job_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  kind text NOT NULL,
  ref text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_artifacts_job ON public.job_artifacts(job_id);
GRANT SELECT ON public.job_artifacts TO authenticated;
GRANT ALL ON public.job_artifacts TO service_role;
ALTER TABLE public.job_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members view job_artifacts" ON public.job_artifacts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j WHERE j.id = job_artifacts.job_id
                 AND (j.workspace_id IS NULL OR public.is_workspace_member(j.workspace_id, auth.uid()))));

CREATE TABLE IF NOT EXISTS public.ci_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  provider text NOT NULL,
  name text NOT NULL,
  secret_hash text NOT NULL,
  default_environment_id uuid REFERENCES public.environments(id) ON DELETE SET NULL,
  default_release_id uuid REFERENCES public.releases(id) ON DELETE SET NULL,
  branch_release_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ci_integrations_project ON public.ci_integrations(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ci_integrations TO authenticated;
GRANT ALL ON public.ci_integrations TO service_role;
ALTER TABLE public.ci_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members manage ci_integrations" ON public.ci_integrations FOR ALL TO authenticated
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()))
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));
CREATE TRIGGER trg_ci_integrations_updated_at BEFORE UPDATE ON public.ci_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.ci_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.ci_integrations(id) ON DELETE SET NULL,
  build_id uuid REFERENCES public.builds(id) ON DELETE SET NULL,
  provider text NOT NULL,
  provider_run_id text,
  branch text,
  commit_sha text,
  status text NOT NULL DEFAULT 'received',
  url text,
  started_at timestamptz,
  finished_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ci_runs_project ON public.ci_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_ci_runs_commit ON public.ci_runs(commit_sha);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ci_runs TO authenticated;
GRANT ALL ON public.ci_runs TO service_role;
ALTER TABLE public.ci_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members view ci_runs" ON public.ci_runs FOR SELECT TO authenticated
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));

CREATE TABLE IF NOT EXISTS public.automation_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  test_case_id uuid REFERENCES public.test_cases(id) ON DELETE CASCADE,
  framework text NOT NULL,
  test_id_pattern text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_automation_mappings_project ON public.automation_mappings(project_id);
CREATE INDEX IF NOT EXISTS idx_automation_mappings_pattern ON public.automation_mappings(test_id_pattern);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_mappings TO authenticated;
GRANT ALL ON public.automation_mappings TO service_role;
ALTER TABLE public.automation_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members manage automation_mappings" ON public.automation_mappings FOR ALL TO authenticated
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()))
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));

CREATE TABLE IF NOT EXISTS public.requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  key text,
  title text NOT NULL,
  description text,
  source_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  status public.requirement_status NOT NULL DEFAULT 'proposed',
  priority int NOT NULL DEFAULT 2,
  tags text[],
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_requirements_project ON public.requirements(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requirements TO authenticated;
GRANT ALL ON public.requirements TO service_role;
ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members manage requirements" ON public.requirements FOR ALL TO authenticated
  USING (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()))
  WITH CHECK (public.is_workspace_member(public.workspace_of_project(project_id), auth.uid()));
CREATE TRIGGER trg_requirements_updated_at BEFORE UPDATE ON public.requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.acceptance_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  text text NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acceptance_criteria_req ON public.acceptance_criteria(requirement_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acceptance_criteria TO authenticated;
GRANT ALL ON public.acceptance_criteria TO service_role;
ALTER TABLE public.acceptance_criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members manage acceptance_criteria" ON public.acceptance_criteria FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.requirements r WHERE r.id = acceptance_criteria.requirement_id
                 AND public.is_workspace_member(public.workspace_of_project(r.project_id), auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.requirements r WHERE r.id = acceptance_criteria.requirement_id
                 AND public.is_workspace_member(public.workspace_of_project(r.project_id), auth.uid())));

CREATE TABLE IF NOT EXISTS public.requirement_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  linked_type text NOT NULL,
  linked_id uuid NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requirement_id, linked_type, linked_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requirement_links TO authenticated;
GRANT ALL ON public.requirement_links TO service_role;
ALTER TABLE public.requirement_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members manage requirement_links" ON public.requirement_links FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.requirements r WHERE r.id = requirement_links.requirement_id
                 AND public.is_workspace_member(public.workspace_of_project(r.project_id), auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.requirements r WHERE r.id = requirement_links.requirement_id
                 AND public.is_workspace_member(public.workspace_of_project(r.project_id), auth.uid())));

ALTER TABLE public.test_cases
  ADD COLUMN IF NOT EXISTS review_status public.review_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS automation_status public.automation_status NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS automation_path text,
  ADD COLUMN IF NOT EXISTS estimated_duration_min int,
  ADD COLUMN IF NOT EXISTS source text;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.job_attempts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.builds;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ci_runs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.notify_build_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('success','failed') THEN
    SELECT workspace_id INTO _ws FROM public.projects WHERE id = NEW.project_id;
    IF _ws IS NOT NULL THEN
      PERFORM public.notify_workspace_managers(
        _ws,
        CASE WHEN NEW.status='success' THEN 'build_success' ELSE 'build_failed' END,
        'Build ' || NEW.status || COALESCE(': ' || NEW.name, ''),
        COALESCE('Branch ' || NEW.branch, '') || COALESCE(' @ ' || left(NEW.commit_sha, 7), ''),
        jsonb_build_object('build_id', NEW.id, 'project_id', NEW.project_id, 'status', NEW.status),
        NEW.created_by);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_build_status ON public.builds;
CREATE TRIGGER trg_notify_build_status AFTER UPDATE ON public.builds
  FOR EACH ROW EXECUTE FUNCTION public.notify_build_status();

CREATE OR REPLACE FUNCTION public.notify_cycle_run_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('completed','cancelled') THEN
    SELECT workspace_id INTO _ws FROM public.projects WHERE id = NEW.project_id;
    IF _ws IS NOT NULL THEN
      PERFORM public.notify_workspace_managers(
        _ws, 'cycle_run_' || NEW.status,
        'Cycle run ' || NEW.status,
        COALESCE(NEW.name, 'A test cycle run') || ' has ' || NEW.status,
        jsonb_build_object('run_id', NEW.id, 'cycle_id', NEW.cycle_id, 'project_id', NEW.project_id),
        NEW.executor_id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_cycle_run_status ON public.cycle_runs;
CREATE TRIGGER trg_notify_cycle_run_status AFTER UPDATE ON public.cycle_runs
  FOR EACH ROW EXECUTE FUNCTION public.notify_cycle_run_status();
