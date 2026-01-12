// User Roles
export type UserRole = 'admin' | 'qa_manager' | 'qa_engineer' | 'viewer';

export type UserStatus = 'active' | 'inactive' | 'pending';

export interface User {
  user_id: string;
  email: string;
  name: string;
  role: UserRole;
  team_id?: string;
  status: UserStatus;
  created_date: string;
  last_login?: string;
  avatar?: string;
}

// Teams
export interface Team {
  team_id: string;
  name: string;
  description?: string;
  manager_id?: string;
  created_date: string;
}

// Workspaces
export type WorkspaceStatus = 'active' | 'archived';

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

// Projects
export type ProjectStatus = 'active' | 'inactive' | 'completed';

export interface Project {
  project_id: string;
  workspace_id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  created_date: string;
}

// Documents
export type DocumentStatus = 'uploaded' | 'processing' | 'processed' | 'failed';

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

// Requirements
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface Requirement {
  req_id: string;
  doc_id: string;
  requirement_text: string;
  category: string;
  priority: Priority;
  extracted_date: string;
  confidence_score: number;
}

// Test Plans
export type TestPlanStatus = 'draft' | 'active' | 'completed' | 'archived';

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

// Test Runs
export type TestRunStatus = 'planned' | 'in_progress' | 'completed' | 'blocked';

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

// Test Cases
export type TestCaseType = 'functional' | 'business' | 'regression' | 'negative';
export type TestCaseStatus = 'draft' | 'active' | 'deprecated';

export interface TestCase {
  case_id: string;
  req_id: string;
  title: string;
  description?: string;
  steps: TestStep[];
  expected_result: string;
  type: TestCaseType;
  priority: Priority;
  status: TestCaseStatus;
  ai_generated: boolean;
  created_date: string;
}

export interface TestStep {
  step_number: number;
  action: string;
  expected_result: string;
}

// Test Executions
export type ExecutionStatus = 'not_started' | 'in_progress' | 'passed' | 'failed' | 'blocked';

export interface TestExecution {
  execution_id: string;
  run_id: string;
  case_id: string;
  executor_id: string;
  executor_name?: string;
  start_time?: string;
  end_time?: string;
  status: ExecutionStatus;
  notes?: string;
  execution_time?: number;
}

// Defects
export type DefectStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface Defect {
  defect_id: string;
  execution_id: string;
  title: string;
  description?: string;
  severity: Priority;
  priority: Priority;
  status: DefectStatus;
  created_date: string;
}

// Automation Agents
export type AgentType = 'ui' | 'api';
export type AgentStatus = 'idle' | 'learning' | 'ready' | 'executing' | 'error';

export interface AutomationAgent {
  agent_id: string;
  name: string;
  type: AgentType;
  status: AgentStatus;
  created_date: string;
  last_active?: string;
  learning_progress?: number;
}

// Metrics for Dashboard
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

// Notifications
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

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
