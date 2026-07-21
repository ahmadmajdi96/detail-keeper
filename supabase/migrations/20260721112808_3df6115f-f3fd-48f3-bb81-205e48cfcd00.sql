
ALTER TABLE public.test_plans
  ADD COLUMN IF NOT EXISTS ai_progress smallint,
  ADD COLUMN IF NOT EXISTS ai_progress_message text,
  ADD COLUMN IF NOT EXISTS ai_progress_updated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'test_plans'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.test_plans';
  END IF;
END $$;

ALTER TABLE public.test_plans REPLICA IDENTITY FULL;
