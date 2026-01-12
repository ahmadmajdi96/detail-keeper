-- Create workspaces table
CREATE TABLE public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'active',
  storage_quota INTEGER DEFAULT 5000,
  storage_used INTEGER DEFAULT 0,
  projects_count INTEGER DEFAULT 0,
  members_count INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create documents table
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded',
  uploader_id UUID REFERENCES public.profiles(id),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  requirements_count INTEGER DEFAULT 0,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create test_plans table
CREATE TABLE public.test_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id),
  ai_suggested BOOLEAN DEFAULT false,
  runs_count INTEGER DEFAULT 0,
  progress INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add workspace_id to test_cases if not exists (it exists but is nullable)
-- Just ensure test_cases can be linked to workspaces

-- Enable RLS on all new tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_plans ENABLE ROW LEVEL SECURITY;

-- Workspaces policies
CREATE POLICY "Users can view all workspaces" ON public.workspaces FOR SELECT USING (true);
CREATE POLICY "Admins and managers can insert workspaces" ON public.workspaces FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'qa_manager')));
CREATE POLICY "Admins and managers can update workspaces" ON public.workspaces FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'qa_manager')));
CREATE POLICY "Admins can delete workspaces" ON public.workspaces FOR DELETE 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Documents policies
CREATE POLICY "Users can view all documents" ON public.documents FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert documents" ON public.documents FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update documents" ON public.documents FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins and managers can delete documents" ON public.documents FOR DELETE 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'qa_manager')));

-- Test plans policies
CREATE POLICY "Users can view all test plans" ON public.test_plans FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert test plans" ON public.test_plans FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can update test plans" ON public.test_plans FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins and managers can delete test plans" ON public.test_plans FOR DELETE 
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'qa_manager')));

-- Add triggers for updated_at
CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_test_plans_updated_at BEFORE UPDATE ON public.test_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();