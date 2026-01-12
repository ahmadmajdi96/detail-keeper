import type { Database } from '@/integrations/supabase/types';

// Re-export database enums as types
export type UserRole = Database['public']['Enums']['user_role'];
export type UserStatus = Database['public']['Enums']['user_status'];
export type TestCaseStatus = Database['public']['Enums']['test_case_status'];
export type ExecutionStatus = Database['public']['Enums']['execution_status'];
export type DefectSeverity = Database['public']['Enums']['defect_severity'];
export type DefectPriority = Database['public']['Enums']['defect_priority'];
export type AgentStatus = Database['public']['Enums']['agent_status'];

// Database row types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Team = Database['public']['Tables']['teams']['Row'];
export type TestCase = Database['public']['Tables']['test_cases']['Row'];
export type TestCaseStep = Database['public']['Tables']['test_case_steps']['Row'];
export type TestCaseVersion = Database['public']['Tables']['test_case_versions']['Row'];
export type TestExecution = Database['public']['Tables']['test_executions']['Row'];
export type ExecutionStepResult = Database['public']['Tables']['execution_step_results']['Row'];
export type Defect = Database['public']['Tables']['defects']['Row'];
export type Evidence = Database['public']['Tables']['evidence']['Row'];
export type AIAgent = Database['public']['Tables']['ai_agents']['Row'];
export type AgentLearningSession = Database['public']['Tables']['agent_learning_sessions']['Row'];
export type AgentExecutionLog = Database['public']['Tables']['agent_execution_logs']['Row'];

// Extended types with relations
export interface ProfileWithTeam extends Profile {
  team?: Team | null;
}

export interface TestCaseWithSteps extends TestCase {
  steps?: TestCaseStep[];
  creator?: Profile | null;
}

export interface TestExecutionWithDetails extends TestExecution {
  test_case?: TestCase;
  executor?: Profile | null;
  step_results?: ExecutionStepResult[];
}

export interface DefectWithDetails extends Defect {
  reporter?: Profile | null;
  assignee?: Profile | null;
  execution?: TestExecution | null;
}

export interface AIAgentWithSessions extends AIAgent {
  learning_sessions?: AgentLearningSession[];
  execution_logs?: AgentExecutionLog[];
}

// Legacy types for backwards compatibility
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type WorkspaceStatus = 'active' | 'archived';
export type ProjectStatus = 'active' | 'inactive' | 'completed';
export type DocumentStatus = 'uploaded' | 'processing' | 'processed' | 'failed';
export type TestPlanStatus = 'draft' | 'active' | 'completed' | 'archived';
export type TestRunStatus = 'planned' | 'in_progress' | 'completed' | 'blocked';
export type DefectStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Workspace {
  workspace_id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_date: string;
  status: WorkspaceStatus;
  storage_quota: number;
  storage_used?: number;
  projects_count?: number;
  members_count?: number;
}

export interface Project {
  project_id: string;
  workspace_id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  created_date: string;
}

export interface Document {
  doc_id: string;
  filename: string;
  uploader_id: string;
  project_id: string;
  file_size: number;
  mime_type: string;
  status: DocumentStatus;
  processed_date?: string;
  created_date: string;
  requirements_count?: number;
}

export interface Requirement {
  req_id: string;
  doc_id: string;
  requirement_text: string;
  category: string;
  priority: Priority;
  extracted_date: string;
  confidence_score: number;
}

export interface TestPlan {
  plan_id: string;
  project_id: string;
  name: string;
  description?: string;
  status: TestPlanStatus;
  created_by: string;
  created_date: string;
  ai_suggested: boolean;
  runs_count?: number;
  progress?: number;
}

export interface TestRun {
  run_id: string;
  plan_id: string;
  name: string;
  description?: string;
  assignee_id: string;
  assignee_name?: string;
  status: TestRunStatus;
  priority: Priority;
  scheduled_date?: string;
  estimated_duration?: number;
  progress?: number;
}

export interface QualityMetrics {
  test_coverage: number;
  pass_rate: number;
  active_executions: number;
  pending_assignments: number;
  total_test_cases: number;
  total_defects: number;
  critical_defects: number;
  automation_coverage: number;
}

export interface Notification {
  notification_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  created_date: string;
  link?: string;
}
