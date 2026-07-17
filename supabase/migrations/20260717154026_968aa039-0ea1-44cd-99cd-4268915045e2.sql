-- 1. Organizations: require_mfa toggle
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS require_mfa boolean NOT NULL DEFAULT false;

-- 2. audit_logs: add org_id + meta
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS audit_logs_org_id_created_at_idx
  ON public.audit_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx
  ON public.audit_logs(actor_id);

-- Backfill org_id from workspaces
UPDATE public.audit_logs a
   SET org_id = w.organization_id
  FROM public.workspaces w
 WHERE a.workspace_id = w.id
   AND a.org_id IS NULL
   AND w.organization_id IS NOT NULL;

-- Broaden RLS: org owner/security_admin OR existing workspace-member rule
DROP POLICY IF EXISTS "audit ws read" ON public.audit_logs;
CREATE POLICY "audit read"
  ON public.audit_logs FOR SELECT
  USING (
    (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
    OR (
      org_id IS NOT NULL
      AND public.org_role_of(org_id) IN ('owner'::public.org_role, 'security_admin'::public.org_role)
    )
  );

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

-- 3. MFA recovery codes
CREATE TABLE IF NOT EXISTS public.mfa_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mfa_recovery_codes_user_id_idx ON public.mfa_recovery_codes(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mfa_recovery_codes TO authenticated;
GRANT ALL ON public.mfa_recovery_codes TO service_role;
ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own recovery codes" ON public.mfa_recovery_codes;
CREATE POLICY "own recovery codes"
  ON public.mfa_recovery_codes FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. log_audit helper
CREATE OR REPLACE FUNCTION public.log_audit(
  _org_id uuid,
  _workspace_id uuid,
  _action text,
  _entity_kind text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _meta jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.audit_logs
    (org_id, workspace_id, actor_id, action, entity_kind, entity_id, meta)
  VALUES
    (_org_id, _workspace_id, auth.uid(), _action, _entity_kind, _entity_id, COALESCE(_meta, '{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END $$;

GRANT EXECUTE ON FUNCTION public.log_audit(uuid, uuid, text, text, uuid, jsonb) TO authenticated, service_role;

-- Helper to resolve org from workspace
CREATE OR REPLACE FUNCTION public.org_of_workspace(_ws uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.workspaces WHERE id = _ws
$$;
GRANT EXECUTE ON FUNCTION public.org_of_workspace(uuid) TO authenticated, service_role;

-- 5. Trigger functions for audit
CREATE OR REPLACE FUNCTION public.trg_audit_workspace_members()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _org := public.org_of_workspace(NEW.workspace_id);
    PERFORM public.log_audit(_org, NEW.workspace_id, 'workspace.member.added', 'workspace_member', NEW.user_id,
      jsonb_build_object('role', NEW.role));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      _org := public.org_of_workspace(NEW.workspace_id);
      PERFORM public.log_audit(_org, NEW.workspace_id, 'workspace.member.role_changed', 'workspace_member', NEW.user_id,
        jsonb_build_object('from', OLD.role, 'to', NEW.role));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    _org := public.org_of_workspace(OLD.workspace_id);
    PERFORM public.log_audit(_org, OLD.workspace_id, 'workspace.member.removed', 'workspace_member', OLD.user_id,
      jsonb_build_object('role', OLD.role));
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_audit_workspace_members ON public.workspace_members;
CREATE TRIGGER trg_audit_workspace_members
  AFTER INSERT OR UPDATE OR DELETE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_workspace_members();

CREATE OR REPLACE FUNCTION public.trg_audit_org_members()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_audit(NEW.org_id, NULL, 'org.member.added', 'org_member', NEW.user_id,
      jsonb_build_object('role', NEW.role));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      PERFORM public.log_audit(NEW.org_id, NULL, 'org.member.role_changed', 'org_member', NEW.user_id,
        jsonb_build_object('from', OLD.role, 'to', NEW.role));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_audit(OLD.org_id, NULL, 'org.member.removed', 'org_member', OLD.user_id,
      jsonb_build_object('role', OLD.role));
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_audit_org_members ON public.organization_members;
CREATE TRIGGER trg_audit_org_members
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_org_members();

CREATE OR REPLACE FUNCTION public.trg_audit_project_members()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws uuid; _org uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT workspace_id INTO _ws FROM public.projects WHERE id = NEW.project_id;
    _org := public.org_of_workspace(_ws);
    PERFORM public.log_audit(_org, _ws, 'project.member.added', 'project_member', NEW.user_id,
      jsonb_build_object('project_id', NEW.project_id, 'role', NEW.role));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      SELECT workspace_id INTO _ws FROM public.projects WHERE id = NEW.project_id;
      _org := public.org_of_workspace(_ws);
      PERFORM public.log_audit(_org, _ws, 'project.member.role_changed', 'project_member', NEW.user_id,
        jsonb_build_object('project_id', NEW.project_id, 'from', OLD.role, 'to', NEW.role));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT workspace_id INTO _ws FROM public.projects WHERE id = OLD.project_id;
    _org := public.org_of_workspace(_ws);
    PERFORM public.log_audit(_org, _ws, 'project.member.removed', 'project_member', OLD.user_id,
      jsonb_build_object('project_id', OLD.project_id, 'role', OLD.role));
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_audit_project_members ON public.project_members;
CREATE TRIGGER trg_audit_project_members
  AFTER INSERT OR UPDATE OR DELETE ON public.project_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_project_members();

CREATE OR REPLACE FUNCTION public.trg_audit_plan_assignees()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws uuid; _org uuid; _proj uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT project_id, workspace_id INTO _proj, _ws FROM public.test_plans WHERE id = NEW.test_plan_id;
    IF _ws IS NULL AND _proj IS NOT NULL THEN
      SELECT workspace_id INTO _ws FROM public.projects WHERE id = _proj;
    END IF;
    _org := public.org_of_workspace(_ws);
    PERFORM public.log_audit(_org, _ws, 'plan.assignee.added', 'plan_assignee', NEW.user_id,
      jsonb_build_object('test_plan_id', NEW.test_plan_id, 'role', NEW.role));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
    SELECT project_id, workspace_id INTO _proj, _ws FROM public.test_plans WHERE id = NEW.test_plan_id;
    IF _ws IS NULL AND _proj IS NOT NULL THEN
      SELECT workspace_id INTO _ws FROM public.projects WHERE id = _proj;
    END IF;
    _org := public.org_of_workspace(_ws);
    PERFORM public.log_audit(_org, _ws, 'plan.assignee.role_changed', 'plan_assignee', NEW.user_id,
      jsonb_build_object('test_plan_id', NEW.test_plan_id, 'from', OLD.role, 'to', NEW.role));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT project_id, workspace_id INTO _proj, _ws FROM public.test_plans WHERE id = OLD.test_plan_id;
    IF _ws IS NULL AND _proj IS NOT NULL THEN
      SELECT workspace_id INTO _ws FROM public.projects WHERE id = _proj;
    END IF;
    _org := public.org_of_workspace(_ws);
    PERFORM public.log_audit(_org, _ws, 'plan.assignee.removed', 'plan_assignee', OLD.user_id,
      jsonb_build_object('test_plan_id', OLD.test_plan_id, 'role', OLD.role));
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_audit_plan_assignees ON public.test_plan_assignees;
CREATE TRIGGER trg_audit_plan_assignees
  AFTER INSERT OR UPDATE OR DELETE ON public.test_plan_assignees
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_plan_assignees();

CREATE OR REPLACE FUNCTION public.trg_audit_invitations()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid; _act text;
BEGIN
  _org := public.org_of_workspace(COALESCE(NEW.workspace_id, OLD.workspace_id));
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_audit(_org, NEW.workspace_id, 'invitation.created', 'invitation', NEW.id,
      jsonb_build_object('email', NEW.email, 'role', NEW.role));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    _act := CASE NEW.status WHEN 'accepted' THEN 'invitation.accepted' WHEN 'revoked' THEN 'invitation.revoked' ELSE 'invitation.status_changed' END;
    PERFORM public.log_audit(_org, NEW.workspace_id, _act, 'invitation', NEW.id,
      jsonb_build_object('email', NEW.email, 'role', NEW.role, 'status', NEW.status));
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_invitations ON public.workspace_invitations;
CREATE TRIGGER trg_audit_invitations
  AFTER INSERT OR UPDATE ON public.workspace_invitations
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_invitations();

CREATE OR REPLACE FUNCTION public.trg_audit_project_visibility()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid;
BEGIN
  IF NEW.visibility IS DISTINCT FROM OLD.visibility THEN
    _org := public.org_of_workspace(NEW.workspace_id);
    PERFORM public.log_audit(_org, NEW.workspace_id, 'project.visibility_changed', 'project', NEW.id,
      jsonb_build_object('from', OLD.visibility, 'to', NEW.visibility, 'project_name', NEW.name));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_project_visibility ON public.projects;
CREATE TRIGGER trg_audit_project_visibility
  AFTER UPDATE OF visibility ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_project_visibility();

CREATE OR REPLACE FUNCTION public.trg_audit_subscriptions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_audit(NEW.org_id, NULL, 'billing.subscription.created', 'subscription', NEW.id,
      jsonb_build_object('plan_key', NEW.plan_key, 'status', NEW.status));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.plan_key IS DISTINCT FROM OLD.plan_key OR NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM public.log_audit(NEW.org_id, NULL, 'billing.subscription.updated', 'subscription', NEW.id,
        jsonb_build_object('plan_from', OLD.plan_key, 'plan_to', NEW.plan_key, 'status_from', OLD.status, 'status_to', NEW.status));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_audit_subscriptions ON public.subscriptions;
CREATE TRIGGER trg_audit_subscriptions
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_subscriptions();