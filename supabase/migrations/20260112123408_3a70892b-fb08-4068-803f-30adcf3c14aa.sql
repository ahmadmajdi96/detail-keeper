-- Fix the update_updated_at_column function with search_path
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recreate triggers with the fixed function
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_test_cases_updated_at BEFORE UPDATE ON public.test_cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_test_executions_updated_at BEFORE UPDATE ON public.test_executions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_defects_updated_at BEFORE UPDATE ON public.defects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ai_agents_updated_at BEFORE UPDATE ON public.ai_agents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fix overly permissive RLS policies
-- Drop and recreate the "true" policies with proper checks

-- Fix profiles insert policy
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "System can insert profiles on signup" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Fix teams "all" policy to be more specific
DROP POLICY IF EXISTS "Admins and managers can manage teams" ON public.teams;
CREATE POLICY "Admins and managers can insert teams" ON public.teams FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'qa_manager'))
);
CREATE POLICY "Admins and managers can update teams" ON public.teams FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'qa_manager'))
);
CREATE POLICY "Admins and managers can delete teams" ON public.teams FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'qa_manager'))
);

-- Fix test_cases policy
DROP POLICY IF EXISTS "Authenticated users can manage test cases" ON public.test_cases;
CREATE POLICY "Authenticated users can insert test cases" ON public.test_cases FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update test cases" ON public.test_cases FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete test cases" ON public.test_cases FOR DELETE USING (auth.uid() IS NOT NULL);

-- Fix test_case_steps policy
DROP POLICY IF EXISTS "Authenticated users can manage test case steps" ON public.test_case_steps;
CREATE POLICY "Authenticated users can insert steps" ON public.test_case_steps FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update steps" ON public.test_case_steps FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete steps" ON public.test_case_steps FOR DELETE USING (auth.uid() IS NOT NULL);

-- Fix test_executions policy
DROP POLICY IF EXISTS "Authenticated users can manage executions" ON public.test_executions;
CREATE POLICY "Authenticated users can insert executions" ON public.test_executions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update executions" ON public.test_executions FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete executions" ON public.test_executions FOR DELETE USING (auth.uid() IS NOT NULL);

-- Fix execution_step_results policy
DROP POLICY IF EXISTS "Authenticated users can manage step results" ON public.execution_step_results;
CREATE POLICY "Authenticated users can insert step results" ON public.execution_step_results FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update step results" ON public.execution_step_results FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete step results" ON public.execution_step_results FOR DELETE USING (auth.uid() IS NOT NULL);

-- Fix defects policy
DROP POLICY IF EXISTS "Authenticated users can manage defects" ON public.defects;
CREATE POLICY "Authenticated users can insert defects" ON public.defects FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update defects" ON public.defects FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete defects" ON public.defects FOR DELETE USING (auth.uid() IS NOT NULL);

-- Fix evidence policy
DROP POLICY IF EXISTS "Authenticated users can manage evidence" ON public.evidence;
CREATE POLICY "Authenticated users can insert evidence" ON public.evidence FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update evidence" ON public.evidence FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete evidence" ON public.evidence FOR DELETE USING (auth.uid() IS NOT NULL);

-- Fix ai_agents policy
DROP POLICY IF EXISTS "Admins and managers can manage agents" ON public.ai_agents;
CREATE POLICY "Admins and managers can insert agents" ON public.ai_agents FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'qa_manager'))
);
CREATE POLICY "Admins and managers can update agents" ON public.ai_agents FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'qa_manager'))
);
CREATE POLICY "Admins and managers can delete agents" ON public.ai_agents FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'qa_manager'))
);

-- Fix agent_learning_sessions policy
DROP POLICY IF EXISTS "Admins and managers can manage sessions" ON public.agent_learning_sessions;
CREATE POLICY "Admins and managers can insert sessions" ON public.agent_learning_sessions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'qa_manager'))
);
CREATE POLICY "Admins and managers can update sessions" ON public.agent_learning_sessions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'qa_manager'))
);
CREATE POLICY "Admins and managers can delete sessions" ON public.agent_learning_sessions FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'qa_manager'))
);

-- Fix agent_execution_logs policy
DROP POLICY IF EXISTS "System can insert logs" ON public.agent_execution_logs;
CREATE POLICY "Authenticated can insert logs" ON public.agent_execution_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);