-- Remove duplicated AI test cases created by the retrying persist loop for this plan's job
with dupes as (
  select tc.id
  from public.test_cases tc
  join public.test_plan_test_cases ptc on ptc.test_case_id = tc.id
  where ptc.test_plan_id = '8be05028-e248-443b-96d0-3b30c33c9d8b'
    and tc.ai_generated = true
    and tc.provenance->>'job_id' = '2bf6ba54-9a1e-4648-a2d7-e74ed65775ca'
)
delete from public.test_cases where id in (select id from dupes);

update public.test_plans
set ai_progress_message = 'Test-case job completed — awaiting persistence',
    ai_progress_updated_at = now() - interval '1 hour'
where id = '8be05028-e248-443b-96d0-3b30c33c9d8b';