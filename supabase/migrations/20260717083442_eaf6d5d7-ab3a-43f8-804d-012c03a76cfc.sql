
-- 1) enum
DO $$ BEGIN
  CREATE TYPE public.org_role AS ENUM ('owner','billing_admin','security_admin','member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) profiles.last_organization_id
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_organization_id uuid;

-- 3) organization_members table
CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- 4) helper functions
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members WHERE org_id = _org_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.organizations WHERE id = _org_id AND owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.org_role_of(_org_id uuid)
RETURNS public.org_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.organizations WHERE id = _org_id AND owner_id = auth.uid())
      THEN 'owner'::public.org_role
    ELSE (SELECT role FROM public.organization_members WHERE org_id = _org_id AND user_id = auth.uid() LIMIT 1)
  END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_org_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.organizations WHERE owner_id = auth.uid()
  UNION
  SELECT org_id FROM public.organization_members WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_role_of(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_org_ids() TO authenticated;

-- 5) organization_members RLS
DROP POLICY IF EXISTS "members read own org membership" ON public.organization_members;
CREATE POLICY "members read own org membership" ON public.organization_members
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "org owner manages members" ON public.organization_members;
CREATE POLICY "org owner manages members" ON public.organization_members
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = org_id AND o.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = org_id AND o.owner_id = auth.uid())
  );

-- 6) tighten organizations RLS
DROP POLICY IF EXISTS "org members view" ON public.organizations;
DROP POLICY IF EXISTS "org owners manage" ON public.organizations;

CREATE POLICY "members read their orgs" ON public.organizations
  FOR SELECT USING (public.is_org_member(id));

CREATE POLICY "owner inserts org" ON public.organizations
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner updates org" ON public.organizations
  FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner deletes org" ON public.organizations
  FOR DELETE USING (owner_id = auth.uid());

-- 7) trigger: auto-add org owner as member
CREATE OR REPLACE FUNCTION public.add_org_owner_as_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.organization_members (org_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner')
    ON CONFLICT (org_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_add_org_owner_as_member ON public.organizations;
CREATE TRIGGER trg_add_org_owner_as_member
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.add_org_owner_as_member();

-- updated_at trigger for organization_members
DROP TRIGGER IF EXISTS trg_org_members_updated_at ON public.organization_members;
CREATE TRIGGER trg_org_members_updated_at
BEFORE UPDATE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8) Extend handle_new_user to create personal organization
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _name text;
  _org_id uuid;
  _slug text;
BEGIN
  _name := COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1));

  INSERT INTO public.profiles (id, email, name, role, status)
  VALUES (
    NEW.id, NEW.email, _name,
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.user_role, 'qa_engineer'),
    'active'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Personal organization
  _slug := lower(regexp_replace(_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(NEW.id::text, 1, 8);
  INSERT INTO public.organizations (name, slug, owner_id)
  VALUES (_name || '''s Organization', _slug, NEW.id)
  RETURNING id INTO _org_id;

  UPDATE public.profiles SET last_organization_id = _org_id WHERE id = NEW.id;

  RETURN NEW;
END $$;

-- 9) Backfill: create personal orgs for existing users owning workspaces w/o org
DO $$
DECLARE
  r RECORD;
  _org_id uuid;
  _slug text;
  _name text;
BEGIN
  FOR r IN
    SELECT DISTINCT w.owner_id AS uid
    FROM public.workspaces w
    WHERE w.organization_id IS NULL AND w.owner_id IS NOT NULL
  LOOP
    -- Does this user already own an organization?
    SELECT id INTO _org_id FROM public.organizations WHERE owner_id = r.uid ORDER BY created_at ASC LIMIT 1;

    IF _org_id IS NULL THEN
      SELECT COALESCE(name, email, 'User') INTO _name FROM public.profiles WHERE id = r.uid;
      IF _name IS NULL THEN _name := 'User'; END IF;
      _slug := lower(regexp_replace(_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(r.uid::text, 1, 8);
      INSERT INTO public.organizations (name, slug, owner_id)
      VALUES (_name || '''s Organization', _slug, r.uid)
      RETURNING id INTO _org_id;
    END IF;

    UPDATE public.workspaces SET organization_id = _org_id
      WHERE owner_id = r.uid AND organization_id IS NULL;

    UPDATE public.profiles SET last_organization_id = _org_id
      WHERE id = r.uid AND last_organization_id IS NULL;
  END LOOP;

  -- Any remaining orphan workspaces: attach to owner's first org (if any) or skip
  FOR r IN SELECT id, owner_id FROM public.workspaces WHERE organization_id IS NULL LOOP
    SELECT id INTO _org_id FROM public.organizations WHERE owner_id = r.owner_id ORDER BY created_at ASC LIMIT 1;
    IF _org_id IS NOT NULL THEN
      UPDATE public.workspaces SET organization_id = _org_id WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
