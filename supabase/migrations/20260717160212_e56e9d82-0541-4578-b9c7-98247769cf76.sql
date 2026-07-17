
-- Notification preferences on profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT
    '{"email":true,"slack":false,"in_app":true,"categories":{"defect_assigned":true,"defect_created":true,"run_finished":true,"gate_blocked":true,"release_verdict":true,"testplan_generated":true}}'::jsonb,
  ADD COLUMN IF NOT EXISTS slack_webhook_url text;

-- Workspace-level Slack webhook fallback
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS slack_webhook_url text;

-- Trigger: on new notification, fire-and-forget to dispatch-notification edge function
CREATE OR REPLACE FUNCTION public.emit_notification_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url text;
  _anon text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO _url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN _url := NULL; END;
  IF _url IS NULL THEN
    _url := current_setting('app.settings.supabase_url', true);
  END IF;
  IF _url IS NULL THEN RETURN NEW; END IF;

  BEGIN
    SELECT decrypted_secret INTO _anon FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN _anon := NULL; END;

  PERFORM net.http_post(
    url := _url || '/functions/v1/dispatch-notification',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || COALESCE(_anon,'')
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never fail the insert due to dispatch issues
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_emit_notification_dispatch ON public.notifications;
CREATE TRIGGER trg_emit_notification_dispatch
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.emit_notification_dispatch();
