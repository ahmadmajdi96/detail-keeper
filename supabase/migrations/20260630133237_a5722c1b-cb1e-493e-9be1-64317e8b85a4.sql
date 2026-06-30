CREATE OR REPLACE FUNCTION public.notify_defect_created()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _ws uuid;
BEGIN
  SELECT workspace_id INTO _ws FROM public.projects WHERE id = NEW.project_id;
  IF _ws IS NOT NULL THEN
    PERFORM public.notify_workspace_managers(
      _ws, 'defect_created', 'New Defect: ' || NEW.title,
      COALESCE(NEW.severity::text,'') || ' severity reported',
      jsonb_build_object('defect_id', NEW.id, 'project_id', NEW.project_id, 'severity', NEW.severity),
      NEW.reported_by);
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.notify_defect_status_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.reported_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (NEW.reported_by, 'defect_status', 'Defect status: ' || NEW.status,
              NEW.title || ' moved to ' || NEW.status,
              jsonb_build_object('defect_id', NEW.id, 'status', NEW.status));
    END IF;
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to <> COALESCE(NEW.reported_by, '00000000-0000-0000-0000-000000000000') THEN
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (NEW.assigned_to, 'defect_status', 'Defect status: ' || NEW.status,
              NEW.title || ' moved to ' || NEW.status,
              jsonb_build_object('defect_id', NEW.id, 'status', NEW.status));
    END IF;
  END IF;
  RETURN NEW;
END $function$;