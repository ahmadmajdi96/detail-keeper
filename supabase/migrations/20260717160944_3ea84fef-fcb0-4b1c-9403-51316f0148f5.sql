
-- Guest role (additive; existing values preserved)
DO $$ BEGIN
  ALTER TYPE public.workspace_role ADD VALUE IF NOT EXISTS 'guest';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============== share_links ===============
CREATE TABLE IF NOT EXISTS public.share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  workspace_id uuid,
  resource_type text NOT NULL CHECK (resource_type IN ('release','report','dashboard')),
  resource_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  watermark_label text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid,
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.share_links TO authenticated;
GRANT ALL ON public.share_links TO service_role;
-- No anon grants; public viewer uses a SECURITY DEFINER RPC.

ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace admins manage share links"
  ON public.share_links FOR ALL
  USING (
    workspace_id IS NULL
    OR public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin')
  )
  WITH CHECK (
    workspace_id IS NULL
    OR public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin')
  );

CREATE POLICY "Workspace members read share links"
  ON public.share_links FOR SELECT
  USING (
    workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid())
  );

CREATE INDEX IF NOT EXISTS share_links_token_idx ON public.share_links(token);
CREATE INDEX IF NOT EXISTS share_links_ws_idx ON public.share_links(workspace_id);

CREATE OR REPLACE FUNCTION public._share_links_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS share_links_touch ON public.share_links;
CREATE TRIGGER share_links_touch BEFORE UPDATE ON public.share_links
  FOR EACH ROW EXECUTE FUNCTION public._share_links_updated_at();

-- Public read RPC used by /share/:token viewer (no auth).
CREATE OR REPLACE FUNCTION public.resolve_share_link(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _sl public.share_links%ROWTYPE; _payload jsonb;
BEGIN
  SELECT * INTO _sl FROM public.share_links WHERE token = _token LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF _sl.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'revoked'); END IF;
  IF _sl.expires_at IS NOT NULL AND _sl.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  IF _sl.resource_type = 'release' THEN
    SELECT to_jsonb(r) INTO _payload FROM public.releases r WHERE r.id = _sl.resource_id;
  ELSIF _sl.resource_type IN ('report','dashboard') THEN
    -- Aggregate summary for the workspace/project scope
    _payload := jsonb_build_object('resource_id', _sl.resource_id);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'resource_type', _sl.resource_type,
    'resource_id', _sl.resource_id,
    'watermark_label', _sl.watermark_label,
    'expires_at', _sl.expires_at,
    'payload', COALESCE(_payload, '{}'::jsonb)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.resolve_share_link(text) TO anon, authenticated;

-- =============== Mentions on defect comments ===============
CREATE OR REPLACE FUNCTION public.notify_defect_comment_mentions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _mention uuid;
  _mentions jsonb;
  _defect record;
  _author_name text;
BEGIN
  _mentions := COALESCE(NEW.metadata -> 'mentions', '[]'::jsonb);
  IF jsonb_typeof(_mentions) <> 'array' OR jsonb_array_length(_mentions) = 0 THEN
    RETURN NEW;
  END IF;
  SELECT id, title, project_id INTO _defect FROM public.defects WHERE id = NEW.defect_id;
  IF _defect.id IS NULL THEN RETURN NEW; END IF;
  SELECT name INTO _author_name FROM public.profiles WHERE id = NEW.author_id;

  FOR _mention IN SELECT (jsonb_array_elements_text(_mentions))::uuid LOOP
    IF _mention IS NULL OR _mention = COALESCE(NEW.author_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN CONTINUE; END IF;
    INSERT INTO public.notifications (user_id, type, title, message, data)
    VALUES (
      _mention,
      'mention',
      COALESCE(_author_name, 'Someone') || ' mentioned you',
      'On defect: ' || COALESCE(_defect.title, 'Untitled'),
      jsonb_build_object(
        'defect_id', _defect.id,
        'comment_id', NEW.id,
        'project_id', _defect.project_id,
        'link', '/defects/' || _defect.id::text
      )
    );
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_defect_comment_mentions ON public.defect_comments;
CREATE TRIGGER trg_defect_comment_mentions
AFTER INSERT ON public.defect_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_defect_comment_mentions();
