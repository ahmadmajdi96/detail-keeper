
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS notification_config JSONB NOT NULL DEFAULT '{"email": true, "slack": false, "categories": {"workspace_created": true, "project_created": true, "test_plan_created": true, "member_added": true}}'::jsonb,
  ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS slack_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS slack_channel_name TEXT;

-- Workspace created notification trigger
CREATE OR REPLACE FUNCTION public.notify_workspace_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      NEW.owner_id, 'workspace_created',
      'Workspace created: ' || NEW.name,
      COALESCE(NEW.description, 'Your new workspace is ready.'),
      jsonb_build_object('workspace_id', NEW.id, 'link', '/workspaces/' || NEW.id::text)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_workspace_created ON public.workspaces;
CREATE TRIGGER trg_notify_workspace_created
AFTER INSERT ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.notify_workspace_created();
