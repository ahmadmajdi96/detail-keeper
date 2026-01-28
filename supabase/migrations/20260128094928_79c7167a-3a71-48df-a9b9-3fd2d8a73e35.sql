-- Create table for extracted API endpoints
CREATE TABLE public.api_endpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  summary TEXT,
  description TEXT,
  parameters JSONB DEFAULT '[]'::jsonb,
  request_body JSONB,
  response_schema JSONB,
  headers JSONB DEFAULT '[]'::jsonb,
  authentication TEXT,
  tags TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for PRDs
CREATE TABLE public.endpoint_prds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint_id UUID NOT NULL REFERENCES public.api_endpoints(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  overview TEXT,
  objectives JSONB DEFAULT '[]'::jsonb,
  functional_requirements JSONB DEFAULT '[]'::jsonb,
  non_functional_requirements JSONB DEFAULT '[]'::jsonb,
  acceptance_criteria JSONB DEFAULT '[]'::jsonb,
  dependencies JSONB DEFAULT '[]'::jsonb,
  risks JSONB DEFAULT '[]'::jsonb,
  full_content TEXT,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for test plans
CREATE TABLE public.endpoint_test_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint_id UUID NOT NULL REFERENCES public.api_endpoints(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  test_cases JSONB DEFAULT '[]'::jsonb,
  coverage_areas JSONB DEFAULT '[]'::jsonb,
  test_data JSONB DEFAULT '[]'::jsonb,
  preconditions TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for API test executions
CREATE TABLE public.api_test_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint_id UUID NOT NULL REFERENCES public.api_endpoints(id) ON DELETE CASCADE,
  test_plan_id UUID REFERENCES public.endpoint_test_plans(id) ON DELETE SET NULL,
  executor_id UUID REFERENCES public.profiles(id),
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  request_headers JSONB,
  request_body TEXT,
  response_status INTEGER,
  response_headers JSONB,
  response_body TEXT,
  response_time_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  assertions JSONB DEFAULT '[]'::jsonb,
  assertion_results JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.api_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endpoint_prds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endpoint_test_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_test_executions ENABLE ROW LEVEL SECURITY;

-- RLS policies for api_endpoints
CREATE POLICY "Users can view all endpoints" ON public.api_endpoints FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert endpoints" ON public.api_endpoints FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update endpoints" ON public.api_endpoints FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete endpoints" ON public.api_endpoints FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS policies for endpoint_prds
CREATE POLICY "Users can view all PRDs" ON public.endpoint_prds FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert PRDs" ON public.endpoint_prds FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update PRDs" ON public.endpoint_prds FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete PRDs" ON public.endpoint_prds FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS policies for endpoint_test_plans
CREATE POLICY "Users can view all test plans" ON public.endpoint_test_plans FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert test plans" ON public.endpoint_test_plans FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update test plans" ON public.endpoint_test_plans FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete test plans" ON public.endpoint_test_plans FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS policies for api_test_executions
CREATE POLICY "Users can view all executions" ON public.api_test_executions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert executions" ON public.api_test_executions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update executions" ON public.api_test_executions FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can delete executions" ON public.api_test_executions FOR DELETE USING (auth.uid() IS NOT NULL);

-- Add triggers for updated_at
CREATE TRIGGER update_api_endpoints_updated_at BEFORE UPDATE ON public.api_endpoints FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_endpoint_test_plans_updated_at BEFORE UPDATE ON public.endpoint_test_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();