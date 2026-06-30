// Hand-curated types mirroring the operations. Regenerate via `bun run codegen`.

export interface Edge<T> { node: T }
export interface Connection<T> { edges: Edge<T>[]; totalCount?: number }

export interface Repository {
  id: string; workspace_id: string; project_id: string | null;
  provider: string; name: string; url: string;
  default_branch: string | null; created_at: string;
}

export interface RequirementVersion {
  id: string; requirement_id: string; version_number: number;
  snapshot: unknown; author_id: string | null; created_at: string;
}

export interface Defect {
  id: string; title: string; status: string; severity: string | null;
  priority: string | null; project_id: string; assigned_to: string | null;
  reporter_id: string | null; created_at: string;
}

export interface DefectComment {
  id: string; defect_id: string; author_id: string | null; body: string; created_at: string;
}

export interface Approval {
  id: string; workspace_id: string; project_id: string | null;
  subject_type: string; subject_id: string; status: string;
  requested_by: string | null; approver_id: string | null;
  rationale: string | null; created_at: string; decided_at: string | null;
}

export interface Waiver {
  id: string; workspace_id: string; project_id: string | null;
  scope: string; reason: string | null;
  approved_by: string | null; expires_at: string | null; created_at: string;
}

export interface AIJob {
  id: string; workspace_id: string; project_id: string | null;
  job_type: string; status: string; model_name: string | null;
  prompt_tokens: number | null; completion_tokens: number | null;
  total_cost_cents: number | null; created_at: string; finished_at: string | null;
}

export interface AIOutput {
  id: string; job_id: string; kind: string; content: unknown; created_at: string;
}

export interface AIAuditEvent {
  id: string; job_id: string | null; event_type: string;
  actor_id: string | null; payload: unknown; created_at: string;
}
