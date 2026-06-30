import { gql as gqlTag } from "graphql-request";

// ---------- Repositories ----------
export const LIST_REPOSITORIES = gqlTag`
  query ListRepositories($first: Int = 50) {
    repositoriesCollection(first: $first, orderBy: [{ created_at: DescNullsLast }]) {
      edges { node { id workspace_id project_id provider name url default_branch created_at } }
    }
  }
`;

export const INSERT_REPOSITORY = gqlTag`
  mutation InsertRepository($obj: repositoriesInsertInput!) {
    insertIntorepositoriesCollection(objects: [$obj]) {
      records { id name url provider default_branch workspace_id project_id created_at }
    }
  }
`;

export const DELETE_REPOSITORY = gqlTag`
  mutation DeleteRepository($id: UUID!) {
    deleteFromrepositoriesCollection(filter: { id: { eq: $id } }) { records { id } }
  }
`;

// ---------- Requirement Versions ----------
export const LIST_REQUIREMENT_VERSIONS = gqlTag`
  query ListRequirementVersions($first: Int = 50) {
    requirement_versionsCollection(first: $first, orderBy: [{ created_at: DescNullsLast }]) {
      edges { node { id requirement_id version_number snapshot author_id created_at } }
    }
  }
`;

// ---------- Defects ----------
export const LIST_DEFECTS = gqlTag`
  query ListDefects($first: Int = 50) {
    defectsCollection(first: $first, orderBy: [{ created_at: DescNullsLast }]) {
      edges { node { id title status severity priority project_id assigned_to reporter_id created_at } }
    }
  }
`;

export const LIST_DEFECT_COMMENTS = gqlTag`
  query DefectComments($defectId: UUID!) {
    defect_commentsCollection(filter: { defect_id: { eq: $defectId } }, orderBy: [{ created_at: AscNullsLast }]) {
      edges { node { id defect_id author_id body created_at } }
    }
  }
`;

// ---------- Approvals & Waivers ----------
export const LIST_APPROVALS = gqlTag`
  query ListApprovals($first: Int = 50) {
    approvalsCollection(first: $first, orderBy: [{ created_at: DescNullsLast }]) {
      edges { node { id workspace_id project_id subject_type subject_id status requested_by approver_id rationale created_at decided_at } }
    }
  }
`;

export const UPDATE_APPROVAL = gqlTag`
  mutation UpdateApproval($id: UUID!, $patch: approvalsUpdateInput!) {
    updateapprovalsCollection(filter: { id: { eq: $id } }, set: $patch) { records { id status decided_at } }
  }
`;

export const LIST_WAIVERS = gqlTag`
  query ListWaivers($first: Int = 50) {
    waiversCollection(first: $first, orderBy: [{ created_at: DescNullsLast }]) {
      edges { node { id workspace_id project_id scope reason approved_by expires_at created_at } }
    }
  }
`;

// ---------- AI ----------
export const LIST_AI_JOBS = gqlTag`
  query ListAIJobs($first: Int = 50) {
    ai_jobsCollection(first: $first, orderBy: [{ created_at: DescNullsLast }]) {
      edges { node { id workspace_id project_id job_type status model_name prompt_tokens completion_tokens total_cost_cents created_at finished_at } }
    }
  }
`;

export const LIST_AI_OUTPUTS = gqlTag`
  query ListAIOutputs($jobId: UUID!) {
    ai_outputsCollection(filter: { job_id: { eq: $jobId } }) {
      edges { node { id job_id kind content created_at } }
    }
  }
`;

export const LIST_AI_AUDIT = gqlTag`
  query ListAIAudit($first: Int = 50) {
    ai_audit_eventsCollection(first: $first, orderBy: [{ created_at: DescNullsLast }]) {
      edges { node { id job_id event_type actor_id payload created_at } }
    }
  }
`;
