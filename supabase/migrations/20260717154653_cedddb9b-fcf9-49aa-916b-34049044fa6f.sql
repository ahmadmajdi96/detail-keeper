
-- SSO connections
CREATE TABLE IF NOT EXISTS public.sso_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('saml','oidc')),
  display_name text,
  domains text[] NOT NULL DEFAULT '{}',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT false,
  supabase_provider_id text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sso_connections_org ON public.sso_connections(org_id);
CREATE INDEX IF NOT EXISTS idx_sso_connections_domains ON public.sso_connections USING GIN(domains);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sso_connections TO authenticated;
GRANT ALL ON public.sso_connections TO service_role;

ALTER TABLE public.sso_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "SSO manageable by org owner/security_admin"
  ON public.sso_connections FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = org_id AND o.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.organization_members m WHERE m.org_id = sso_connections.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','security_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = org_id AND o.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.organization_members m WHERE m.org_id = sso_connections.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','security_admin'))
  );

CREATE TRIGGER trg_sso_connections_updated_at
  BEFORE UPDATE ON public.sso_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Deletion requests (audit trail before hard-delete)
CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('organization','account')),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','completed','cancelled','failed')),
  reason text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.deletion_requests TO authenticated;
GRANT ALL ON public.deletion_requests TO service_role;

ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requester or org admin can view deletion requests"
  ON public.deletion_requests FOR SELECT
  USING (
    requested_by = auth.uid()
    OR user_id = auth.uid()
    OR (org_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organizations o WHERE o.id = org_id AND o.owner_id = auth.uid()
    ))
    OR (org_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_members m WHERE m.org_id = deletion_requests.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','security_admin')
    ))
  );

CREATE POLICY "Authenticated users can insert their own deletion request"
  ON public.deletion_requests FOR INSERT
  WITH CHECK (requested_by = auth.uid());

-- Helper: resolve org by email domain via enabled SSO connections
CREATE OR REPLACE FUNCTION public.org_for_sso_domain(_domain text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.sso_connections
  WHERE enabled = true AND _domain = ANY(domains)
  ORDER BY created_at ASC
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.org_for_sso_domain(text) TO authenticated, anon, service_role;
