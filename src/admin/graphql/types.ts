export interface Edge<T> { node: T }
export interface Connection<T> { edges: Edge<T>[]; totalCount?: number }

export interface Repository {
  id: string; project_id: string | null; provider: string;
  url: string; default_branch: string | null; external_id: string | null; created_at: string;
}
export interface RequirementVersion {
  id: string; requirement_id: string; version: number;
  snapshot: unknown; change_note: string | null; changed_by: string | null; created_at: string;
}
export interface Defect {
  id: string; title: string; status: string; severity: string | null; priority: string | null;
  project_id: string; assigned_to: string | null; reported_by: string | null; created_at: string;
}
export interface DefectComment {
  id: string; defect_id: string; author_id: string | null; body: string; created_at: string;
}
export interface Approval {
  id: string; project_id: string; subject_kind: string; subject_id: string;
  status: string; decision: string | null; requested_by: string | null; approver_id: string | null;
  notes: string | null; created_at: string; decided_at: string | null;
}
export interface Waiver {
  id: string; project_id: string; subject_kind: string; subject_id: string;
  reason: string | null; granted_by: string | null; granted_at: string | null;
  expires_at: string | null; revoked_at: string | null; created_at: string;
}
export interface AIJob {
  id: string; workspace_id: string; project_id: string | null; kind: string; status: string;
  model: string | null; tokens_in: number | null; tokens_out: number | null;
  cost_usd: number | null; created_at: string; finished_at: string | null;
}
export interface AIOutput {
  id: string; ai_job_id: string; output_kind: string;
  target_kind: string | null; target_id: string | null; content: unknown; created_at: string;
}
export interface AIAuditEvent {
  id: string; ai_job_id: string | null; action: string;
  actor_id: string | null; details: unknown; created_at: string;
}
