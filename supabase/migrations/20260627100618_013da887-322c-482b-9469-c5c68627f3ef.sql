
-- Workspace member roles
DO $$ BEGIN
  CREATE TYPE public.workspace_role AS ENUM ('owner','admin','editor','viewer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.project_source AS ENUM ('documentation','zip','github');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.project_status AS ENUM ('pending','processing','ready','failed','archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.invitation_status AS ENUM ('pending','accepted','expired','revoked');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- WORKSPACE MEMBERS
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'editor',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members TO authenticated;
GRANT ALL ON public.workspace_members TO service_role;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Helper to detect membership without recursion
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members WHERE workspace_id = _workspace AND user_id = _user
  ) OR EXISTS (
    SELECT 1 FROM public.workspaces WHERE id = _workspace AND owner_id = _user
  );
$$;

CREATE OR REPLACE FUNCTION public.workspace_role_of(_workspace uuid, _user uuid)
RETURNS public.workspace_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.workspaces WHERE id = _workspace AND owner_id = _user) THEN 'owner'::public.workspace_role
    ELSE (SELECT role FROM public.workspace_members WHERE workspace_id = _workspace AND user_id = _user LIMIT 1)
  END;
$$;

CREATE POLICY "members can view own membership"
  ON public.workspace_members FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "owners and admins can manage members"
  ON public.workspace_members FOR ALL TO authenticated
  USING (public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin'))
  WITH CHECK (public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin'));

-- WORKSPACE INVITATIONS
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'editor',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  status public.invitation_status NOT NULL DEFAULT 'pending',
  invited_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invitations TO authenticated;
GRANT ALL ON public.workspace_invitations TO service_role;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws admins manage invitations"
  ON public.workspace_invitations FOR ALL TO authenticated
  USING (public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin'))
  WITH CHECK (public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin'));

CREATE POLICY "invitees can view their pending invites"
  ON public.workspace_invitations FOR SELECT TO authenticated
  USING (email = (SELECT email FROM public.profiles WHERE id = auth.uid()));

-- PROJECTS
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  source_type public.project_source NOT NULL DEFAULT 'documentation',
  status public.project_status NOT NULL DEFAULT 'pending',
  -- GitHub-specific
  github_url text,
  github_branch text DEFAULT 'main',
  github_is_private boolean DEFAULT false,
  github_token_secret_name text, -- name of secret in Edge Function env
  -- Zip-specific
  zip_storage_path text,
  -- stats
  files_count integer DEFAULT 0,
  endpoints_count integer DEFAULT 0,
  test_cases_count integer DEFAULT 0,
  last_processed_at timestamptz,
  process_error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws members view projects"
  ON public.projects FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "ws editors+ manage projects"
  ON public.projects FOR ALL TO authenticated
  USING (public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin','editor'))
  WITH CHECK (public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin','editor'));

-- Add project_id linking (nullable)
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.test_cases ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.test_plans ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_ws_members_updated_at ON public.workspace_members;
CREATE TRIGGER trg_ws_members_updated_at BEFORE UPDATE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_ws_invitations_updated_at ON public.workspace_invitations;
CREATE TRIGGER trg_ws_invitations_updated_at BEFORE UPDATE ON public.workspace_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Maintain workspace counters
CREATE OR REPLACE FUNCTION public.recount_workspace_counters() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ws uuid;
BEGIN
  _ws := COALESCE(NEW.workspace_id, OLD.workspace_id);
  UPDATE public.workspaces SET
    projects_count = (SELECT count(*) FROM public.projects WHERE workspace_id = _ws),
    members_count = (SELECT count(*) FROM public.workspace_members WHERE workspace_id = _ws) + 1
  WHERE id = _ws;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_projects_counter ON public.projects;
CREATE TRIGGER trg_projects_counter AFTER INSERT OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.recount_workspace_counters();
DROP TRIGGER IF EXISTS trg_ws_members_counter ON public.workspace_members;
CREATE TRIGGER trg_ws_members_counter AFTER INSERT OR DELETE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.recount_workspace_counters();

-- Auto-add owner as member when workspace created
CREATE OR REPLACE FUNCTION public.add_workspace_owner_as_member() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (NEW.id, NEW.owner_id, 'owner')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_workspace_owner_member ON public.workspaces;
CREATE TRIGGER trg_workspace_owner_member AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.add_workspace_owner_as_member();

-- Auto-accept invites on signup
CREATE OR REPLACE FUNCTION public.accept_pending_invitations() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  SELECT workspace_id, NEW.id, role FROM public.workspace_invitations
  WHERE email = NEW.email AND status = 'pending' AND expires_at > now()
  ON CONFLICT DO NOTHING;
  UPDATE public.workspace_invitations SET status = 'accepted'
  WHERE email = NEW.email AND status = 'pending';
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_profile_accept_invites ON public.profiles;
CREATE TRIGGER trg_profile_accept_invites AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.accept_pending_invitations();

-- Backfill: add existing workspace owners as members
INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT id, owner_id, 'owner' FROM public.workspaces WHERE owner_id IS NOT NULL
ON CONFLICT DO NOTHING;
