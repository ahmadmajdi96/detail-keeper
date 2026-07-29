update public.test_plans
set ai_status = 'running',
    ai_progress_message = 'Test-case job completed — awaiting persistence',
    ai_progress_updated_at = now() - interval '1 hour'
where id = '8be05028-e248-443b-96d0-3b30c33c9d8b';