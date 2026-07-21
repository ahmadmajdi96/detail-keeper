
-- Add new plans matching the Paddle catalog
INSERT INTO public.plans (key, name, monthly_price_cents, yearly_price_cents, entitlements, is_active) VALUES
  ('individual_starter', 'Individual — Starter', 2900, 0, '{"sso": false, "seats": 1, "api_keys": false, "audit_log": false, "max_projects": 3, "max_workspaces": 1, "priority_support": false, "ai_jobs_per_month": 200, "runner_minutes_per_month": 500}'::jsonb, true),
  ('individual_pro', 'Individual — Pro', 4900, 0, '{"sso": false, "seats": 1, "api_keys": true, "audit_log": true, "max_projects": 10, "max_workspaces": 2, "priority_support": false, "ai_jobs_per_month": 500, "runner_minutes_per_month": 2000}'::jsonb, true),
  ('individual_grow', 'Individual — Grow', 9900, 0, '{"sso": false, "seats": 1, "api_keys": true, "audit_log": true, "max_projects": 25, "max_workspaces": 3, "priority_support": true, "ai_jobs_per_month": 2000, "runner_minutes_per_month": 5000}'::jsonb, true),
  ('enterprise_small', 'Enterprise — Small', 15900, 0, '{"sso": true, "seats": 10, "api_keys": true, "audit_log": true, "max_projects": 50, "max_workspaces": 5, "priority_support": true, "ai_jobs_per_month": 5000, "runner_minutes_per_month": 10000}'::jsonb, true),
  ('enterprise_mid', 'Enterprise — Mid', 25900, 0, '{"sso": true, "seats": 25, "api_keys": true, "audit_log": true, "max_projects": null, "max_workspaces": 15, "priority_support": true, "ai_jobs_per_month": 25000, "runner_minutes_per_month": 50000}'::jsonb, true)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  entitlements = EXCLUDED.entitlements,
  is_active = true,
  updated_at = now();

-- Retire the legacy 'pro' and 'enterprise' rows from the visible list (kept for FK integrity)
UPDATE public.plans SET is_active = false WHERE key IN ('pro','enterprise');

-- Add Paddle fields to subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS paddle_subscription_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS paddle_customer_id text,
  ADD COLUMN IF NOT EXISTS paddle_price_id text,
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'sandbox';

CREATE INDEX IF NOT EXISTS idx_subscriptions_paddle_id ON public.subscriptions(paddle_subscription_id);
