
-- 1) plans
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  monthly_price_cents integer NOT NULL DEFAULT 0,
  yearly_price_cents integer NOT NULL DEFAULT 0,
  entitlements jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO authenticated, anon;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans readable" ON public.plans;
CREATE POLICY "plans readable" ON public.plans FOR SELECT USING (true);

DROP TRIGGER IF EXISTS trg_plans_updated_at ON public.plans;
CREATE TRIGGER trg_plans_updated_at BEFORE UPDATE ON public.plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed plans (idempotent upsert on key)
INSERT INTO public.plans (key, name, monthly_price_cents, yearly_price_cents, entitlements)
VALUES
  ('free', 'Free', 0, 0, jsonb_build_object(
    'seats', 3, 'max_workspaces', 1, 'max_projects', 2,
    'ai_jobs_per_month', 20, 'runner_minutes_per_month', 100,
    'sso', false, 'audit_log', false, 'api_keys', false, 'priority_support', false
  )),
  ('pro', 'Pro', 4900, 47000, jsonb_build_object(
    'seats', 10, 'max_workspaces', 5, 'max_projects', 100,
    'ai_jobs_per_month', 500, 'runner_minutes_per_month', 2000,
    'sso', false, 'audit_log', true, 'api_keys', true, 'priority_support', false
  )),
  ('enterprise', 'Enterprise', 19900, 199000, jsonb_build_object(
    'seats', null, 'max_workspaces', null, 'max_projects', null,
    'ai_jobs_per_month', null, 'runner_minutes_per_month', null,
    'sso', true, 'audit_log', true, 'api_keys', true, 'priority_support', true
  ))
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  yearly_price_cents = EXCLUDED.yearly_price_cents,
  entitlements = EXCLUDED.entitlements,
  is_active = true;

-- 2) subscriptions
DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_key text NOT NULL REFERENCES public.plans(key),
  status public.subscription_status NOT NULL DEFAULT 'active',
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  trial_ends_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members read subscription" ON public.subscriptions;
CREATE POLICY "org members read subscription" ON public.subscriptions
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "org owner update subscription" ON public.subscriptions;
CREATE POLICY "org owner update subscription" ON public.subscriptions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.organizations WHERE id = org_id AND owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.organizations WHERE id = org_id AND owner_id = auth.uid())
  );

DROP TRIGGER IF EXISTS trg_subs_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subs_updated_at BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) usage_events
CREATE TABLE IF NOT EXISTS public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usage_events_org_kind_time
  ON public.usage_events (org_id, kind, occurred_at DESC);

GRANT SELECT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members read usage" ON public.usage_events;
CREATE POLICY "org members read usage" ON public.usage_events
  FOR SELECT USING (public.is_org_member(org_id));

-- 4) backfill subscriptions for existing orgs
INSERT INTO public.subscriptions (org_id, plan_key, status, current_period_start, current_period_end)
SELECT o.id, 'free', 'active', now(), now() + interval '30 days'
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.org_id = o.id);

-- Trigger: auto-create free subscription for new orgs
CREATE OR REPLACE FUNCTION public.create_free_subscription_for_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.subscriptions (org_id, plan_key, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (org_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_org_free_subscription ON public.organizations;
CREATE TRIGGER trg_org_free_subscription
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.create_free_subscription_for_org();

-- 5) helper functions
CREATE OR REPLACE FUNCTION public.org_entitlements(_org_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.entitlements
  FROM public.subscriptions s
  JOIN public.plans p ON p.key = s.plan_key
  WHERE s.org_id = _org_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.org_usage_this_period(_org_id uuid, _kind text)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(quantity), 0)::numeric
  FROM public.usage_events ue
  JOIN public.subscriptions s ON s.org_id = ue.org_id
  WHERE ue.org_id = _org_id
    AND ue.kind = _kind
    AND ue.occurred_at >= s.current_period_start
$$;

CREATE OR REPLACE FUNCTION public.can_use_feature(_org_id uuid, _feature text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((public.org_entitlements(_org_id) ->> _feature)::boolean, false)
$$;

CREATE OR REPLACE FUNCTION public.within_quota(_org_id uuid, _kind text, _additional numeric DEFAULT 0)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _entitlement_key text;
  _limit_val numeric;
  _used numeric;
BEGIN
  _entitlement_key := CASE _kind
    WHEN 'ai_job' THEN 'ai_jobs_per_month'
    WHEN 'runner_minutes' THEN 'runner_minutes_per_month'
    WHEN 'seats' THEN 'seats'
    WHEN 'workspaces' THEN 'max_workspaces'
    WHEN 'projects' THEN 'max_projects'
    ELSE _kind
  END;

  _limit_val := NULLIF(public.org_entitlements(_org_id) ->> _entitlement_key, '')::numeric;
  IF _limit_val IS NULL THEN RETURN true; END IF;

  IF _kind IN ('ai_job','runner_minutes') THEN
    _used := public.org_usage_this_period(_org_id, _kind);
  ELSIF _kind = 'seats' THEN
    _used := (SELECT count(*) FROM public.organization_members WHERE org_id = _org_id);
  ELSIF _kind = 'workspaces' THEN
    _used := (SELECT count(*) FROM public.workspaces WHERE organization_id = _org_id);
  ELSIF _kind = 'projects' THEN
    _used := (SELECT count(*) FROM public.projects p
              JOIN public.workspaces w ON w.id = p.workspace_id
              WHERE w.organization_id = _org_id);
  ELSE
    _used := 0;
  END IF;

  RETURN (_used + COALESCE(_additional, 0)) <= _limit_val;
END $$;

GRANT EXECUTE ON FUNCTION public.org_entitlements(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_usage_this_period(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_use_feature(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.within_quota(uuid, text, numeric) TO authenticated;
