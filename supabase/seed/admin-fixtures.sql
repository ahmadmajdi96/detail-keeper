-- Idempotent admin seed fixtures.
-- Run: psql "$SUPABASE_DB_URL" -f supabase/seed/admin-fixtures.sql
BEGIN;

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
  SELECT id INTO v_owner FROM public.profiles ORDER BY created_at LIMIT 1;
  IF v_owner IS NULL THEN
    RAISE NOTICE 'No profile found; skipping admin fixtures';
    RETURN;
  END IF;

  INSERT INTO public.organizations (id, name, slug, owner_id)
    VALUES (v_org, 'Qualixa Demo Org', 'qualixa-demo', v_owner)
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workspaces (id, name, owner_id, organization_id)
    VALUES (v_ws, 'Admin Demo Workspace', v_owner, v_org)
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.projects (id, workspace_id, name, created_by)
    VALUES (v_proj, v_ws, 'Admin Demo Project', v_owner)
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.repositories (id, project_id, provider, url, default_branch, external_id, metadata)
    VALUES (v_repo, v_proj, 'github', 'https://github.com/example/qualixa-demo', 'main', 'demo/qualixa-demo',
            jsonb_build_object('name','qualixa-demo'))
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.repository_branches (repository_id, name, head_sha, is_default)
    VALUES (v_repo, 'main', 'aaaaaaa', true), (v_repo, 'develop', 'bbbbbbb', false)
    ON CONFLICT DO NOTHING;

  INSERT INTO public.pull_requests (id, repository_id, number, title, state, author, source_branch, target_branch, head_sha)
    VALUES (v_pr, v_repo, 1, 'Initial demo PR', 'open', 'demo-bot', 'develop', 'main', 'bbbbbbb')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.commits (repository_id, sha, branch, message, author_name, author_email)
    VALUES
      (v_repo, 'aaaaaaa', 'main', 'feat: scaffold', 'Demo Bot', 'bot@example.com'),
      (v_repo, 'bbbbbbb', 'develop', 'chore: cleanup', 'Demo Bot', 'bot@example.com')
    ON CONFLICT DO NOTHING;

  INSERT INTO public.requirements (id, project_id, key, title, description, created_by)
    VALUES (v_req, v_proj, 'REQ-DEMO-1', 'Demo Requirement', 'Used by admin fixtures', v_owner)
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.requirement_versions (requirement_id, version, snapshot, change_note, changed_by)
    VALUES
      (v_req, 1, jsonb_build_object('title','Demo Requirement','description','v1'), 'initial', v_owner),
      (v_req, 2, jsonb_build_object('title','Demo Requirement','description','v2 refined'), 'refined wording', v_owner)
    ON CONFLICT DO NOTHING;

  INSERT INTO public.test_plans (id, project_id, workspace_id, name, created_by)
    VALUES (v_plan, v_proj, v_ws, 'Admin Demo Plan', v_owner)
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.test_plan_versions (test_plan_id, version, snapshot, change_summary, created_by)
    VALUES (v_plan, 1, jsonb_build_object('name','Admin Demo Plan','suites',jsonb_build_array()), 'seed v1', v_owner)
    ON CONFLICT DO NOTHING;

  INSERT INTO public.defects (id, project_id, workspace_id, title, description, status, severity, priority, reported_by)
    VALUES (v_defect, v_proj, v_ws, 'Demo defect', 'Captured by admin fixtures', 'open', 'major', 'medium', v_owner)
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.defect_comments (defect_id, author_id, body)
    VALUES (v_defect, v_owner, 'Initial triage comment')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.defect_links (defect_id, link_type, target_kind, target_id, created_by)
    VALUES (v_defect, 'caused_by', 'requirement', v_req, v_owner)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.defect_history (defect_id, field_name, old_value, new_value, changed_by)
    VALUES (v_defect, 'status', '"new"'::jsonb, '"open"'::jsonb, v_owner)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.defect_slas (project_id, name, severity, response_hours, resolution_hours, enabled)
    VALUES (v_proj, 'High severity SLA', 'high', 4, 72, true)
    ON CONFLICT DO NOTHING;

  INSERT INTO public.approvals (id, project_id, subject_kind, subject_id, status, requested_by, notes)
    VALUES (v_appr, v_proj, 'release', v_plan, 'pending', v_owner, 'Demo approval request')
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.waivers (id, project_id, subject_kind, subject_id, reason, granted_by, granted_at, expires_at)
    VALUES (v_waiver, v_proj, 'quality-gate', v_plan, 'Demo waiver for ramp-up', v_owner, now(), now() + interval '14 days')
    ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.ai_jobs (id, workspace_id, project_id, kind, status, model, tokens_in, tokens_out, cost_usd, created_by, finished_at)
    VALUES (v_aijob, v_ws, v_proj, 'demo:generate', 'succeeded', 'gemini-2.5-flash', 1200, 450, 0.07, v_owner, now())
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.ai_outputs (ai_job_id, output_kind, content)
    VALUES (v_aijob, 'summary', jsonb_build_object('text','Demo AI output for admin fixtures'))
    ON CONFLICT DO NOTHING;
  INSERT INTO public.ai_audit_events (workspace_id, ai_job_id, action, actor_id, details)
    VALUES (v_ws, v_aijob, 'completed', v_owner, jsonb_build_object('source','admin-fixtures'))
    ON CONFLICT DO NOTHING;
END $$;

COMMIT;
