
-- Enable pg_net + pgcrypto for outbound webhook dispatch and HMAC/hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ========== API KEYS ==========
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys manage by org owner/admin"
  ON public.api_keys FOR ALL TO authenticated
  USING (public.org_role_of(org_id) IN ('owner','billing_admin','security_admin'))
  WITH CHECK (public.org_role_of(org_id) IN ('owner','billing_admin','security_admin'));

CREATE INDEX idx_api_keys_org ON public.api_keys(org_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_hash ON public.api_keys(key_hash) WHERE revoked_at IS NULL;

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== WEBHOOK ENDPOINTS ==========
CREATE TABLE public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Webhook',
  url text NOT NULL,
  secret text NOT NULL,
  event_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_endpoints TO authenticated;
GRANT ALL ON public.webhook_endpoints TO service_role;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_endpoints manage by org admin"
  ON public.webhook_endpoints FOR ALL TO authenticated
  USING (public.org_role_of(org_id) IN ('owner','billing_admin','security_admin'))
  WITH CHECK (public.org_role_of(org_id) IN ('owner','billing_admin','security_admin'));

CREATE TRIGGER update_webhook_endpoints_updated_at BEFORE UPDATE ON public.webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== WEBHOOK DELIVERIES ==========
CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  response_code integer,
  response_body text,
  attempts integer NOT NULL DEFAULT 0,
  last_attempt_at timestamptz,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_deliveries visible via endpoint"
  ON public.webhook_deliveries FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.webhook_endpoints e
    WHERE e.id = endpoint_id
      AND public.org_role_of(e.org_id) IN ('owner','billing_admin','security_admin')
  ));

CREATE INDEX idx_webhook_deliveries_endpoint ON public.webhook_deliveries(endpoint_id, created_at DESC);
CREATE INDEX idx_webhook_deliveries_pending ON public.webhook_deliveries(status, next_retry_at)
  WHERE status IN ('pending','retrying');

-- ========== DISPATCH HELPER ==========
-- Enqueue deliveries and fire pg_net POST with HMAC-SHA256 signature per matching endpoint
CREATE OR REPLACE FUNCTION public.emit_webhook(_org_id uuid, _workspace_id uuid, _event text, _payload jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _ep record;
  _delivery_id uuid;
  _body text;
  _sig text;
  _ts text;
BEGIN
  _ts := extract(epoch from now())::bigint::text;
  FOR _ep IN
    SELECT * FROM public.webhook_endpoints
     WHERE org_id = _org_id AND enabled = true
       AND _event = ANY(event_types)
       AND (workspace_id IS NULL OR _workspace_id IS NULL OR workspace_id = _workspace_id)
  LOOP
    INSERT INTO public.webhook_deliveries (endpoint_id, event_type, payload, status)
    VALUES (_ep.id, _event, _payload, 'pending')
    RETURNING id INTO _delivery_id;

    _body := jsonb_build_object(
      'id', _delivery_id,
      'event', _event,
      'timestamp', _ts,
      'org_id', _org_id,
      'workspace_id', _workspace_id,
      'data', _payload
    )::text;
    _sig := encode(hmac(_ts || '.' || _body, _ep.secret, 'sha256'), 'hex');

    BEGIN
      PERFORM net.http_post(
        url := _ep.url,
        body := _body::jsonb,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Qualixa-Event', _event,
          'X-Qualixa-Timestamp', _ts,
          'X-Qualixa-Signature', 't=' || _ts || ',v1=' || _sig,
          'X-Qualixa-Delivery', _delivery_id::text
        ),
        timeout_milliseconds := 8000
      );
      UPDATE public.webhook_deliveries
         SET status = 'dispatched', attempts = attempts + 1, last_attempt_at = now()
       WHERE id = _delivery_id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.webhook_deliveries
         SET status = 'failed', attempts = attempts + 1,
             last_attempt_at = now(), response_body = SQLERRM,
             next_retry_at = now() + interval '1 minute'
       WHERE id = _delivery_id;
    END;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.emit_webhook(uuid, uuid, text, jsonb) TO authenticated, service_role;

-- ========== EVENT TRIGGERS ==========
-- 1. defect.created
CREATE OR REPLACE FUNCTION public.emit_defect_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws uuid; _org uuid;
BEGIN
  SELECT workspace_id INTO _ws FROM public.projects WHERE id = NEW.project_id;
  _org := public.org_of_workspace(_ws);
  IF _org IS NOT NULL THEN
    PERFORM public.emit_webhook(_org, _ws, 'defect.created',
      jsonb_build_object('defect_id', NEW.id, 'project_id', NEW.project_id,
                         'title', NEW.title, 'severity', NEW.severity, 'priority', NEW.priority,
                         'reported_by', NEW.reported_by));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_emit_defect_created ON public.defects;
CREATE TRIGGER trg_emit_defect_created AFTER INSERT ON public.defects
  FOR EACH ROW EXECUTE FUNCTION public.emit_defect_created();

-- 2. defect.assigned
CREATE OR REPLACE FUNCTION public.emit_defect_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws uuid; _org uuid;
BEGIN
  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to <> NEW.assigned_to) THEN
    SELECT workspace_id INTO _ws FROM public.projects WHERE id = NEW.project_id;
    _org := public.org_of_workspace(_ws);
    IF _org IS NOT NULL THEN
      PERFORM public.emit_webhook(_org, _ws, 'defect.assigned',
        jsonb_build_object('defect_id', NEW.id, 'project_id', NEW.project_id,
                           'assigned_to', NEW.assigned_to, 'title', NEW.title));
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_emit_defect_assigned ON public.defects;
CREATE TRIGGER trg_emit_defect_assigned AFTER UPDATE ON public.defects
  FOR EACH ROW EXECUTE FUNCTION public.emit_defect_assigned();

-- 3. run.finished (cycle_runs)
CREATE OR REPLACE FUNCTION public.emit_run_finished()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws uuid; _org uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('completed','failed','cancelled') THEN
    SELECT workspace_id INTO _ws FROM public.projects WHERE id = NEW.project_id;
    _org := public.org_of_workspace(_ws);
    IF _org IS NOT NULL THEN
      PERFORM public.emit_webhook(_org, _ws, 'run.finished',
        jsonb_build_object('cycle_run_id', NEW.id, 'cycle_id', NEW.cycle_id,
                           'project_id', NEW.project_id, 'status', NEW.status));
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_emit_run_finished ON public.cycle_runs;
CREATE TRIGGER trg_emit_run_finished AFTER UPDATE ON public.cycle_runs
  FOR EACH ROW EXECUTE FUNCTION public.emit_run_finished();

-- 4. gate.blocked
CREATE OR REPLACE FUNCTION public.emit_gate_blocked()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws uuid; _org uuid; _proj uuid;
BEGIN
  IF NEW.status IN ('blocked','failed') THEN
    SELECT project_id INTO _proj FROM public.cycle_runs WHERE id = NEW.cycle_run_id;
    IF _proj IS NOT NULL THEN
      SELECT workspace_id INTO _ws FROM public.projects WHERE id = _proj;
      _org := public.org_of_workspace(_ws);
      IF _org IS NOT NULL THEN
        PERFORM public.emit_webhook(_org, _ws, 'gate.blocked',
          jsonb_build_object('gate_evaluation_id', NEW.id, 'cycle_run_id', NEW.cycle_run_id,
                             'project_id', _proj, 'status', NEW.status));
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_emit_gate_blocked ON public.gate_evaluations;
CREATE TRIGGER trg_emit_gate_blocked AFTER INSERT ON public.gate_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.emit_gate_blocked();

-- 5. release.verdict
CREATE OR REPLACE FUNCTION public.emit_release_verdict()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws uuid; _org uuid; _proj uuid;
BEGIN
  SELECT project_id INTO _proj FROM public.cycle_runs WHERE id = NEW.cycle_run_id;
  IF _proj IS NOT NULL THEN
    SELECT workspace_id INTO _ws FROM public.projects WHERE id = _proj;
    _org := public.org_of_workspace(_ws);
    IF _org IS NOT NULL THEN
      PERFORM public.emit_webhook(_org, _ws, 'release.verdict', to_jsonb(NEW));
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_emit_release_verdict ON public.release_evaluations;
CREATE TRIGGER trg_emit_release_verdict AFTER INSERT ON public.release_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.emit_release_verdict();

-- 6. testplan.generated
CREATE OR REPLACE FUNCTION public.emit_testplan_generated()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws uuid; _org uuid;
BEGIN
  IF (NEW.status IS DISTINCT FROM OLD.status) AND NEW.status IN ('ready','generated','completed') THEN
    _ws := COALESCE(NEW.workspace_id, (SELECT workspace_id FROM public.projects WHERE id = NEW.project_id));
    _org := public.org_of_workspace(_ws);
    IF _org IS NOT NULL THEN
      PERFORM public.emit_webhook(_org, _ws, 'testplan.generated',
        jsonb_build_object('test_plan_id', NEW.id, 'name', NEW.name, 'status', NEW.status,
                           'project_id', NEW.project_id));
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_emit_testplan_generated ON public.test_plans;
CREATE TRIGGER trg_emit_testplan_generated AFTER UPDATE ON public.test_plans
  FOR EACH ROW EXECUTE FUNCTION public.emit_testplan_generated();
