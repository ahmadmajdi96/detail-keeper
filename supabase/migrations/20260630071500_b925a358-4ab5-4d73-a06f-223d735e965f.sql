
ALTER TABLE public.defects
  ADD COLUMN IF NOT EXISTS cycle_run_id uuid REFERENCES public.cycle_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cycle_run_item_id uuid REFERENCES public.cycle_run_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cycle_attempt_id uuid REFERENCES public.cycle_attempts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS release_id uuid REFERENCES public.releases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS build_id uuid REFERENCES public.builds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dedup_signature text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_defects_cycle_run ON public.defects(cycle_run_id);
CREATE INDEX IF NOT EXISTS idx_defects_run_item ON public.defects(cycle_run_item_id);
CREATE INDEX IF NOT EXISTS idx_defects_dedup ON public.defects(project_id, dedup_signature);

ALTER TABLE public.evidence
  ADD COLUMN IF NOT EXISTS cycle_run_id uuid REFERENCES public.cycle_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cycle_run_item_id uuid REFERENCES public.cycle_run_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cycle_attempt_id uuid REFERENCES public.cycle_attempts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS size_bytes bigint;

CREATE OR REPLACE FUNCTION public.defect_status_timestamps()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'resolved' AND NEW.resolved_at IS NULL THEN NEW.resolved_at := now(); END IF;
    IF NEW.status = 'closed' AND NEW.closed_at IS NULL THEN NEW.closed_at := now(); END IF;
    IF NEW.status = 'reopened' THEN NEW.resolved_at := NULL; NEW.closed_at := NULL; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_defect_status_ts ON public.defects;
CREATE TRIGGER trg_defect_status_ts BEFORE UPDATE ON public.defects
  FOR EACH ROW EXECUTE FUNCTION public.defect_status_timestamps();

CREATE TABLE IF NOT EXISTS public.quality_gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  scope text NOT NULL DEFAULT 'cycle_run',
  enabled boolean NOT NULL DEFAULT true,
  blocks_release boolean NOT NULL DEFAULT true,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  environment_id uuid REFERENCES public.environments(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_gates TO authenticated;
GRANT ALL ON public.quality_gates TO service_role;
ALTER TABLE public.quality_gates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members manage gates" ON public.quality_gates FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE TRIGGER trg_quality_gates_updated BEFORE UPDATE ON public.quality_gates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.gate_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_id uuid NOT NULL REFERENCES public.quality_gates(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  release_id uuid REFERENCES public.releases(id) ON DELETE CASCADE,
  cycle_run_id uuid REFERENCES public.cycle_runs(id) ON DELETE CASCADE,
  build_id uuid REFERENCES public.builds(id) ON DELETE CASCADE,
  status text NOT NULL,
  blocks_release boolean NOT NULL DEFAULT false,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  rule_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gate_evaluations TO authenticated;
GRANT ALL ON public.gate_evaluations TO service_role;
ALTER TABLE public.gate_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members read gate evals" ON public.gate_evaluations FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "Workspace members insert gate evals" ON public.gate_evaluations FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_gate_evals_release ON public.gate_evaluations(release_id);
CREATE INDEX IF NOT EXISTS idx_gate_evals_run ON public.gate_evaluations(cycle_run_id);

CREATE TABLE IF NOT EXISTS public.release_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  release_id uuid REFERENCES public.releases(id) ON DELETE CASCADE,
  cycle_run_id uuid REFERENCES public.cycle_runs(id) ON DELETE CASCADE,
  deployment_id uuid REFERENCES public.deployments(id) ON DELETE CASCADE,
  verdict text NOT NULL DEFAULT 'pending',
  score numeric(5,2),
  summary text,
  failure_themes jsonb DEFAULT '[]'::jsonb,
  next_actions jsonb DEFAULT '[]'::jsonb,
  metrics jsonb DEFAULT '{}'::jsonb,
  model text,
  feedback_score smallint,
  feedback_note text,
  feedback_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.release_evaluations TO authenticated;
GRANT ALL ON public.release_evaluations TO service_role;
ALTER TABLE public.release_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members manage release evals" ON public.release_evaluations FOR ALL TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_member(workspace_id, auth.uid()));
CREATE TRIGGER trg_release_evals_updated BEFORE UPDATE ON public.release_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.quality_gates;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.gate_evaluations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.release_evaluations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.enqueue_cycle_run_evaluations()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws uuid;
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM NEW.status THEN
    SELECT workspace_id INTO _ws FROM public.projects WHERE id = NEW.project_id;
    IF _ws IS NULL THEN RETURN NEW; END IF;
    INSERT INTO public.jobs(workspace_id, project_id, kind, payload, priority, idempotency_key)
    VALUES (_ws, NEW.project_id, 'evaluate_quality_gates',
            jsonb_build_object('cycle_run_id', NEW.id, 'project_id', NEW.project_id), 50,
            'gate-eval-' || NEW.id::text)
    ON CONFLICT (idempotency_key) DO NOTHING;
    INSERT INTO public.jobs(workspace_id, project_id, kind, payload, priority, idempotency_key)
    VALUES (_ws, NEW.project_id, 'ai_release_judge',
            jsonb_build_object('cycle_run_id', NEW.id, 'project_id', NEW.project_id), 80,
            'ai-judge-' || NEW.id::text)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_enqueue_cycle_run_evals ON public.cycle_runs;
CREATE TRIGGER trg_enqueue_cycle_run_evals AFTER UPDATE ON public.cycle_runs
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_cycle_run_evaluations();
