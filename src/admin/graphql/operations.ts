import { gql as gqlTag } from "graphql-request";

// ---------- Repositories ----------
export const LIST_REPOSITORIES = gqlTag`
  query ListRepositories($first: Int = 50) {
    repositoriesCollection(first: $first, orderBy: [{ created_at: DescNullsLast }]) {
      edges { node { id project_id provider url default_branch external_id created_at } }
    }
  }
`;

export const INSERT_REPOSITORY = gqlTag`
  mutation InsertRepository($obj: repositoriesInsertInput!) {
    insertIntorepositoriesCollection(objects: [$obj]) {
      records { id project_id provider url default_branch created_at }
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
      edges { node { id requirement_id version snapshot change_note changed_by created_at } }
    }
  }
`;

// ---------- Defects ----------
export const LIST_DEFECTS = gqlTag`
  query ListDefects($first: Int = 50) {
    defectsCollection(first: $first, orderBy: [{ created_at: DescNullsLast }]) {
      edges { node { id title status severity priority project_id assigned_to reported_by created_at } }
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
      edges { node { id project_id subject_kind subject_id status decision requested_by approver_id notes created_at decided_at } }
    }
  }
`;

export const UPDATE_APPROVAL = gqlTag`
  mutation UpdateApproval($id: UUID!, $patch: approvalsUpdateInput!) {
    updateapprovalsCollection(filter: { id: { eq: $id } }, set: $patch) { records { id status decision decided_at } }
  }
`;

export const LIST_WAIVERS = gqlTag`
  query ListWaivers($first: Int = 50) {
    waiversCollection(first: $first, orderBy: [{ created_at: DescNullsLast }]) {
      edges { node { id project_id subject_kind subject_id reason granted_by granted_at expires_at revoked_at created_at } }
    }
  }
`;

// ---------- AI ----------
export const LIST_AI_JOBS = gqlTag`
  query ListAIJobs($first: Int = 50) {
    ai_jobsCollection(first: $first, orderBy: [{ created_at: DescNullsLast }]) {
      edges { node { id workspace_id project_id kind status model tokens_in tokens_out cost_usd created_at finished_at } }
    }
  }
`;

export const LIST_AI_OUTPUTS = gqlTag`
  query ListAIOutputs($jobId: UUID!) {
    ai_outputsCollection(filter: { ai_job_id: { eq: $jobId } }) {
      edges { node { id ai_job_id output_kind target_kind target_id content created_at } }
    }
  }
`;

export const LIST_AI_AUDIT = gqlTag`
  query ListAIAudit($first: Int = 50) {
    ai_audit_eventsCollection(first: $first, orderBy: [{ created_at: DescNullsLast }]) {
      edges { node { id ai_job_id action actor_id details created_at } }
    }
  }
`;
