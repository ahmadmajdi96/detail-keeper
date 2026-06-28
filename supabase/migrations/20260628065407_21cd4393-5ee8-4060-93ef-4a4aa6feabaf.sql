
DROP TRIGGER IF EXISTS trg_notify_defect_assignment ON public.defects;
CREATE TRIGGER trg_notify_defect_assignment
AFTER UPDATE OF assigned_to ON public.defects
FOR EACH ROW EXECUTE FUNCTION public.notify_defect_assignment();

DROP TRIGGER IF EXISTS trg_notify_execution_completion ON public.test_executions;
CREATE TRIGGER trg_notify_execution_completion
AFTER UPDATE OF status ON public.test_executions
FOR EACH ROW EXECUTE FUNCTION public.notify_execution_completion();

CREATE OR REPLACE FUNCTION public.notify_workspace_managers(
  _workspace uuid, _type text, _title text, _message text, _data jsonb, _exclude uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, data)
  SELECT DISTINCT wm.user_id, _type, _title, _message, _data
  FROM public.workspace_members wm
  JOIN public.profiles p ON p.id = wm.user_id
  WHERE wm.workspace_id = _workspace
    AND wm.role IN ('owner','admin')
    AND p.role IN ('admin','qa_manager','qa_engineer')
    AND (_exclude IS NULL OR wm.user_id <> _exclude);
END; $$;

CREATE OR REPLACE FUNCTION public.notify_defect_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws uuid;
BEGIN
  SELECT workspace_id INTO _ws FROM public.projects WHERE id = NEW.project_id;
  IF _ws IS NOT NULL THEN
    PERFORM public.notify_workspace_managers(
      _ws, 'defect_created', 'New Defect: ' || NEW.title,
      COALESCE(NEW.severity::text,'') || ' severity reported',
      jsonb_build_object('defect_id', NEW.id, 'project_id', NEW.project_id, 'severity', NEW.severity),
      NEW.reporter_id);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_defect_created ON public.defects;
CREATE TRIGGER trg_notify_defect_created AFTER INSERT ON public.defects
FOR EACH ROW EXECUTE FUNCTION public.notify_defect_created();

CREATE OR REPLACE FUNCTION public.notify_defect_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.reporter_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (NEW.reporter_id, 'defect_status', 'Defect status: ' || NEW.status,
              NEW.title || ' moved to ' || NEW.status,
              jsonb_build_object('defect_id', NEW.id, 'status', NEW.status));
    END IF;
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to <> COALESCE(NEW.reporter_id, '00000000-0000-0000-0000-000000000000') THEN
      INSERT INTO public.notifications (user_id, type, title, message, data)
      VALUES (NEW.assigned_to, 'defect_status', 'Defect status: ' || NEW.status,
              NEW.title || ' moved to ' || NEW.status,
              jsonb_build_object('defect_id', NEW.id, 'status', NEW.status));
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_defect_status ON public.defects;
CREATE TRIGGER trg_notify_defect_status AFTER UPDATE OF status ON public.defects
FOR EACH ROW EXECUTE FUNCTION public.notify_defect_status_change();

CREATE OR REPLACE FUNCTION public.notify_project_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_workspace_managers(
    NEW.workspace_id, 'project_created', 'New Project: ' || NEW.name,
    'A new project was added to the workspace',
    jsonb_build_object('project_id', NEW.id, 'workspace_id', NEW.workspace_id, 'source', NEW.source_type),
    NEW.created_by);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_project_created ON public.projects;
CREATE TRIGGER trg_notify_project_created AFTER INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.notify_project_created();

CREATE OR REPLACE FUNCTION public.notify_project_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('ready','failed') THEN
    PERFORM public.notify_workspace_managers(
      NEW.workspace_id,
      CASE WHEN NEW.status='ready' THEN 'project_ready' ELSE 'project_failed' END,
      CASE WHEN NEW.status='ready' THEN 'Project ready: ' || NEW.name ELSE 'Project failed: ' || NEW.name END,
      COALESCE(NEW.process_error, 'Processing complete'),
      jsonb_build_object('project_id', NEW.id, 'status', NEW.status), NULL);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_project_status ON public.projects;
CREATE TRIGGER trg_notify_project_status AFTER UPDATE OF status ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.notify_project_status();

CREATE OR REPLACE FUNCTION public.notify_document_ready()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('processed','failed') THEN
    SELECT workspace_id INTO _ws FROM public.projects WHERE id = NEW.project_id;
    IF _ws IS NOT NULL THEN
      PERFORM public.notify_workspace_managers(_ws,
        CASE WHEN NEW.status='processed' THEN 'document_ready' ELSE 'document_failed' END,
        CASE WHEN NEW.status='processed' THEN 'Document processed: ' || COALESCE(NEW.name,'Untitled')
             ELSE 'Document failed: ' || COALESCE(NEW.name,'Untitled') END,
        'AI extraction ' || NEW.status,
        jsonb_build_object('document_id', NEW.id, 'project_id', NEW.project_id), NULL);
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_document_ready ON public.documents;
CREATE TRIGGER trg_notify_document_ready AFTER UPDATE OF status ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.notify_document_ready();

CREATE OR REPLACE FUNCTION public.notify_workspace_member_added()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _wsname text;
BEGIN
  SELECT name INTO _wsname FROM public.workspaces WHERE id = NEW.workspace_id;
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (NEW.user_id, 'workspace_invite',
          'Added to workspace: ' || COALESCE(_wsname,''),
          'You were added as ' || NEW.role,
          jsonb_build_object('workspace_id', NEW.workspace_id, 'role', NEW.role));
  PERFORM public.notify_workspace_managers(
    NEW.workspace_id, 'member_added',
    'New member in ' || COALESCE(_wsname,''),
    'A new member joined as ' || NEW.role,
    jsonb_build_object('workspace_id', NEW.workspace_id, 'user_id', NEW.user_id, 'role', NEW.role),
    NEW.user_id);
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_workspace_member_added ON public.workspace_members;
CREATE TRIGGER trg_notify_workspace_member_added AFTER INSERT ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.notify_workspace_member_added();

CREATE OR REPLACE FUNCTION public.notify_test_plan_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws uuid;
BEGIN
  SELECT workspace_id INTO _ws FROM public.projects WHERE id = NEW.project_id;
  IF _ws IS NOT NULL THEN
    PERFORM public.notify_workspace_managers(_ws, 'test_plan_created',
      'New test plan: ' || NEW.name,
      COALESCE(NEW.description, 'A new test plan was created'),
      jsonb_build_object('test_plan_id', NEW.id, 'project_id', NEW.project_id),
      NEW.created_by);
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_test_plan_created ON public.test_plans;
CREATE TRIGGER trg_notify_test_plan_created AFTER INSERT ON public.test_plans
FOR EACH ROW EXECUTE FUNCTION public.notify_test_plan_created();

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
