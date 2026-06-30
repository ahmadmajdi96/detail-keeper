-- Idempotent admin seed fixtures.
-- Run via:  psql "$SUPABASE_DB_URL" -f supabase/seed/admin-fixtures.sql
-- Or via:   bun run seed:admin

BEGIN;

-- Stable UUIDs so reruns stay idempotent
DO $$
DECLARE
  v_org    uuid := '00000000-0000-0000-0000-00000000a001';
  v_ws     uuid := '00000000-0000-0000-0000-00000000a002';
  v_proj   uuid := '00000000-0000-0000-0000-00000000a003';
  v_repo   uuid := '00000000-0000-0000-0000-00000000a004';
  v_pr     uuid := '00000000-0000-0000-0000-00000000a005';
  v_req    uuid := '00000000-0000-0000-0000-00000000a006';
  v_plan   uuid := '00000000-0000-0000-0000-00000000a007';
  v_defect uuid := '00000000-0000-0000-0000-00000000a008';
  v_appr   uuid := '00000000-0000-0000-0000-00000000a009';
  v_waiver uuid := '00000000-0000-0000-0000-00000000a00a';
  v_aijob  uuid := '00000000-0000-0000-0000-00000000a00b';
  v_owner  uuid;
BEGIN
  -- Use any existing workspace owner as the seed actor; bail out gracefully if there are no users.
  SELECT id INTO v_owner FROM auth.users ORDER BY created_at LIMIT 1;
  IF v_owner IS NULL THEN
    RAISE NOTICE 'No auth user found; skipping admin fixtures';
    RETURN;
  END IF;

  INSERT INTO public.organizations (id, name, slug) VALUES (v_org, 'Qualixa Demo Org', 'qualixa-demo')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workspaces (id, name, owner_id, organization_id)
    VALUES (v_ws, 'Admin Demo Workspace', v_owner, v_org)
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.projects (id, workspace_id, name, created_by)
    VALUES (v_proj, v_ws, 'Admin Demo Project', v_owner)
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.repositories (id, workspace_id, project_id, provider, name, url, default_branch)
    VALUES (v_repo, v_ws, v_proj, 'github', 'qualixa-demo', 'https://github.com/example/qualixa-demo', 'main')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.repository_branches (id, repository_id, name, head_sha)
    VALUES
      (gen_random_uuid(), v_repo, 'main', 'aaaaaaa'),
      (gen_random_uuid(), v_repo, 'develop', 'bbbbbbb')
    ON CONFLICT DO NOTHING;

  INSERT INTO public.pull_requests (id, repository_id, number, title, state, author)
    VALUES (v_pr, v_repo, 1, 'Initial demo PR', 'open', 'demo-bot')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.commits (id, repository_id, sha, message, author)
    VALUES
      (gen_random_uuid(), v_repo, 'aaaaaaa', 'feat: scaffold', 'demo-bot'),
      (gen_random_uuid(), v_repo, 'bbbbbbb', 'chore: cleanup', 'demo-bot')
    ON CONFLICT DO NOTHING;

  -- Requirement + versions (uses existing requirements table)
  INSERT INTO public.requirements (id, project_id, title, description, priority)
    VALUES (v_req, v_proj, 'Demo Requirement', 'Used by admin fixtures', 'medium')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.requirement_versions (requirement_id, version_number, snapshot, author_id)
    VALUES
      (v_req, 1, jsonb_build_object('title','Demo Requirement','description','v1'), v_owner),
      (v_req, 2, jsonb_build_object('title','Demo Requirement','description','v2 refined'), v_owner)
    ON CONFLICT DO NOTHING;

  -- Test plan + version
  INSERT INTO public.test_plans (id, project_id, name, created_by)
    VALUES (v_plan, v_proj, 'Admin Demo Plan', v_owner)
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.test_plan_versions (test_plan_id, version_number, snapshot, author_id)
    VALUES (v_plan, 1, jsonb_build_object('name','Admin Demo Plan','suites',jsonb_build_array()), v_owner)
    ON CONFLICT DO NOTHING;

  -- Defect with comment, link, history, SLA
  INSERT INTO public.defects (id, project_id, title, description, status, severity, priority, reporter_id)
    VALUES (v_defect, v_proj, 'Demo defect', 'Captured by admin fixtures', 'open', 'high', 'medium', v_owner)
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.defect_comments (defect_id, author_id, body)
    VALUES (v_defect, v_owner, 'Initial triage comment')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.defect_links (defect_id, link_type, target_type, target_id)
    VALUES (v_defect, 'caused_by', 'requirement', v_req)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.defect_history (defect_id, field_name, old_value, new_value, changed_by)
    VALUES (v_defect, 'status', 'new', 'open', v_owner)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.defect_slas (defect_id, sla_type, target_at)
    VALUES (v_defect, 'resolve', now() + interval '3 days')
    ON CONFLICT DO NOTHING;

  -- Approval + waiver
  INSERT INTO public.approvals (id, workspace_id, project_id, subject_type, subject_id, status, requested_by, rationale)
    VALUES (v_appr, v_ws, v_proj, 'release', v_plan, 'pending', v_owner, 'Demo approval request')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.waivers (id, workspace_id, project_id, scope, reason, approved_by, expires_at)
    VALUES (v_waiver, v_ws, v_proj, 'quality-gate:coverage', 'Demo waiver for ramp-up', v_owner, now() + interval '14 days')
    ON CONFLICT (id) DO NOTHING;

  -- AI job → output → audit
  INSERT INTO public.ai_jobs (id, workspace_id, project_id, job_type, status, model_name, prompt_tokens, completion_tokens, total_cost_cents)
    VALUES (v_aijob, v_ws, v_proj, 'demo:generate', 'succeeded', 'gemini-2.5-flash', 1200, 450, 7)
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.ai_outputs (job_id, kind, content)
    VALUES (v_aijob, 'summary', jsonb_build_object('text','Demo AI output for admin fixtures'))
    ON CONFLICT DO NOTHING;
  INSERT INTO public.ai_audit_events (job_id, event_type, actor_id, payload)
    VALUES (v_aijob, 'completed', v_owner, jsonb_build_object('source','admin-fixtures'))
    ON CONFLICT DO NOTHING;
END $$;

COMMIT;
