
CREATE OR REPLACE FUNCTION public.notify_document_ready()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _ws uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('processed','failed') THEN
    SELECT workspace_id INTO _ws FROM public.projects WHERE id = NEW.project_id;
    IF _ws IS NOT NULL THEN
      PERFORM public.notify_workspace_managers(_ws,
        CASE WHEN NEW.status='processed' THEN 'document_ready' ELSE 'document_failed' END,
        CASE WHEN NEW.status='processed' THEN 'Document processed: ' || COALESCE(NEW.filename,'Untitled')
             ELSE 'Document failed: ' || COALESCE(NEW.filename,'Untitled') END,
        'AI extraction ' || NEW.status,
        jsonb_build_object('document_id', NEW.id, 'project_id', NEW.project_id), NULL);
    END IF;
  END IF;
  RETURN NEW;
END; $function$;

-- Unstick any documents that were previously stuck in "processing" because of the trigger error
UPDATE public.documents SET status = 'failed' WHERE status = 'processing' AND created_at < now() - interval '1 minute';
