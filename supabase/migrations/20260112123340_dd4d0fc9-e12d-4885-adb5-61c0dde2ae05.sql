-- Create user roles enum
CREATE TYPE public.user_role AS ENUM ('admin', 'qa_manager', 'qa_engineer', 'viewer');

-- Create status enums
CREATE TYPE public.user_status AS ENUM ('active', 'pending', 'inactive', 'suspended');
CREATE TYPE public.test_case_status AS ENUM ('draft', 'active', 'deprecated', 'archived');
CREATE TYPE public.execution_status AS ENUM ('pending', 'in_progress', 'passed', 'failed', 'blocked', 'skipped');
CREATE TYPE public.defect_severity AS ENUM ('critical', 'major', 'minor', 'trivial');
CREATE TYPE public.defect_priority AS ENUM ('urgent', 'high', 'medium', 'low');
CREATE TYPE public.agent_status AS ENUM ('idle', 'learning', 'executing', 'paused', 'error');

-- Teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  manager_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role public.user_role NOT NULL DEFAULT 'viewer',
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  status public.user_status NOT NULL DEFAULT 'pending',
  avatar TEXT,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key from teams to profiles for manager
ALTER TABLE public.teams ADD CONSTRAINT fk_teams_manager FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Test cases table
CREATE TABLE public.test_cases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  preconditions TEXT,
  expected_result TEXT,
  status public.test_case_status NOT NULL DEFAULT 'draft',
  priority INTEGER NOT NULL DEFAULT 3,
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  ai_confidence DECIMAL(3,2),
  coverage_tags TEXT[],
  requirement_ids UUID[],
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  workspace_id UUID,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Test case steps
CREATE TABLE public.test_case_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_case_id UUID NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  action TEXT NOT NULL,
  expected_result TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Test case version history
CREATE TABLE public.test_case_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_case_id UUID NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  changes_summary TEXT,
  modified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Test executions table
CREATE TABLE public.test_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_case_id UUID NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
  test_run_id UUID,
  executor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status public.execution_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  environment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Execution step results
CREATE TABLE public.execution_step_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES public.test_executions(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.test_case_steps(id) ON DELETE CASCADE,
  status public.execution_status NOT NULL DEFAULT 'pending',
  actual_result TEXT,
  notes TEXT,
  executed_at TIMESTAMP WITH TIME ZONE
);

-- Defects table
CREATE TABLE public.defects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  execution_id UUID REFERENCES public.test_executions(id) ON DELETE SET NULL,
  step_result_id UUID REFERENCES public.execution_step_results(id) ON DELETE SET NULL,
  severity public.defect_severity NOT NULL DEFAULT 'minor',
  priority public.defect_priority NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  reported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Evidence attachments
CREATE TABLE public.evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID REFERENCES public.test_executions(id) ON DELETE CASCADE,
  defect_id UUID REFERENCES public.defects(id) ON DELETE CASCADE,
  step_result_id UUID REFERENCES public.execution_step_results(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  description TEXT,
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI Automation Agents
CREATE TABLE public.ai_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  agent_type TEXT NOT NULL DEFAULT 'test_execution',
  status public.agent_status NOT NULL DEFAULT 'idle',
  learning_progress INTEGER NOT NULL DEFAULT 0,
  total_executions INTEGER NOT NULL DEFAULT 0,
  success_rate DECIMAL(5,2),
  last_execution_at TIMESTAMP WITH TIME ZONE,
  configuration JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Agent learning sessions
CREATE TABLE public.agent_learning_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress',
  patterns_learned INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Agent execution logs
CREATE TABLE public.agent_execution_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES public.test_executions(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  result TEXT,
  confidence DECIMAL(3,2),
  duration_ms INTEGER,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_case_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_case_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_step_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_execution_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);

-- RLS Policies for teams
CREATE POLICY "Users can view all teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Admins and managers can manage teams" ON public.teams FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'qa_manager'))
);

-- RLS Policies for test_cases
CREATE POLICY "Users can view all test cases" ON public.test_cases FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage test cases" ON public.test_cases FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for test_case_steps
CREATE POLICY "Users can view all test case steps" ON public.test_case_steps FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage test case steps" ON public.test_case_steps FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for test_case_versions
CREATE POLICY "Users can view all versions" ON public.test_case_versions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create versions" ON public.test_case_versions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for test_executions
CREATE POLICY "Users can view all executions" ON public.test_executions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage executions" ON public.test_executions FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for execution_step_results
CREATE POLICY "Users can view all step results" ON public.execution_step_results FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage step results" ON public.execution_step_results FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for defects
CREATE POLICY "Users can view all defects" ON public.defects FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage defects" ON public.defects FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for evidence
CREATE POLICY "Users can view all evidence" ON public.evidence FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage evidence" ON public.evidence FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for ai_agents
CREATE POLICY "Users can view all agents" ON public.ai_agents FOR SELECT USING (true);
CREATE POLICY "Admins and managers can manage agents" ON public.ai_agents FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'qa_manager'))
);

-- RLS Policies for agent_learning_sessions
CREATE POLICY "Users can view learning sessions" ON public.agent_learning_sessions FOR SELECT USING (true);
CREATE POLICY "Admins and managers can manage sessions" ON public.agent_learning_sessions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'qa_manager'))
);

-- RLS Policies for agent_execution_logs
CREATE POLICY "Users can view execution logs" ON public.agent_execution_logs FOR SELECT USING (true);
CREATE POLICY "System can insert logs" ON public.agent_execution_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data ->> 'role')::public.user_role, 'qa_engineer'),
    'active'
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_test_cases_updated_at BEFORE UPDATE ON public.test_cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_test_executions_updated_at BEFORE UPDATE ON public.test_executions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_defects_updated_at BEFORE UPDATE ON public.defects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ai_agents_updated_at BEFORE UPDATE ON public.ai_agents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();