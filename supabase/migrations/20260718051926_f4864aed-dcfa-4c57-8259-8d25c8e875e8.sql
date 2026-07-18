CREATE TABLE IF NOT EXISTS public.share_link_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_link_id uuid REFERENCES public.share_links(id) ON DELETE SET NULL,
  token text NOT NULL,
  resource_type text,
  resource_id uuid,
  granted boolean NOT NULL DEFAULT false,
  reason text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS share_link_views_token_time_idx
  ON public.share_link_views (token, created_at DESC);
CREATE INDEX IF NOT EXISTS share_link_views_link_idx
  ON public.share_link_views (share_link_id, created_at DESC);

GRANT SELECT ON public.share_link_views TO authenticated;
GRANT ALL ON public.share_link_views TO service_role;

ALTER TABLE public.share_link_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org admins can view share link views"
ON public.share_link_views
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.share_links sl
    WHERE sl.id = share_link_views.share_link_id
      AND (
        EXISTS (SELECT 1 FROM public.organizations o
                 WHERE o.id = sl.org_id AND o.owner_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.organization_members om
                    WHERE om.org_id = sl.org_id
                      AND om.user_id = auth.uid()
                      AND om.role IN ('owner','security_admin'))
      )
  )
);

CREATE OR REPLACE FUNCTION public.resolve_share_link(
  _token text,
  _user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sl public.share_links%ROWTYPE;
  _payload jsonb;
  _recent_count int;
  _rate_limit int := 60;
  _rate_window interval := interval '1 minute';
  _reason text;
BEGIN
  SELECT count(*) INTO _recent_count
    FROM public.share_link_views
   WHERE token = _token AND created_at > now() - _rate_window;

  IF _recent_count >= _rate_limit THEN
    INSERT INTO public.share_link_views (token, granted, reason, user_agent)
    VALUES (_token, false, 'rate_limited', _user_agent);
    RETURN jsonb_build_object('ok', false, 'status', 'rate_limited', 'reason', 'rate_limited');
  END IF;

  SELECT * INTO _sl FROM public.share_links WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.share_link_views (token, granted, reason, user_agent)
    VALUES (_token, false, 'not_found', _user_agent);
    RETURN jsonb_build_object('ok', false, 'status', 'invalid', 'reason', 'not_found');
  END IF;

  IF _sl.revoked_at IS NOT NULL THEN _reason := 'revoked';
  ELSIF _sl.expires_at IS NOT NULL AND _sl.expires_at < now() THEN _reason := 'expired';
  END IF;

  IF _reason IS NOT NULL THEN
    INSERT INTO public.share_link_views
      (share_link_id, token, resource_type, resource_id, granted, reason, user_agent)
    VALUES (_sl.id, _token, _sl.resource_type, _sl.resource_id, false, _reason, _user_agent);
    PERFORM public.log_audit(_sl.org_id, _sl.workspace_id,
      'share_link.access_denied', 'share_link', _sl.id,
      jsonb_build_object('reason', _reason, 'resource_type', _sl.resource_type));
    RETURN jsonb_build_object('ok', false, 'status', _reason, 'reason', _reason);
  END IF;

  IF _sl.resource_type = 'release' THEN
    SELECT to_jsonb(r) INTO _payload FROM public.releases r WHERE r.id = _sl.resource_id;
  ELSIF _sl.resource_type IN ('report','dashboard') THEN
    _payload := jsonb_build_object('resource_id', _sl.resource_id);
  END IF;

  INSERT INTO public.share_link_views
    (share_link_id, token, resource_type, resource_id, granted, reason, user_agent)
  VALUES (_sl.id, _token, _sl.resource_type, _sl.resource_id, true, 'ok', _user_agent);
  PERFORM public.log_audit(_sl.org_id, _sl.workspace_id,
    'share_link.viewed', 'share_link', _sl.id,
    jsonb_build_object('resource_type', _sl.resource_type,
                       'resource_id', _sl.resource_id));

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'ok',
    'resource_type', _sl.resource_type,
    'resource_id', _sl.resource_id,
    'watermark_label', _sl.watermark_label,
    'expires_at', _sl.expires_at,
    'payload', COALESCE(_payload, '{}'::jsonb)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.resolve_share_link(text, text) TO anon, authenticated, service_role;
