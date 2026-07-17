
-- B-1/B-4: profile columns for onboarding & terms
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

-- B-2: new orgs get a 14-day Pro trial (backfilled orgs keep whatever they have).
CREATE OR REPLACE FUNCTION public.create_free_subscription_for_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.subscriptions (org_id, plan_key, status, trial_ends_at)
  VALUES (NEW.id, 'pro', 'trialing', now() + interval '14 days')
  ON CONFLICT (org_id) DO NOTHING;
  RETURN NEW;
END $$;

-- Entitlement resolver: trialing → Pro entitlements; expired trial with no paid sub → Free.
CREATE OR REPLACE FUNCTION public.org_entitlements(_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _s public.subscriptions%ROWTYPE;
  _plan_key text;
  _ent jsonb;
BEGIN
  SELECT * INTO _s FROM public.subscriptions WHERE org_id = _org_id LIMIT 1;
  IF NOT FOUND THEN
    SELECT entitlements INTO _ent FROM public.plans WHERE key = 'free';
    RETURN _ent;
  END IF;

  _plan_key := _s.plan_key;

  -- Trial expired with no active paid subscription → fall back to free entitlements
  IF _s.status = 'trialing' AND _s.trial_ends_at IS NOT NULL AND _s.trial_ends_at < now()
     AND _s.stripe_subscription_id IS NULL THEN
    _plan_key := 'free';
  END IF;

  -- Canceled/incomplete/paused with no active period → free
  IF _s.status IN ('canceled', 'unpaid', 'incomplete_expired') THEN
    _plan_key := 'free';
  END IF;

  SELECT entitlements INTO _ent FROM public.plans WHERE key = _plan_key;
  IF _ent IS NULL THEN
    SELECT entitlements INTO _ent FROM public.plans WHERE key = 'free';
  END IF;
  RETURN _ent;
END $$;
