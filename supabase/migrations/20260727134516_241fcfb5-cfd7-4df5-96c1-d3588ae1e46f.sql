ALTER TABLE public.test_plans
  ADD COLUMN IF NOT EXISTS ai_dry_run boolean,
  ADD COLUMN IF NOT EXISTS codegen_dry_run boolean;

CREATE TABLE IF NOT EXISTS public.generation_stage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_plan_id uuid NOT NULL REFERENCES public.test_plans(id) ON DELETE CASCADE,
  kind text NOT NULL,
  stage text NOT NULL,
  message text NOT NULL,
  dry_run boolean NOT NULL DEFAULT false,
  install_skipped boolean NOT NULL DEFAULT false,
  execution_skipped boolean NOT NULL DEFAULT false,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generation_stage_logs_plan ON public.generation_stage_logs(test_plan_id, created_at DESC);

GRANT SELECT ON public.generation_stage_logs TO authenticated;
GRANT ALL ON public.generation_stage_logs TO service_role;

ALTER TABLE public.generation_stage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stage logs readable by plan viewers" ON public.generation_stage_logs;
CREATE POLICY "stage logs readable by plan viewers"
  ON public.generation_stage_logs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.test_plans tp
    LEFT JOIN public.projects p ON p.id = tp.project_id
    WHERE tp.id = generation_stage_logs.test_plan_id
      AND public.is_workspace_member(COALESCE(tp.workspace_id, p.workspace_id), auth.uid())
  ));