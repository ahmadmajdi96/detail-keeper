export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      acceptance_criteria: {
        Row: {
          created_at: string
          id: string
          order_index: number
          requirement_id: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_index?: number
          requirement_id: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          order_index?: number
          requirement_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "acceptance_criteria_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json
          object_id: string | null
          object_kind: string | null
          project_id: string | null
          summary: string | null
          verb: string
          workspace_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          object_id?: string | null
          object_kind?: string | null
          project_id?: string | null
          summary?: string | null
          verb: string
          workspace_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          object_id?: string | null
          object_kind?: string | null
          project_id?: string | null
          summary?: string | null
          verb?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_execution_logs: {
        Row: {
          action: string
          agent_id: string
          confidence: number | null
          duration_ms: number | null
          executed_at: string
          execution_id: string | null
          id: string
          result: string | null
        }
        Insert: {
          action: string
          agent_id: string
          confidence?: number | null
          duration_ms?: number | null
          executed_at?: string
          execution_id?: string | null
          id?: string
          result?: string | null
        }
        Update: {
          action?: string
          agent_id?: string
          confidence?: number | null
          duration_ms?: number | null
          executed_at?: string
          execution_id?: string | null
          id?: string
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_execution_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_execution_logs_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "test_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_learning_sessions: {
        Row: {
          agent_id: string
          completed_at: string | null
          id: string
          patterns_learned: number
          progress: number
          session_type: string
          started_at: string
          status: string
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          id?: string
          patterns_learned?: number
          progress?: number
          session_type: string
          started_at?: string
          status?: string
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          id?: string
          patterns_learned?: number
          progress?: number
          session_type?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_learning_sessions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          agent_type: string
          configuration: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          last_execution_at: string | null
          learning_progress: number
          name: string
          status: Database["public"]["Enums"]["agent_status"]
          success_rate: number | null
          total_executions: number
          updated_at: string
        }
        Insert: {
          agent_type?: string
          configuration?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          last_execution_at?: string | null
          learning_progress?: number
          name: string
          status?: Database["public"]["Enums"]["agent_status"]
          success_rate?: number | null
          total_executions?: number
          updated_at?: string
        }
        Update: {
          agent_type?: string
          configuration?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          last_execution_at?: string | null
          learning_progress?: number
          name?: string
          status?: Database["public"]["Enums"]["agent_status"]
          success_rate?: number | null
          total_executions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_audit_events: {
        Row: {
          action: string
          actor_id: string | null
          ai_job_id: string | null
          created_at: string
          details: Json
          id: string
          workspace_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          ai_job_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          workspace_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          ai_job_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_audit_events_ai_job_id_fkey"
            columns: ["ai_job_id"]
            isOneToOne: false
            referencedRelation: "ai_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_audit_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_evaluations: {
        Row: {
          ai_output_id: string | null
          created_at: string
          evaluator: string
          id: string
          metrics: Json
          notes: string | null
          score: number | null
          verdict: string | null
        }
        Insert: {
          ai_output_id?: string | null
          created_at?: string
          evaluator: string
          id?: string
          metrics?: Json
          notes?: string | null
          score?: number | null
          verdict?: string | null
        }
        Update: {
          ai_output_id?: string | null
          created_at?: string
          evaluator?: string
          id?: string
          metrics?: Json
          notes?: string | null
          score?: number | null
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_evaluations_ai_output_id_fkey"
            columns: ["ai_output_id"]
            isOneToOne: false
            referencedRelation: "ai_outputs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_feedback: {
        Row: {
          ai_output_id: string | null
          comment: string | null
          created_at: string
          id: string
          rating: number | null
          thumbs: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_output_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number | null
          thumbs?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_output_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number | null
          thumbs?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_ai_output_id_fkey"
            columns: ["ai_output_id"]
            isOneToOne: false
            referencedRelation: "ai_outputs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_jobs: {
        Row: {
          context: Json
          cost_usd: number | null
          created_at: string
          created_by: string | null
          error: string | null
          finished_at: string | null
          id: string
          kind: string
          model: string | null
          project_id: string | null
          prompt: Json | null
          started_at: string | null
          status: string
          tokens_in: number | null
          tokens_out: number | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          context?: Json
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          kind: string
          model?: string | null
          project_id?: string | null
          prompt?: Json | null
          started_at?: string | null
          status?: string
          tokens_in?: number | null
          tokens_out?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          context?: Json
          cost_usd?: number | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          model?: string | null
          project_id?: string | null
          prompt?: Json | null
          started_at?: string | null
          status?: string
          tokens_in?: number | null
          tokens_out?: number | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_outputs: {
        Row: {
          ai_job_id: string
          content: Json
          created_at: string
          id: string
          output_kind: string
          target_id: string | null
          target_kind: string | null
        }
        Insert: {
          ai_job_id: string
          content: Json
          created_at?: string
          id?: string
          output_kind: string
          target_id?: string | null
          target_kind?: string | null
        }
        Update: {
          ai_job_id?: string
          content?: Json
          created_at?: string
          id?: string
          output_kind?: string
          target_id?: string | null
          target_kind?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_outputs_ai_job_id_fkey"
            columns: ["ai_job_id"]
            isOneToOne: false
            referencedRelation: "ai_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      api_endpoints: {
        Row: {
          authentication: string | null
          created_at: string
          description: string | null
          document_id: string
          headers: Json | null
          id: string
          method: string
          parameters: Json | null
          path: string
          project_id: string | null
          request_body: Json | null
          response_schema: Json | null
          summary: string | null
          tags: string[] | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          authentication?: string | null
          created_at?: string
          description?: string | null
          document_id: string
          headers?: Json | null
          id?: string
          method: string
          parameters?: Json | null
          path: string
          project_id?: string | null
          request_body?: Json | null
          response_schema?: Json | null
          summary?: string | null
          tags?: string[] | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          authentication?: string | null
          created_at?: string
          description?: string | null
          document_id?: string
          headers?: Json | null
          id?: string
          method?: string
          parameters?: Json | null
          path?: string
          project_id?: string | null
          request_body?: Json | null
          response_schema?: Json | null
          summary?: string | null
          tags?: string[] | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_endpoints_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_endpoints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_endpoints_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          org_id: string
          revoked_at: string | null
          scopes: string[]
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          org_id: string
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          org_id?: string
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      api_test_executions: {
        Row: {
          assertion_results: Json | null
          assertions: Json | null
          created_at: string
          endpoint_id: string
          executed_at: string | null
          executor_id: string | null
          id: string
          method: string
          notes: string | null
          project_id: string | null
          request_body: string | null
          request_headers: Json | null
          response_body: string | null
          response_headers: Json | null
          response_status: number | null
          response_time_ms: number | null
          status: string
          test_plan_id: string | null
          url: string
          workspace_id: string | null
        }
        Insert: {
          assertion_results?: Json | null
          assertions?: Json | null
          created_at?: string
          endpoint_id: string
          executed_at?: string | null
          executor_id?: string | null
          id?: string
          method: string
          notes?: string | null
          project_id?: string | null
          request_body?: string | null
          request_headers?: Json | null
          response_body?: string | null
          response_headers?: Json | null
          response_status?: number | null
          response_time_ms?: number | null
          status?: string
          test_plan_id?: string | null
          url: string
          workspace_id?: string | null
        }
        Update: {
          assertion_results?: Json | null
          assertions?: Json | null
          created_at?: string
          endpoint_id?: string
          executed_at?: string | null
          executor_id?: string | null
          id?: string
          method?: string
          notes?: string | null
          project_id?: string | null
          request_body?: string | null
          request_headers?: Json | null
          response_body?: string | null
          response_headers?: Json | null
          response_status?: number | null
          response_time_ms?: number | null
          status?: string
          test_plan_id?: string | null
          url?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_test_executions_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "api_endpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_test_executions_executor_id_fkey"
            columns: ["executor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_test_executions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_test_executions_test_plan_id_fkey"
            columns: ["test_plan_id"]
            isOneToOne: false
            referencedRelation: "endpoint_test_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_test_executions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          approver_id: string | null
          created_at: string
          decided_at: string | null
          decision: string | null
          id: string
          notes: string | null
          project_id: string
          requested_by: string | null
          status: string
          subject_id: string
          subject_kind: string
          updated_at: string
        }
        Insert: {
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: string | null
          id?: string
          notes?: string | null
          project_id: string
          requested_by?: string | null
          status?: string
          subject_id: string
          subject_kind: string
          updated_at?: string
        }
        Update: {
          approver_id?: string | null
          created_at?: string
          decided_at?: string | null
          decision?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          requested_by?: string | null
          status?: string
          subject_id?: string
          subject_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string
          entity_id: string | null
          entity_kind: string | null
          id: string
          ip_address: string | null
          meta: Json
          org_id: string | null
          project_id: string | null
          user_agent: string | null
          workspace_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_kind?: string | null
          id?: string
          ip_address?: string | null
          meta?: Json
          org_id?: string | null
          project_id?: string | null
          user_agent?: string | null
          workspace_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_kind?: string | null
          id?: string
          ip_address?: string | null
          meta?: Json
          org_id?: string | null
          project_id?: string | null
          user_agent?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_assets: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          framework: string | null
          id: string
          kind: string
          language: string | null
          metadata: Json
          name: string
          path: string | null
          project_id: string
          repository_id: string | null
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          framework?: string | null
          id?: string
          kind?: string
          language?: string | null
          metadata?: Json
          name: string
          path?: string | null
          project_id: string
          repository_id?: string | null
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          framework?: string | null
          id?: string
          kind?: string
          language?: string | null
          metadata?: Json
          name?: string
          path?: string | null
          project_id?: string
          repository_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_assets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_assets_repository_id_fkey"
            columns: ["repository_id"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_mappings: {
        Row: {
          created_at: string
          framework: string
          id: string
          project_id: string
          test_case_id: string | null
          test_id_pattern: string
        }
        Insert: {
          created_at?: string
          framework: string
          id?: string
          project_id: string
          test_case_id?: string | null
          test_id_pattern: string
        }
        Update: {
          created_at?: string
          framework?: string
          id?: string
          project_id?: string
          test_case_id?: string | null
          test_id_pattern?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_mappings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_mappings_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      builds: {
        Row: {
          artifact_url: string | null
          branch: string | null
          built_at: string | null
          ci_provider: string | null
          ci_run_url: string | null
          commit_message: string | null
          commit_sha: string | null
          created_at: string
          created_by: string | null
          gh_html_url: string | null
          gh_run_id: number | null
          gh_workflow: string | null
          id: string
          metadata: Json
          name: string | null
          project_id: string
          release_id: string | null
          status: Database["public"]["Enums"]["build_status"]
          test_plan_id: string | null
          updated_at: string
        }
        Insert: {
          artifact_url?: string | null
          branch?: string | null
          built_at?: string | null
          ci_provider?: string | null
          ci_run_url?: string | null
          commit_message?: string | null
          commit_sha?: string | null
          created_at?: string
          created_by?: string | null
          gh_html_url?: string | null
          gh_run_id?: number | null
          gh_workflow?: string | null
          id?: string
          metadata?: Json
          name?: string | null
          project_id: string
          release_id?: string | null
          status?: Database["public"]["Enums"]["build_status"]
          test_plan_id?: string | null
          updated_at?: string
        }
        Update: {
          artifact_url?: string | null
          branch?: string | null
          built_at?: string | null
          ci_provider?: string | null
          ci_run_url?: string | null
          commit_message?: string | null
          commit_sha?: string | null
          created_at?: string
          created_by?: string | null
          gh_html_url?: string | null
          gh_run_id?: number | null
          gh_workflow?: string | null
          id?: string
          metadata?: Json
          name?: string | null
          project_id?: string
          release_id?: string | null
          status?: Database["public"]["Enums"]["build_status"]
          test_plan_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "builds_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builds_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builds_test_plan_id_fkey"
            columns: ["test_plan_id"]
            isOneToOne: false
            referencedRelation: "test_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_integrations: {
        Row: {
          branch_release_map: Json
          created_at: string
          created_by: string | null
          default_environment_id: string | null
          default_release_id: string | null
          id: string
          is_active: boolean
          name: string
          project_id: string
          provider: string
          secret_hash: string
          updated_at: string
        }
        Insert: {
          branch_release_map?: Json
          created_at?: string
          created_by?: string | null
          default_environment_id?: string | null
          default_release_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          project_id: string
          provider: string
          secret_hash: string
          updated_at?: string
        }
        Update: {
          branch_release_map?: Json
          created_at?: string
          created_by?: string | null
          default_environment_id?: string | null
          default_release_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          project_id?: string
          provider?: string
          secret_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ci_integrations_default_environment_id_fkey"
            columns: ["default_environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_integrations_default_release_id_fkey"
            columns: ["default_release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_integrations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ci_runs: {
        Row: {
          branch: string | null
          build_id: string | null
          commit_sha: string | null
          created_at: string
          finished_at: string | null
          id: string
          integration_id: string | null
          project_id: string
          provider: string
          provider_run_id: string | null
          raw: Json
          started_at: string | null
          status: string
          url: string | null
        }
        Insert: {
          branch?: string | null
          build_id?: string | null
          commit_sha?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          integration_id?: string | null
          project_id: string
          provider: string
          provider_run_id?: string | null
          raw?: Json
          started_at?: string | null
          status?: string
          url?: string | null
        }
        Update: {
          branch?: string | null
          build_id?: string | null
          commit_sha?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          integration_id?: string | null
          project_id?: string
          provider?: string
          provider_run_id?: string | null
          raw?: Json
          started_at?: string | null
          status?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ci_runs_build_id_fkey"
            columns: ["build_id"]
            isOneToOne: false
            referencedRelation: "builds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_runs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "ci_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ci_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      commits: {
        Row: {
          author_email: string | null
          author_name: string | null
          branch: string | null
          committed_at: string | null
          created_at: string
          id: string
          message: string | null
          metadata: Json
          repository_id: string
          sha: string
          url: string | null
        }
        Insert: {
          author_email?: string | null
          author_name?: string | null
          branch?: string | null
          committed_at?: string | null
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json
          repository_id: string
          sha: string
          url?: string | null
        }
        Update: {
          author_email?: string | null
          author_name?: string | null
          branch?: string | null
          committed_at?: string | null
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json
          repository_id?: string
          sha?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commits_repository_id_fkey"
            columns: ["repository_id"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_attempts: {
        Row: {
          attempt_no: number
          created_at: string
          duration_ms: number | null
          error_signature: string | null
          evidence: Json
          executor_id: string | null
          finished_at: string | null
          id: string
          logs_ref: string | null
          notes: string | null
          run_item_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["run_item_status"]
        }
        Insert: {
          attempt_no: number
          created_at?: string
          duration_ms?: number | null
          error_signature?: string | null
          evidence?: Json
          executor_id?: string | null
          finished_at?: string | null
          id?: string
          logs_ref?: string | null
          notes?: string | null
          run_item_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["run_item_status"]
        }
        Update: {
          attempt_no?: number
          created_at?: string
          duration_ms?: number | null
          error_signature?: string | null
          evidence?: Json
          executor_id?: string | null
          finished_at?: string | null
          id?: string
          logs_ref?: string | null
          notes?: string | null
          run_item_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["run_item_status"]
        }
        Relationships: [
          {
            foreignKeyName: "cycle_attempts_run_item_id_fkey"
            columns: ["run_item_id"]
            isOneToOne: false
            referencedRelation: "cycle_run_items"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_run_items: {
        Row: {
          assignee_id: string | null
          attempt_count: number
          created_at: string
          cycle_id: string
          duration_ms: number | null
          evidence: Json
          id: string
          last_executed_at: string | null
          notes: string | null
          run_id: string
          status: Database["public"]["Enums"]["run_item_status"]
          test_case_id: string
          test_case_version: number | null
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          attempt_count?: number
          created_at?: string
          cycle_id: string
          duration_ms?: number | null
          evidence?: Json
          id?: string
          last_executed_at?: string | null
          notes?: string | null
          run_id: string
          status?: Database["public"]["Enums"]["run_item_status"]
          test_case_id: string
          test_case_version?: number | null
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          attempt_count?: number
          created_at?: string
          cycle_id?: string
          duration_ms?: number | null
          evidence?: Json
          id?: string
          last_executed_at?: string | null
          notes?: string | null
          run_id?: string
          status?: Database["public"]["Enums"]["run_item_status"]
          test_case_id?: string
          test_case_version?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_run_items_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "test_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_run_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "cycle_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_run_items_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_runs: {
        Row: {
          created_at: string
          cycle_id: string
          executor_id: string | null
          finished_at: string | null
          id: string
          name: string | null
          notes: string | null
          project_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["run_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_id: string
          executor_id?: string | null
          finished_at?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          project_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["run_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_id?: string
          executor_id?: string | null
          finished_at?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          project_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["run_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_runs_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "test_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cycle_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      defect_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          defect_id: string
          id: string
          metadata: Json
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          defect_id: string
          id?: string
          metadata?: Json
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          defect_id?: string
          id?: string
          metadata?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "defect_comments_defect_id_fkey"
            columns: ["defect_id"]
            isOneToOne: false
            referencedRelation: "defects"
            referencedColumns: ["id"]
          },
        ]
      }
      defect_history: {
        Row: {
          changed_by: string | null
          created_at: string
          defect_id: string
          field_name: string
          id: string
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          defect_id: string
          field_name: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          defect_id?: string
          field_name?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "defect_history_defect_id_fkey"
            columns: ["defect_id"]
            isOneToOne: false
            referencedRelation: "defects"
            referencedColumns: ["id"]
          },
        ]
      }
      defect_links: {
        Row: {
          created_at: string
          created_by: string | null
          defect_id: string
          id: string
          link_type: string
          metadata: Json
          target_id: string
          target_kind: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          defect_id: string
          id?: string
          link_type: string
          metadata?: Json
          target_id: string
          target_kind: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          defect_id?: string
          id?: string
          link_type?: string
          metadata?: Json
          target_id?: string
          target_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "defect_links_defect_id_fkey"
            columns: ["defect_id"]
            isOneToOne: false
            referencedRelation: "defects"
            referencedColumns: ["id"]
          },
        ]
      }
      defect_slas: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          name: string
          project_id: string
          resolution_hours: number | null
          response_hours: number | null
          severity: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          project_id: string
          resolution_hours?: number | null
          response_hours?: number | null
          severity: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          project_id?: string
          resolution_hours?: number | null
          response_hours?: number | null
          severity?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "defect_slas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      defects: {
        Row: {
          assigned_to: string | null
          build_id: string | null
          closed_at: string | null
          created_at: string
          cycle_attempt_id: string | null
          cycle_run_id: string | null
          cycle_run_item_id: string | null
          dedup_signature: string | null
          description: string | null
          execution_id: string | null
          id: string
          jira_issue_key: string | null
          jira_issue_url: string | null
          priority: Database["public"]["Enums"]["defect_priority"]
          project_id: string | null
          release_id: string | null
          reported_by: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["defect_severity"]
          status: string
          step_result_id: string | null
          test_plan_id: string | null
          title: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          build_id?: string | null
          closed_at?: string | null
          created_at?: string
          cycle_attempt_id?: string | null
          cycle_run_id?: string | null
          cycle_run_item_id?: string | null
          dedup_signature?: string | null
          description?: string | null
          execution_id?: string | null
          id?: string
          jira_issue_key?: string | null
          jira_issue_url?: string | null
          priority?: Database["public"]["Enums"]["defect_priority"]
          project_id?: string | null
          release_id?: string | null
          reported_by?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["defect_severity"]
          status?: string
          step_result_id?: string | null
          test_plan_id?: string | null
          title: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          build_id?: string | null
          closed_at?: string | null
          created_at?: string
          cycle_attempt_id?: string | null
          cycle_run_id?: string | null
          cycle_run_item_id?: string | null
          dedup_signature?: string | null
          description?: string | null
          execution_id?: string | null
          id?: string
          jira_issue_key?: string | null
          jira_issue_url?: string | null
          priority?: Database["public"]["Enums"]["defect_priority"]
          project_id?: string | null
          release_id?: string | null
          reported_by?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["defect_severity"]
          status?: string
          step_result_id?: string | null
          test_plan_id?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "defects_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defects_build_id_fkey"
            columns: ["build_id"]
            isOneToOne: false
            referencedRelation: "builds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defects_cycle_attempt_id_fkey"
            columns: ["cycle_attempt_id"]
            isOneToOne: false
            referencedRelation: "cycle_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defects_cycle_run_id_fkey"
            columns: ["cycle_run_id"]
            isOneToOne: false
            referencedRelation: "cycle_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defects_cycle_run_item_id_fkey"
            columns: ["cycle_run_item_id"]
            isOneToOne: false
            referencedRelation: "cycle_run_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defects_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "test_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defects_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defects_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defects_step_result_id_fkey"
            columns: ["step_result_id"]
            isOneToOne: false
            referencedRelation: "execution_step_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defects_test_plan_id_fkey"
            columns: ["test_plan_id"]
            isOneToOne: false
            referencedRelation: "test_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          kind: string
          org_id: string | null
          reason: string | null
          requested_by: string
          status: string
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          kind: string
          org_id?: string | null
          reason?: string | null
          requested_by: string
          status?: string
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          org_id?: string | null
          reason?: string | null
          requested_by?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deletion_requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deployments: {
        Row: {
          build_id: string
          created_at: string
          deployed_at: string | null
          deployed_by: string | null
          environment_id: string
          id: string
          metadata: Json
          notes: string | null
          project_id: string
          status: Database["public"]["Enums"]["deployment_status"]
          updated_at: string
          url: string | null
        }
        Insert: {
          build_id: string
          created_at?: string
          deployed_at?: string | null
          deployed_by?: string | null
          environment_id: string
          id?: string
          metadata?: Json
          notes?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["deployment_status"]
          updated_at?: string
          url?: string | null
        }
        Update: {
          build_id?: string
          created_at?: string
          deployed_at?: string | null
          deployed_by?: string | null
          environment_id?: string
          id?: string
          metadata?: Json
          notes?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["deployment_status"]
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deployments_build_id_fkey"
            columns: ["build_id"]
            isOneToOne: false
            referencedRelation: "builds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deployments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          file_size: number
          filename: string
          id: string
          mime_type: string
          processed_at: string | null
          project_id: string | null
          requirements_count: number | null
          status: string
          uploader_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          file_size?: number
          filename: string
          id?: string
          mime_type: string
          processed_at?: string | null
          project_id?: string | null
          requirements_count?: number | null
          status?: string
          uploader_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          file_size?: number
          filename?: string
          id?: string
          mime_type?: string
          processed_at?: string | null
          project_id?: string | null
          requirements_count?: number | null
          status?: string
          uploader_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      endpoint_prds: {
        Row: {
          acceptance_criteria: Json | null
          created_at: string
          dependencies: Json | null
          endpoint_id: string
          full_content: string | null
          functional_requirements: Json | null
          generated_at: string
          id: string
          non_functional_requirements: Json | null
          objectives: Json | null
          overview: string | null
          project_id: string | null
          risks: Json | null
          title: string
          workspace_id: string | null
        }
        Insert: {
          acceptance_criteria?: Json | null
          created_at?: string
          dependencies?: Json | null
          endpoint_id: string
          full_content?: string | null
          functional_requirements?: Json | null
          generated_at?: string
          id?: string
          non_functional_requirements?: Json | null
          objectives?: Json | null
          overview?: string | null
          project_id?: string | null
          risks?: Json | null
          title: string
          workspace_id?: string | null
        }
        Update: {
          acceptance_criteria?: Json | null
          created_at?: string
          dependencies?: Json | null
          endpoint_id?: string
          full_content?: string | null
          functional_requirements?: Json | null
          generated_at?: string
          id?: string
          non_functional_requirements?: Json | null
          objectives?: Json | null
          overview?: string | null
          project_id?: string | null
          risks?: Json | null
          title?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "endpoint_prds_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "api_endpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "endpoint_prds_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "endpoint_prds_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      endpoint_test_plans: {
        Row: {
          coverage_areas: Json | null
          created_at: string
          description: string | null
          endpoint_id: string
          generated_at: string
          id: string
          name: string
          preconditions: string | null
          project_id: string | null
          status: string
          test_cases: Json | null
          test_data: Json | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          coverage_areas?: Json | null
          created_at?: string
          description?: string | null
          endpoint_id: string
          generated_at?: string
          id?: string
          name: string
          preconditions?: string | null
          project_id?: string | null
          status?: string
          test_cases?: Json | null
          test_data?: Json | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          coverage_areas?: Json | null
          created_at?: string
          description?: string | null
          endpoint_id?: string
          generated_at?: string
          id?: string
          name?: string
          preconditions?: string | null
          project_id?: string | null
          status?: string
          test_cases?: Json | null
          test_data?: Json | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "endpoint_test_plans_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "api_endpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "endpoint_test_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "endpoint_test_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      environments: {
        Row: {
          base_url: string | null
          config: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          project_id: string
          type: Database["public"]["Enums"]["environment_type"]
          updated_at: string
        }
        Insert: {
          base_url?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          project_id: string
          type?: Database["public"]["Enums"]["environment_type"]
          updated_at?: string
        }
        Update: {
          base_url?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          project_id?: string
          type?: Database["public"]["Enums"]["environment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "environments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          captured_at: string
          cycle_attempt_id: string | null
          cycle_run_id: string | null
          cycle_run_item_id: string | null
          defect_id: string | null
          description: string | null
          execution_id: string | null
          file_name: string
          file_type: string
          file_url: string
          id: string
          project_id: string | null
          size_bytes: number | null
          step_result_id: string | null
          storage_path: string | null
          uploaded_by: string | null
          workspace_id: string | null
        }
        Insert: {
          captured_at?: string
          cycle_attempt_id?: string | null
          cycle_run_id?: string | null
          cycle_run_item_id?: string | null
          defect_id?: string | null
          description?: string | null
          execution_id?: string | null
          file_name: string
          file_type: string
          file_url: string
          id?: string
          project_id?: string | null
          size_bytes?: number | null
          step_result_id?: string | null
          storage_path?: string | null
          uploaded_by?: string | null
          workspace_id?: string | null
        }
        Update: {
          captured_at?: string
          cycle_attempt_id?: string | null
          cycle_run_id?: string | null
          cycle_run_item_id?: string | null
          defect_id?: string | null
          description?: string | null
          execution_id?: string | null
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          project_id?: string | null
          size_bytes?: number | null
          step_result_id?: string | null
          storage_path?: string | null
          uploaded_by?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_cycle_attempt_id_fkey"
            columns: ["cycle_attempt_id"]
            isOneToOne: false
            referencedRelation: "cycle_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_cycle_run_id_fkey"
            columns: ["cycle_run_id"]
            isOneToOne: false
            referencedRelation: "cycle_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_cycle_run_item_id_fkey"
            columns: ["cycle_run_item_id"]
            isOneToOne: false
            referencedRelation: "cycle_run_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_defect_id_fkey"
            columns: ["defect_id"]
            isOneToOne: false
            referencedRelation: "defects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "test_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_step_result_id_fkey"
            columns: ["step_result_id"]
            isOneToOne: false
            referencedRelation: "execution_step_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      execution_step_results: {
        Row: {
          actual_result: string | null
          executed_at: string | null
          execution_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["execution_status"]
          step_id: string
        }
        Insert: {
          actual_result?: string | null
          executed_at?: string | null
          execution_id: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["execution_status"]
          step_id: string
        }
        Update: {
          actual_result?: string | null
          executed_at?: string | null
          execution_id?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["execution_status"]
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "execution_step_results_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "test_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "execution_step_results_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "test_case_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      gate_evaluations: {
        Row: {
          blocks_release: boolean
          build_id: string | null
          created_at: string
          cycle_run_id: string | null
          evaluated_at: string
          gate_id: string
          id: string
          metrics: Json
          project_id: string
          release_id: string | null
          rule_results: Json
          status: string
          workspace_id: string
        }
        Insert: {
          blocks_release?: boolean
          build_id?: string | null
          created_at?: string
          cycle_run_id?: string | null
          evaluated_at?: string
          gate_id: string
          id?: string
          metrics?: Json
          project_id: string
          release_id?: string | null
          rule_results?: Json
          status: string
          workspace_id: string
        }
        Update: {
          blocks_release?: boolean
          build_id?: string | null
          created_at?: string
          cycle_run_id?: string | null
          evaluated_at?: string
          gate_id?: string
          id?: string
          metrics?: Json
          project_id?: string
          release_id?: string | null
          rule_results?: Json
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gate_evaluations_build_id_fkey"
            columns: ["build_id"]
            isOneToOne: false
            referencedRelation: "builds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_evaluations_cycle_run_id_fkey"
            columns: ["cycle_run_id"]
            isOneToOne: false
            referencedRelation: "cycle_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_evaluations_gate_id_fkey"
            columns: ["gate_id"]
            isOneToOne: false
            referencedRelation: "quality_gates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_evaluations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_evaluations_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_evaluations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_stage_logs: {
        Row: {
          created_at: string
          dry_run: boolean
          execution_skipped: boolean
          id: string
          install_skipped: boolean
          kind: string
          message: string
          meta: Json
          stage: string
          test_plan_id: string
        }
        Insert: {
          created_at?: string
          dry_run?: boolean
          execution_skipped?: boolean
          id?: string
          install_skipped?: boolean
          kind: string
          message: string
          meta?: Json
          stage: string
          test_plan_id: string
        }
        Update: {
          created_at?: string
          dry_run?: boolean
          execution_skipped?: boolean
          id?: string
          install_skipped?: boolean
          kind?: string
          message?: string
          meta?: Json
          stage?: string
          test_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_stage_logs_test_plan_id_fkey"
            columns: ["test_plan_id"]
            isOneToOne: false
            referencedRelation: "test_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      github_repo_mappings: {
        Row: {
          created_at: string
          created_by: string | null
          default_branch: string
          id: string
          owner: string
          project_id: string
          repo: string
          test_plan_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_branch?: string
          id?: string
          owner: string
          project_id: string
          repo: string
          test_plan_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_branch?: string
          id?: string
          owner?: string
          project_id?: string
          repo?: string
          test_plan_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "github_repo_mappings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "github_repo_mappings_test_plan_id_fkey"
            columns: ["test_plan_id"]
            isOneToOne: false
            referencedRelation: "test_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "github_repo_mappings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_activity_log: {
        Row: {
          counts: Json | null
          id: string
          kind: string
          message: string | null
          occurred_at: string
          provider: string
          status: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          counts?: Json | null
          id?: string
          kind: string
          message?: string | null
          occurred_at?: string
          provider: string
          status: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          counts?: Json | null
          id?: string
          kind?: string
          message?: string | null
          occurred_at?: string
          provider?: string
          status?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_activity_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          id: string
          integration_id: string | null
          last_error: string | null
          last_error_at: string | null
          last_sync_at: string | null
          name: string | null
          project_id: string | null
          slug: string
          status: string
          sync_enabled: boolean
          updated_at: string
          workspace_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          integration_id?: string | null
          last_error?: string | null
          last_error_at?: string | null
          last_sync_at?: string | null
          name?: string | null
          project_id?: string | null
          slug: string
          status?: string
          sync_enabled?: boolean
          updated_at?: string
          workspace_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          integration_id?: string | null
          last_error?: string | null
          last_error_at?: string | null
          last_sync_at?: string | null
          name?: string | null
          project_id?: string | null
          slug?: string
          status?: string
          sync_enabled?: boolean
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_connections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          category: string
          config_schema: Json
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          category: string
          config_schema?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          category?: string
          config_schema?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      jira_project_mappings: {
        Row: {
          auto_link_rule: Json
          created_at: string
          created_by: string | null
          id: string
          jira_cloud_id: string
          jira_project_key: string
          jira_site_url: string | null
          project_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          auto_link_rule?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          jira_cloud_id: string
          jira_project_key: string
          jira_site_url?: string | null
          project_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          auto_link_rule?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          jira_cloud_id?: string
          jira_project_key?: string
          jira_site_url?: string | null
          project_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jira_project_mappings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jira_project_mappings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      job_artifacts: {
        Row: {
          created_at: string
          id: string
          job_id: string
          kind: string
          meta: Json
          ref: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          kind: string
          meta?: Json
          ref: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          kind?: string
          meta?: Json
          ref?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_artifacts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_attempts: {
        Row: {
          attempt_no: number
          error: Json | null
          finished_at: string | null
          id: string
          job_id: string
          logs: string | null
          started_at: string
          status: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          attempt_no: number
          error?: Json | null
          finished_at?: string | null
          id?: string
          job_id: string
          logs?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          attempt_no?: number
          error?: Json | null
          finished_at?: string | null
          id?: string
          job_id?: string
          logs?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "job_attempts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          attempt_count: number
          checkpoint: Json | null
          created_at: string
          created_by: string | null
          error: Json | null
          id: string
          idempotency_key: string | null
          kind: string
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          priority: number
          progress: number
          progress_message: string | null
          project_id: string | null
          result: Json | null
          run_after: string
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          attempt_count?: number
          checkpoint?: Json | null
          created_at?: string
          created_by?: string | null
          error?: Json | null
          id?: string
          idempotency_key?: string | null
          kind: string
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          progress?: number
          progress_message?: string | null
          project_id?: string | null
          result?: Json | null
          run_after?: string
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          attempt_count?: number
          checkpoint?: Json | null
          created_at?: string
          created_by?: string | null
          error?: Json | null
          id?: string
          idempotency_key?: string | null
          kind?: string
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          progress?: number
          progress_message?: string | null
          project_id?: string | null
          result?: Json | null
          run_after?: string
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      milestones: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          name: string
          project_id: string
          release_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          name: string
          project_id: string
          release_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          name?: string
          project_id?: string
          release_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message: string
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          notification_config: Json
          owner_id: string | null
          require_mfa: boolean
          settings: Json
          slack_webhook_url: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          notification_config?: Json
          owner_id?: string | null
          require_mfa?: boolean
          settings?: Json
          slack_webhook_url?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          notification_config?: Json
          owner_id?: string | null
          require_mfa?: boolean
          settings?: Json
          slack_webhook_url?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      plan_test_runs: {
        Row: {
          artifacts: Json
          base_url: string | null
          codegen_job_ref: string | null
          created_at: string
          created_by: string | null
          events: Json
          exit_code: number | null
          failed_tests: number
          finished_at: string | null
          forge_run_id: string | null
          id: string
          last_polled_at: string | null
          passed_tests: number
          progress_message: string | null
          project_id: string | null
          result: Json | null
          running_tests: number
          started_at: string | null
          status: string
          test_plan_id: string
          total_tests: number
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          artifacts?: Json
          base_url?: string | null
          codegen_job_ref?: string | null
          created_at?: string
          created_by?: string | null
          events?: Json
          exit_code?: number | null
          failed_tests?: number
          finished_at?: string | null
          forge_run_id?: string | null
          id?: string
          last_polled_at?: string | null
          passed_tests?: number
          progress_message?: string | null
          project_id?: string | null
          result?: Json | null
          running_tests?: number
          started_at?: string | null
          status?: string
          test_plan_id: string
          total_tests?: number
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          artifacts?: Json
          base_url?: string | null
          codegen_job_ref?: string | null
          created_at?: string
          created_by?: string | null
          events?: Json
          exit_code?: number | null
          failed_tests?: number
          finished_at?: string | null
          forge_run_id?: string | null
          id?: string
          last_polled_at?: string | null
          passed_tests?: number
          progress_message?: string | null
          project_id?: string | null
          result?: Json | null
          running_tests?: number
          started_at?: string | null
          status?: string
          test_plan_id?: string
          total_tests?: number
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_test_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_test_runs_test_plan_id_fkey"
            columns: ["test_plan_id"]
            isOneToOne: false
            referencedRelation: "test_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_test_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          entitlements: Json
          id: string
          is_active: boolean
          key: string
          monthly_price_cents: number
          name: string
          updated_at: string
          yearly_price_cents: number
        }
        Insert: {
          created_at?: string
          entitlements?: Json
          id?: string
          is_active?: boolean
          key: string
          monthly_price_cents?: number
          name: string
          updated_at?: string
          yearly_price_cents?: number
        }
        Update: {
          created_at?: string
          entitlements?: Json
          id?: string
          is_active?: boolean
          key?: string
          monthly_price_cents?: number
          name?: string
          updated_at?: string
          yearly_price_cents?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar: string | null
          created_at: string
          email: string
          id: string
          language: string
          last_login: string | null
          last_organization_id: string | null
          last_project_id: string | null
          last_workspace_id: string | null
          name: string
          notification_prefs: Json
          onboarding_completed_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          slack_webhook_url: string | null
          status: Database["public"]["Enums"]["user_status"]
          team_id: string | null
          terms_accepted_at: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          email: string
          id: string
          language?: string
          last_login?: string | null
          last_organization_id?: string | null
          last_project_id?: string | null
          last_workspace_id?: string | null
          name: string
          notification_prefs?: Json
          onboarding_completed_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          slack_webhook_url?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          team_id?: string | null
          terms_accepted_at?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          email?: string
          id?: string
          language?: string
          last_login?: string | null
          last_organization_id?: string | null
          last_project_id?: string | null
          last_workspace_id?: string | null
          name?: string
          notification_prefs?: Json
          onboarding_completed_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          slack_webhook_url?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          team_id?: string | null
          terms_accepted_at?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      project_generated_docs: {
        Row: {
          content: string
          created_at: string
          edited: boolean
          edited_by: string | null
          filename: string
          id: string
          job_id: string
          project_id: string
          slug: string
          source_bytes: number | null
          source_hash: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          edited?: boolean
          edited_by?: string | null
          filename: string
          id?: string
          job_id: string
          project_id: string
          slug: string
          source_bytes?: number | null
          source_hash?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          edited?: boolean
          edited_by?: string | null
          filename?: string
          id?: string
          job_id?: string
          project_id?: string
          slug?: string
          source_bytes?: number | null
          source_hash?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_generated_docs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          id: string
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          endpoints_count: number | null
          files_count: number | null
          github_branch: string | null
          github_is_private: boolean | null
          github_repo_visibility: string
          github_token_secret_name: string | null
          github_url: string | null
          id: string
          last_processed_at: string | null
          name: string
          process_error: string | null
          repo_job_id: string | null
          repo_job_meta: Json | null
          repo_job_progress: number | null
          repo_job_status: string | null
          slack_channel_id: string | null
          slack_channel_name: string | null
          source_type: Database["public"]["Enums"]["project_source"]
          status: Database["public"]["Enums"]["project_status"]
          suite_grouping_rules: Json
          test_cases_count: number | null
          updated_at: string
          visibility: Database["public"]["Enums"]["project_visibility"]
          workspace_id: string
          zip_storage_path: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          endpoints_count?: number | null
          files_count?: number | null
          github_branch?: string | null
          github_is_private?: boolean | null
          github_repo_visibility?: string
          github_token_secret_name?: string | null
          github_url?: string | null
          id?: string
          last_processed_at?: string | null
          name: string
          process_error?: string | null
          repo_job_id?: string | null
          repo_job_meta?: Json | null
          repo_job_progress?: number | null
          repo_job_status?: string | null
          slack_channel_id?: string | null
          slack_channel_name?: string | null
          source_type?: Database["public"]["Enums"]["project_source"]
          status?: Database["public"]["Enums"]["project_status"]
          suite_grouping_rules?: Json
          test_cases_count?: number | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["project_visibility"]
          workspace_id: string
          zip_storage_path?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          endpoints_count?: number | null
          files_count?: number | null
          github_branch?: string | null
          github_is_private?: boolean | null
          github_repo_visibility?: string
          github_token_secret_name?: string | null
          github_url?: string | null
          id?: string
          last_processed_at?: string | null
          name?: string
          process_error?: string | null
          repo_job_id?: string | null
          repo_job_meta?: Json | null
          repo_job_progress?: number | null
          repo_job_status?: string | null
          slack_channel_id?: string | null
          slack_channel_name?: string | null
          source_type?: Database["public"]["Enums"]["project_source"]
          status?: Database["public"]["Enums"]["project_status"]
          suite_grouping_rules?: Json
          test_cases_count?: number | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["project_visibility"]
          workspace_id?: string
          zip_storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      pull_requests: {
        Row: {
          author: string | null
          body: string | null
          created_at: string
          head_sha: string | null
          id: string
          merged_at: string | null
          metadata: Json
          number: number
          repository_id: string
          source_branch: string | null
          state: string
          target_branch: string | null
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          author?: string | null
          body?: string | null
          created_at?: string
          head_sha?: string | null
          id?: string
          merged_at?: string | null
          metadata?: Json
          number: number
          repository_id: string
          source_branch?: string | null
          state?: string
          target_branch?: string | null
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          author?: string | null
          body?: string | null
          created_at?: string
          head_sha?: string | null
          id?: string
          merged_at?: string | null
          metadata?: Json
          number?: number
          repository_id?: string
          source_branch?: string | null
          state?: string
          target_branch?: string | null
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pull_requests_repository_id_fkey"
            columns: ["repository_id"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_gates: {
        Row: {
          blocks_release: boolean
          created_at: string
          created_by: string | null
          description: string | null
          enabled: boolean
          environment_id: string | null
          id: string
          name: string
          project_id: string
          rules: Json
          scope: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          blocks_release?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          environment_id?: string | null
          id?: string
          name: string
          project_id: string
          rules?: Json
          scope?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          blocks_release?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          enabled?: boolean
          environment_id?: string | null
          id?: string
          name?: string
          project_id?: string
          rules?: Json
          scope?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_gates_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_gates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_gates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      release_evaluations: {
        Row: {
          created_at: string
          created_by: string | null
          cycle_run_id: string | null
          deployment_id: string | null
          failure_themes: Json | null
          feedback_by: string | null
          feedback_note: string | null
          feedback_score: number | null
          id: string
          metrics: Json | null
          model: string | null
          next_actions: Json | null
          project_id: string
          release_id: string | null
          score: number | null
          summary: string | null
          updated_at: string
          verdict: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cycle_run_id?: string | null
          deployment_id?: string | null
          failure_themes?: Json | null
          feedback_by?: string | null
          feedback_note?: string | null
          feedback_score?: number | null
          id?: string
          metrics?: Json | null
          model?: string | null
          next_actions?: Json | null
          project_id: string
          release_id?: string | null
          score?: number | null
          summary?: string | null
          updated_at?: string
          verdict?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cycle_run_id?: string | null
          deployment_id?: string | null
          failure_themes?: Json | null
          feedback_by?: string | null
          feedback_note?: string | null
          feedback_score?: number | null
          id?: string
          metrics?: Json | null
          model?: string | null
          next_actions?: Json | null
          project_id?: string
          release_id?: string | null
          score?: number | null
          summary?: string | null
          updated_at?: string
          verdict?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "release_evaluations_cycle_run_id_fkey"
            columns: ["cycle_run_id"]
            isOneToOne: false
            referencedRelation: "cycle_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "release_evaluations_deployment_id_fkey"
            columns: ["deployment_id"]
            isOneToOne: false
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "release_evaluations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "release_evaluations_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "release_evaluations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      releases: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          metadata: Json
          name: string
          owner_id: string | null
          project_id: string
          released_at: string | null
          status: Database["public"]["Enums"]["release_status"]
          target_date: string | null
          updated_at: string
          version: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          name: string
          owner_id?: string | null
          project_id: string
          released_at?: string | null
          status?: Database["public"]["Enums"]["release_status"]
          target_date?: string | null
          updated_at?: string
          version?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          metadata?: Json
          name?: string
          owner_id?: string | null
          project_id?: string
          released_at?: string | null
          status?: Database["public"]["Enums"]["release_status"]
          target_date?: string | null
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "releases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      repositories: {
        Row: {
          created_at: string
          default_branch: string | null
          external_id: string | null
          id: string
          metadata: Json
          project_id: string
          provider: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          default_branch?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json
          project_id: string
          provider?: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          default_branch?: string | null
          external_id?: string | null
          id?: string
          metadata?: Json
          project_id?: string
          provider?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "repositories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      repository_branches: {
        Row: {
          created_at: string
          head_sha: string | null
          id: string
          is_default: boolean
          name: string
          protected: boolean
          repository_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          head_sha?: string | null
          id?: string
          is_default?: boolean
          name: string
          protected?: boolean
          repository_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          head_sha?: string | null
          id?: string
          is_default?: boolean
          name?: string
          protected?: boolean
          repository_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repository_branches_repository_id_fkey"
            columns: ["repository_id"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          linked_id: string
          linked_type: string
          requirement_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          linked_id: string
          linked_type: string
          requirement_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          linked_id?: string
          linked_type?: string
          requirement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirement_links_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_versions: {
        Row: {
          change_note: string | null
          changed_by: string | null
          created_at: string
          id: string
          requirement_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          change_note?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          requirement_id: string
          snapshot: Json
          version: number
        }
        Update: {
          change_note?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          requirement_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "requirement_versions_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: false
            referencedRelation: "requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      requirements: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          key: string | null
          priority: number
          project_id: string
          source_document_id: string | null
          status: Database["public"]["Enums"]["requirement_status"]
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key?: string | null
          priority?: number
          project_id: string
          source_document_id?: string | null
          status?: Database["public"]["Enums"]["requirement_status"]
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          key?: string | null
          priority?: number
          project_id?: string
          source_document_id?: string | null
          status?: Database["public"]["Enums"]["requirement_status"]
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requirements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requirements_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      root_cause_records: {
        Row: {
          category: string | null
          created_at: string
          defect_id: string
          details: string | null
          id: string
          identified_at: string
          identified_by: string | null
          preventive_actions: string | null
          summary: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          defect_id: string
          details?: string | null
          id?: string
          identified_at?: string
          identified_by?: string | null
          preventive_actions?: string | null
          summary: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          defect_id?: string
          details?: string | null
          id?: string
          identified_at?: string
          identified_by?: string | null
          preventive_actions?: string | null
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "root_cause_records_defect_id_fkey"
            columns: ["defect_id"]
            isOneToOne: false
            referencedRelation: "defects"
            referencedColumns: ["id"]
          },
        ]
      }
      runner_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          labels: string[]
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          labels?: string[]
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          labels?: string[]
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runner_groups_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      runner_jobs: {
        Row: {
          attempt: number
          created_at: string
          created_by: string | null
          cycle_id: string | null
          cycle_run_id: string | null
          dispatched_at: string | null
          environment_id: string | null
          error: Json | null
          finished_at: string | null
          id: string
          logs_url: string | null
          max_attempts: number
          payload: Json
          priority: number
          progress: number
          project_id: string
          queued_at: string
          release_id: string | null
          result: Json | null
          runner_id: string | null
          started_at: string | null
          status: string
          suite_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          created_by?: string | null
          cycle_id?: string | null
          cycle_run_id?: string | null
          dispatched_at?: string | null
          environment_id?: string | null
          error?: Json | null
          finished_at?: string | null
          id?: string
          logs_url?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          progress?: number
          project_id: string
          queued_at?: string
          release_id?: string | null
          result?: Json | null
          runner_id?: string | null
          started_at?: string | null
          status?: string
          suite_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          attempt?: number
          created_at?: string
          created_by?: string | null
          cycle_id?: string | null
          cycle_run_id?: string | null
          dispatched_at?: string | null
          environment_id?: string | null
          error?: Json | null
          finished_at?: string | null
          id?: string
          logs_url?: string | null
          max_attempts?: number
          payload?: Json
          priority?: number
          progress?: number
          project_id?: string
          queued_at?: string
          release_id?: string | null
          result?: Json | null
          runner_id?: string | null
          started_at?: string | null
          status?: string
          suite_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runner_jobs_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "test_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runner_jobs_cycle_run_id_fkey"
            columns: ["cycle_run_id"]
            isOneToOne: false
            referencedRelation: "cycle_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runner_jobs_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runner_jobs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runner_jobs_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runner_jobs_runner_id_fkey"
            columns: ["runner_id"]
            isOneToOne: false
            referencedRelation: "runners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runner_jobs_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "test_suites"
            referencedColumns: ["id"]
          },
        ]
      }
      runners: {
        Row: {
          capabilities: Json
          config: Json
          created_at: string
          created_by: string | null
          current_job_id: string | null
          environment_id: string | null
          id: string
          kind: string
          last_seen_at: string | null
          name: string
          project_id: string
          runner_group_id: string | null
          status: string
          token_hash: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          capabilities?: Json
          config?: Json
          created_at?: string
          created_by?: string | null
          current_job_id?: string | null
          environment_id?: string | null
          id?: string
          kind?: string
          last_seen_at?: string | null
          name: string
          project_id: string
          runner_group_id?: string | null
          status?: string
          token_hash?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          capabilities?: Json
          config?: Json
          created_at?: string
          created_by?: string | null
          current_job_id?: string | null
          environment_id?: string | null
          id?: string
          kind?: string
          last_seen_at?: string | null
          name?: string
          project_id?: string
          runner_group_id?: string | null
          status?: string
          token_hash?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runners_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runners_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runners_runner_group_id_fkey"
            columns: ["runner_group_id"]
            isOneToOne: false
            referencedRelation: "runner_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          created_at: string
          created_by: string | null
          cron: string
          enabled: boolean
          id: string
          last_run_at: string | null
          name: string
          next_run_at: string | null
          payload: Json
          project_id: string
          target_id: string | null
          target_kind: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cron: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          payload?: Json
          project_id: string
          target_id?: string | null
          target_kind: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cron?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          payload?: Json
          project_id?: string
          target_id?: string | null
          target_kind?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      share_link_views: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          reason: string | null
          resource_id: string | null
          resource_type: string | null
          share_link_id: string | null
          token: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          granted?: boolean
          id?: string
          reason?: string | null
          resource_id?: string | null
          resource_type?: string | null
          share_link_id?: string | null
          token: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          reason?: string | null
          resource_id?: string | null
          resource_type?: string | null
          share_link_id?: string | null
          token?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "share_link_views_share_link_id_fkey"
            columns: ["share_link_id"]
            isOneToOne: false
            referencedRelation: "share_links"
            referencedColumns: ["id"]
          },
        ]
      }
      share_links: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          last_viewed_at: string | null
          org_id: string | null
          resource_id: string
          resource_type: string
          revoked_at: string | null
          token: string
          updated_at: string
          view_count: number
          watermark_label: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          org_id?: string | null
          resource_id: string
          resource_type: string
          revoked_at?: string | null
          token: string
          updated_at?: string
          view_count?: number
          watermark_label?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          org_id?: string | null
          resource_id?: string
          resource_type?: string
          revoked_at?: string | null
          token?: string
          updated_at?: string
          view_count?: number
          watermark_label?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      spec_runs: {
        Row: {
          artifacts_json: Json | null
          browser: string | null
          created_at: string
          created_by: string | null
          finished_at: string | null
          headless: boolean | null
          id: string
          project_id: string
          result_json: Json | null
          retries: number | null
          runner_job_id: string | null
          spec_id: string
          started_at: string | null
          status: string
          stderr: string | null
          stdout: string | null
          suite_run_id: string | null
          test_plan_id: string
          updated_at: string
        }
        Insert: {
          artifacts_json?: Json | null
          browser?: string | null
          created_at?: string
          created_by?: string | null
          finished_at?: string | null
          headless?: boolean | null
          id?: string
          project_id: string
          result_json?: Json | null
          retries?: number | null
          runner_job_id?: string | null
          spec_id: string
          started_at?: string | null
          status?: string
          stderr?: string | null
          stdout?: string | null
          suite_run_id?: string | null
          test_plan_id: string
          updated_at?: string
        }
        Update: {
          artifacts_json?: Json | null
          browser?: string | null
          created_at?: string
          created_by?: string | null
          finished_at?: string | null
          headless?: boolean | null
          id?: string
          project_id?: string
          result_json?: Json | null
          retries?: number | null
          runner_job_id?: string | null
          spec_id?: string
          started_at?: string | null
          status?: string
          stderr?: string | null
          stdout?: string | null
          suite_run_id?: string | null
          test_plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "spec_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spec_runs_runner_job_id_fkey"
            columns: ["runner_job_id"]
            isOneToOne: false
            referencedRelation: "runner_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spec_runs_spec_id_fkey"
            columns: ["spec_id"]
            isOneToOne: false
            referencedRelation: "test_plan_specs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spec_runs_suite_run_id_fkey"
            columns: ["suite_run_id"]
            isOneToOne: false
            referencedRelation: "suite_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spec_runs_test_plan_id_fkey"
            columns: ["test_plan_id"]
            isOneToOne: false
            referencedRelation: "test_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      sso_connections: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          display_name: string | null
          domains: string[]
          enabled: boolean
          id: string
          org_id: string
          provider: string
          supabase_provider_id: string | null
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          domains?: string[]
          enabled?: boolean
          id?: string
          org_id: string
          provider: string
          supabase_provider_id?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          domains?: string[]
          enabled?: boolean
          id?: string
          org_id?: string
          provider?: string
          supabase_provider_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sso_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string
          current_period_start: string
          environment: string
          id: string
          org_id: string
          paddle_customer_id: string | null
          paddle_price_id: string | null
          paddle_subscription_id: string | null
          plan_key: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          environment?: string
          id?: string
          org_id: string
          paddle_customer_id?: string | null
          paddle_price_id?: string | null
          paddle_subscription_id?: string | null
          plan_key: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          environment?: string
          id?: string
          org_id?: string
          paddle_customer_id?: string | null
          paddle_price_id?: string | null
          paddle_subscription_id?: string | null
          plan_key?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["key"]
          },
        ]
      }
      suite_grouping_versions: {
        Row: {
          assignments: Json
          created_at: string
          created_by: string | null
          id: string
          is_current: boolean
          note: string | null
          project_id: string
          rules: Json
          updated_at: string
          version: number
          workspace_id: string | null
        }
        Insert: {
          assignments?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          note?: string | null
          project_id: string
          rules?: Json
          updated_at?: string
          version?: number
          workspace_id?: string | null
        }
        Update: {
          assignments?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_current?: boolean
          note?: string | null
          project_id?: string
          rules?: Json
          updated_at?: string
          version?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suite_grouping_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      suite_runs: {
        Row: {
          browser: string
          completed_specs: number
          config_json: Json
          created_at: string
          created_by: string | null
          failed_specs: number
          finished_at: string | null
          headless: boolean
          id: string
          passed_specs: number
          project_id: string
          retries: number
          status: string
          test_plan_id: string
          total_specs: number
          updated_at: string
        }
        Insert: {
          browser?: string
          completed_specs?: number
          config_json?: Json
          created_at?: string
          created_by?: string | null
          failed_specs?: number
          finished_at?: string | null
          headless?: boolean
          id?: string
          passed_specs?: number
          project_id: string
          retries?: number
          status?: string
          test_plan_id: string
          total_specs?: number
          updated_at?: string
        }
        Update: {
          browser?: string
          completed_specs?: number
          config_json?: Json
          created_at?: string
          created_by?: string | null
          failed_specs?: number
          finished_at?: string | null
          headless?: boolean
          id?: string
          passed_specs?: number
          project_id?: string
          retries?: number
          status?: string
          test_plan_id?: string
          total_specs?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suite_runs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suite_runs_test_plan_id_fkey"
            columns: ["test_plan_id"]
            isOneToOne: false
            referencedRelation: "test_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      suite_test_cases: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          position: number | null
          suite_id: string
          test_case_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          position?: number | null
          suite_id: string
          test_case_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          position?: number | null
          suite_id?: string
          test_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suite_test_cases_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "test_suites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suite_test_cases_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          connection_id: string | null
          created_at: string
          details: Json
          direction: string
          error: string | null
          finished_at: string | null
          id: string
          records_processed: number
          started_at: string
          status: string
          workspace_id: string | null
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          details?: Json
          direction?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          records_processed?: number
          started_at?: string
          status: string
          workspace_id?: string | null
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          details?: Json
          direction?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          records_processed?: number
          started_at?: string
          status?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          manager_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          manager_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_teams_manager"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      test_case_links: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          link_type: string
          metadata: Json
          target_id: string
          target_kind: string
          test_case_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          link_type: string
          metadata?: Json
          target_id: string
          target_kind: string
          test_case_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          link_type?: string
          metadata?: Json
          target_id?: string
          target_kind?: string
          test_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_case_links_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      test_case_steps: {
        Row: {
          action: string
          created_at: string
          expected_result: string | null
          id: string
          step_number: number
          test_case_id: string
        }
        Insert: {
          action: string
          created_at?: string
          expected_result?: string | null
          id?: string
          step_number: number
          test_case_id: string
        }
        Update: {
          action?: string
          created_at?: string
          expected_result?: string | null
          id?: string
          step_number?: number
          test_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_case_steps_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      test_case_versions: {
        Row: {
          changes_summary: string | null
          created_at: string
          description: string | null
          id: string
          modified_by: string | null
          test_case_id: string
          title: string
          version: number
        }
        Insert: {
          changes_summary?: string | null
          created_at?: string
          description?: string | null
          id?: string
          modified_by?: string | null
          test_case_id: string
          title: string
          version: number
        }
        Update: {
          changes_summary?: string | null
          created_at?: string
          description?: string | null
          id?: string
          modified_by?: string | null
          test_case_id?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "test_case_versions_modified_by_fkey"
            columns: ["modified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_case_versions_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      test_cases: {
        Row: {
          ai_confidence: number | null
          ai_generated: boolean
          automation_path: string | null
          automation_status: Database["public"]["Enums"]["automation_status"]
          coverage_tags: string[] | null
          created_at: string
          created_by: string | null
          description: string | null
          estimated_duration_min: number | null
          expected_result: string | null
          id: string
          owner_id: string | null
          preconditions: string | null
          priority: number
          priority_score: number | null
          project_id: string | null
          proposed_suite_name: string | null
          requirement_ids: string[] | null
          review_note: string | null
          review_state: string
          review_status: Database["public"]["Enums"]["review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_id: string | null
          source: string | null
          status: Database["public"]["Enums"]["test_case_status"]
          suite_assignment_status: string
          suite_id: string | null
          suite_order: number
          test_type: string | null
          title: string
          updated_at: string
          version: number
          workspace_id: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_generated?: boolean
          automation_path?: string | null
          automation_status?: Database["public"]["Enums"]["automation_status"]
          coverage_tags?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_duration_min?: number | null
          expected_result?: string | null
          id?: string
          owner_id?: string | null
          preconditions?: string | null
          priority?: number
          priority_score?: number | null
          project_id?: string | null
          proposed_suite_name?: string | null
          requirement_ids?: string[] | null
          review_note?: string | null
          review_state?: string
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_id?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["test_case_status"]
          suite_assignment_status?: string
          suite_id?: string | null
          suite_order?: number
          test_type?: string | null
          title: string
          updated_at?: string
          version?: number
          workspace_id?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_generated?: boolean
          automation_path?: string | null
          automation_status?: Database["public"]["Enums"]["automation_status"]
          coverage_tags?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_duration_min?: number | null
          expected_result?: string | null
          id?: string
          owner_id?: string | null
          preconditions?: string | null
          priority?: number
          priority_score?: number | null
          project_id?: string | null
          proposed_suite_name?: string | null
          requirement_ids?: string[] | null
          review_note?: string | null
          review_state?: string
          review_status?: Database["public"]["Enums"]["review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_id?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["test_case_status"]
          suite_assignment_status?: string
          suite_id?: string | null
          suite_order?: number
          test_type?: string | null
          title?: string
          updated_at?: string
          version?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_cases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_cases_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "test_suites"
            referencedColumns: ["id"]
          },
        ]
      }
      test_cycles: {
        Row: {
          build_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_at: string | null
          environment_id: string | null
          id: string
          metadata: Json
          name: string
          owner_id: string | null
          project_id: string
          release_id: string | null
          start_at: string | null
          status: Database["public"]["Enums"]["cycle_status"]
          suite_id: string | null
          test_plan_id: string | null
          updated_at: string
        }
        Insert: {
          build_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          environment_id?: string | null
          id?: string
          metadata?: Json
          name: string
          owner_id?: string | null
          project_id: string
          release_id?: string | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["cycle_status"]
          suite_id?: string | null
          test_plan_id?: string | null
          updated_at?: string
        }
        Update: {
          build_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          environment_id?: string | null
          id?: string
          metadata?: Json
          name?: string
          owner_id?: string | null
          project_id?: string
          release_id?: string | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["cycle_status"]
          suite_id?: string | null
          test_plan_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_cycles_build_id_fkey"
            columns: ["build_id"]
            isOneToOne: false
            referencedRelation: "builds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_cycles_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "environments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_cycles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_cycles_release_id_fkey"
            columns: ["release_id"]
            isOneToOne: false
            referencedRelation: "releases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_cycles_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "test_suites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_cycles_test_plan_id_fkey"
            columns: ["test_plan_id"]
            isOneToOne: false
            referencedRelation: "test_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      test_data_sets: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          project_id: string
          rows: Json
          test_case_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          project_id: string
          rows?: Json
          test_case_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          project_id?: string
          rows?: Json
          test_case_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_data_sets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_data_sets_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      test_executions: {
        Row: {
          completed_at: string | null
          created_at: string
          environment: string | null
          executor_id: string | null
          id: string
          notes: string | null
          project_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["execution_status"]
          suite_id: string | null
          test_case_id: string
          test_plan_id: string | null
          test_run_id: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          environment?: string | null
          executor_id?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["execution_status"]
          suite_id?: string | null
          test_case_id: string
          test_plan_id?: string | null
          test_run_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          environment?: string | null
          executor_id?: string | null
          id?: string
          notes?: string | null
          project_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["execution_status"]
          suite_id?: string | null
          test_case_id?: string
          test_plan_id?: string | null
          test_run_id?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_executions_executor_id_fkey"
            columns: ["executor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_executions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_executions_suite_id_fkey"
            columns: ["suite_id"]
            isOneToOne: false
            referencedRelation: "test_suites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_executions_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_executions_test_plan_id_fkey"
            columns: ["test_plan_id"]
            isOneToOne: false
            referencedRelation: "test_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_executions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      test_parameters: {
        Row: {
          created_at: string
          data_type: string
          default_value: string | null
          description: string | null
          id: string
          name: string
          required: boolean
          test_case_id: string
        }
        Insert: {
          created_at?: string
          data_type?: string
          default_value?: string | null
          description?: string | null
          id?: string
          name: string
          required?: boolean
          test_case_id: string
        }
        Update: {
          created_at?: string
          data_type?: string
          default_value?: string | null
          description?: string | null
          id?: string
          name?: string
          required?: boolean
          test_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_parameters_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      test_plan_assignees: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["plan_role"]
          test_plan_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["plan_role"]
          test_plan_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["plan_role"]
          test_plan_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_plan_assignees_test_plan_id_fkey"
            columns: ["test_plan_id"]
            isOneToOne: false
            referencedRelation: "test_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      test_plan_document_versions: {
        Row: {
          change_note: string | null
          content: string | null
          created_at: string
          created_by: string | null
          document_id: string
          id: string
          kind: string | null
          project_id: string | null
          slug: string | null
          test_plan_id: string
          title: string | null
          version: number
        }
        Insert: {
          change_note?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          document_id: string
          id?: string
          kind?: string | null
          project_id?: string | null
          slug?: string | null
          test_plan_id: string
          title?: string | null
          version?: number
        }
        Update: {
          change_note?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string
          id?: string
          kind?: string | null
          project_id?: string | null
          slug?: string | null
          test_plan_id?: string
          title?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "test_plan_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "test_plan_documents_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      test_plan_documents: {
        Row: {
          created_at: string
          document_id: string
          id: string
          test_plan_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          test_plan_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          test_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_plan_documents_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_plan_documents_test_plan_id_fkey"
            columns: ["test_plan_id"]
            isOneToOne: false
            referencedRelation: "test_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      test_plan_documents_v2: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          project_id: string
          review_note: string | null
          review_state: string
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string
          sort_order: number
          test_plan_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          project_id: string
          review_note?: string | null
          review_state?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug: string
          sort_order?: number
          test_plan_id: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          project_id?: string
          review_note?: string | null
          review_state?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string
          sort_order?: number
          test_plan_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_plan_documents_v2_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_plan_documents_v2_test_plan_id_fkey"
            columns: ["test_plan_id"]
            isOneToOne: false
            referencedRelation: "test_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      test_plan_specs: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          document_id: string | null
          filename: string
          id: string
          language: string
          project_id: string
          review_note: string | null
          review_state: string
          reviewed_at: string | null
          reviewed_by: string | null
          test_case_id: string | null
          test_plan_id: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          filename: string
          id?: string
          language?: string
          project_id: string
          review_note?: string | null
          review_state?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          test_case_id?: string | null
          test_plan_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          filename?: string
          id?: string
          language?: string
          project_id?: string
          review_note?: string | null
          review_state?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          test_case_id?: string | null
          test_plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_plan_specs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "test_plan_documents_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_plan_specs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_plan_specs_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_plan_specs_test_plan_id_fkey"
            columns: ["test_plan_id"]
            isOneToOne: false
            referencedRelation: "test_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      test_plan_test_cases: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          test_case_id: string
          test_plan_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          test_case_id: string
          test_plan_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          test_case_id?: string
          test_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_plan_test_cases_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_plan_test_cases_test_plan_id_fkey"
            columns: ["test_plan_id"]
            isOneToOne: false
            referencedRelation: "test_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      test_plan_versions: {
        Row: {
          change_summary: string | null
          created_at: string
          created_by: string | null
          id: string
          snapshot: Json
          test_plan_id: string
          version: number
        }
        Insert: {
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          snapshot?: Json
          test_plan_id: string
          version: number
        }
        Update: {
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          snapshot?: Json
          test_plan_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "test_plan_versions_test_plan_id_fkey"
            columns: ["test_plan_id"]
            isOneToOne: false
            referencedRelation: "test_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      test_plans: {
        Row: {
          ai_dry_run: boolean | null
          ai_job_ref: string | null
          ai_last_run_at: string | null
          ai_progress: number | null
          ai_progress_message: string | null
          ai_progress_updated_at: string | null
          ai_settings: Json
          ai_status: string | null
          ai_suggested: boolean | null
          codegen_dry_run: boolean | null
          codegen_job_ref: string | null
          codegen_last_run_at: string | null
          codegen_progress: number | null
          codegen_progress_message: string | null
          codegen_progress_updated_at: string | null
          codegen_skip_stubs: boolean
          codegen_status: string | null
          created_at: string
          created_by: string | null
          current_version: number
          description: string | null
          id: string
          name: string
          objective: string | null
          plan_documents: Json
          plan_uid: string | null
          progress: number | null
          project_id: string | null
          runs_count: number | null
          scope: string | null
          status: string
          updated_at: string
          variables: Json
          workspace_id: string | null
        }
        Insert: {
          ai_dry_run?: boolean | null
          ai_job_ref?: string | null
          ai_last_run_at?: string | null
          ai_progress?: number | null
          ai_progress_message?: string | null
          ai_progress_updated_at?: string | null
          ai_settings?: Json
          ai_status?: string | null
          ai_suggested?: boolean | null
          codegen_dry_run?: boolean | null
          codegen_job_ref?: string | null
          codegen_last_run_at?: string | null
          codegen_progress?: number | null
          codegen_progress_message?: string | null
          codegen_progress_updated_at?: string | null
          codegen_skip_stubs?: boolean
          codegen_status?: string | null
          created_at?: string
          created_by?: string | null
          current_version?: number
          description?: string | null
          id?: string
          name: string
          objective?: string | null
          plan_documents?: Json
          plan_uid?: string | null
          progress?: number | null
          project_id?: string | null
          runs_count?: number | null
          scope?: string | null
          status?: string
          updated_at?: string
          variables?: Json
          workspace_id?: string | null
        }
        Update: {
          ai_dry_run?: boolean | null
          ai_job_ref?: string | null
          ai_last_run_at?: string | null
          ai_progress?: number | null
          ai_progress_message?: string | null
          ai_progress_updated_at?: string | null
          ai_settings?: Json
          ai_status?: string | null
          ai_suggested?: boolean | null
          codegen_dry_run?: boolean | null
          codegen_job_ref?: string | null
          codegen_last_run_at?: string | null
          codegen_progress?: number | null
          codegen_progress_message?: string | null
          codegen_progress_updated_at?: string | null
          codegen_skip_stubs?: boolean
          codegen_status?: string | null
          created_at?: string
          created_by?: string | null
          current_version?: number
          description?: string | null
          id?: string
          name?: string
          objective?: string | null
          plan_documents?: Json
          plan_uid?: string | null
          progress?: number | null
          project_id?: string | null
          runs_count?: number | null
          scope?: string | null
          status?: string
          updated_at?: string
          variables?: Json
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      test_suites: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          parent_id: string | null
          project_id: string
          review_note: string | null
          review_state: string
          reviewed_at: string | null
          reviewed_by: string | null
          sort_order: number
          tags: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          project_id: string
          review_note?: string | null
          review_state?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sort_order?: number
          tags?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          project_id?: string
          review_note?: string | null
          review_state?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sort_order?: number
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_suites_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "test_suites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_suites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          occurred_at: string
          org_id: string
          quantity: number
          ref: Json
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          occurred_at?: string
          org_id: string
          quantity?: number
          ref?: Json
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          occurred_at?: string
          org_id?: string
          quantity?: number
          ref?: Json
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      waivers: {
        Row: {
          created_at: string
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          id: string
          metadata: Json
          project_id: string
          reason: string
          revoked_at: string | null
          subject_id: string
          subject_kind: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          metadata?: Json
          project_id: string
          reason: string
          revoked_at?: string | null
          subject_id: string
          subject_kind: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          id?: string
          metadata?: Json
          project_id?: string
          reason?: string
          revoked_at?: string | null
          subject_id?: string
          subject_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "waivers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          endpoint_id: string
          event_type: string
          id: string
          last_attempt_at: string | null
          next_retry_at: string | null
          payload: Json
          response_body: string | null
          response_code: number | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          endpoint_id: string
          event_type: string
          id?: string
          last_attempt_at?: string | null
          next_retry_at?: string | null
          payload?: Json
          response_body?: string | null
          response_code?: number | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          endpoint_id?: string
          event_type?: string
          id?: string
          last_attempt_at?: string | null
          next_retry_at?: string | null
          payload?: Json
          response_body?: string | null
          response_code?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          event_types: string[]
          id: string
          name: string
          org_id: string
          secret: string
          updated_at: string
          url: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          event_types?: string[]
          id?: string
          name?: string
          org_id: string
          secret: string
          updated_at?: string
          url: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          event_types?: string[]
          id?: string
          name?: string
          org_id?: string
          secret?: string
          updated_at?: string
          url?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_endpoints_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          connection_id: string | null
          created_at: string
          error: string | null
          event_type: string
          headers: Json
          id: string
          payload: Json
          processed_at: string | null
          project_id: string | null
          signature: string | null
          source: string
          status: string
          workspace_id: string | null
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          error?: string | null
          event_type: string
          headers?: Json
          id?: string
          payload?: Json
          processed_at?: string | null
          project_id?: string | null
          signature?: string | null
          source: string
          status?: string
          workspace_id?: string | null
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          error?: string | null
          event_type?: string
          headers?: Json
          id?: string
          payload?: Json
          processed_at?: string | null
          project_id?: string | null
          signature?: string | null
          source?: string
          status?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["workspace_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["workspace_role"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          description: string | null
          id: string
          members_count: number | null
          name: string
          organization_id: string | null
          owner_id: string | null
          projects_count: number | null
          slack_webhook_url: string | null
          status: string
          storage_quota: number | null
          storage_used: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          members_count?: number | null
          name: string
          organization_id?: string | null
          owner_id?: string | null
          projects_count?: number | null
          slack_webhook_url?: string | null
          status?: string
          storage_quota?: number | null
          storage_used?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          members_count?: number | null
          name?: string
          organization_id?: string | null
          owner_id?: string | null
          projects_count?: number | null
          slack_webhook_url?: string | null
          status?: string
          storage_quota?: number | null
          storage_used?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspaces_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_project: { Args: { _project_id: string }; Returns: boolean }
      can_manage_plan_assignees: {
        Args: { _plan_id: string }
        Returns: boolean
      }
      can_signoff_plan: { Args: { _plan_id: string }; Returns: boolean }
      can_use_feature: {
        Args: { _feature: string; _org_id: string }
        Returns: boolean
      }
      claim_jobs: {
        Args: { _limit?: number; _visibility_sec?: number; _worker: string }
        Returns: {
          attempt_count: number
          checkpoint: Json | null
          created_at: string
          created_by: string | null
          error: Json | null
          id: string
          idempotency_key: string | null
          kind: string
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          priority: number
          progress: number
          progress_message: string | null
          project_id: string | null
          result: Json | null
          run_after: string
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          workspace_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_runner_jobs: {
        Args: { _limit?: number; _runner: string }
        Returns: {
          attempt: number
          created_at: string
          created_by: string | null
          cycle_id: string | null
          cycle_run_id: string | null
          dispatched_at: string | null
          environment_id: string | null
          error: Json | null
          finished_at: string | null
          id: string
          logs_url: string | null
          max_attempts: number
          payload: Json
          priority: number
          progress: number
          project_id: string
          queued_at: string
          release_id: string | null
          result: Json | null
          runner_id: string | null
          started_at: string | null
          status: string
          suite_id: string | null
          updated_at: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "runner_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      current_user_org_ids: { Args: never; Returns: string[] }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      emit_webhook: {
        Args: {
          _event: string
          _org_id: string
          _payload: Json
          _workspace_id: string
        }
        Returns: undefined
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      gen_test_plan_uid: { Args: never; Returns: string }
      is_org_member: { Args: { _org_id: string }; Returns: boolean }
      is_project_member: { Args: { _project_id: string }; Returns: boolean }
      is_workspace_member: {
        Args: { _user: string; _workspace: string }
        Returns: boolean
      }
      log_audit: {
        Args: {
          _action: string
          _entity_id?: string
          _entity_kind?: string
          _meta?: Json
          _org_id: string
          _workspace_id: string
        }
        Returns: string
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      notify_workspace_managers: {
        Args: {
          _data: Json
          _exclude?: string
          _message: string
          _title: string
          _type: string
          _workspace: string
        }
        Returns: undefined
      }
      org_entitlements: { Args: { _org_id: string }; Returns: Json }
      org_for_sso_domain: { Args: { _domain: string }; Returns: string }
      org_of_workspace: { Args: { _ws: string }; Returns: string }
      org_role_of: {
        Args: { _org_id: string }
        Returns: Database["public"]["Enums"]["org_role"]
      }
      org_usage_this_period: {
        Args: { _kind: string; _org_id: string }
        Returns: number
      }
      project_role_of: {
        Args: { _project_id: string }
        Returns: Database["public"]["Enums"]["project_role"]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      resolve_share_link:
        | { Args: { _token: string }; Returns: Json }
        | { Args: { _token: string; _user_agent?: string }; Returns: Json }
      within_quota: {
        Args: { _additional?: number; _kind: string; _org_id: string }
        Returns: boolean
      }
      workspace_of_project: { Args: { _project: string }; Returns: string }
      workspace_role_of: {
        Args: { _user: string; _workspace: string }
        Returns: Database["public"]["Enums"]["workspace_role"]
      }
    }
    Enums: {
      agent_status: "idle" | "learning" | "executing" | "paused" | "error"
      automation_status: "manual" | "planned" | "automated" | "obsolete"
      build_status: "pending" | "building" | "success" | "failed" | "cancelled"
      cycle_status:
        | "planned"
        | "in_progress"
        | "paused"
        | "completed"
        | "cancelled"
      defect_priority: "urgent" | "high" | "medium" | "low"
      defect_severity: "critical" | "major" | "minor" | "trivial"
      deployment_status:
        | "pending"
        | "deploying"
        | "deployed"
        | "failed"
        | "rolled_back"
      environment_type:
        | "local"
        | "dev"
        | "qa"
        | "uat"
        | "staging"
        | "production"
        | "sandbox"
        | "other"
      execution_status:
        | "pending"
        | "in_progress"
        | "passed"
        | "failed"
        | "blocked"
        | "skipped"
      invitation_status: "pending" | "accepted" | "expired" | "revoked"
      job_status:
        | "queued"
        | "running"
        | "waiting"
        | "retrying"
        | "completed"
        | "failed"
        | "cancelled"
        | "dead_letter"
      org_role: "owner" | "billing_admin" | "security_admin" | "member"
      plan_role: "owner" | "assignee" | "reviewer" | "viewer"
      project_role: "lead" | "contributor" | "viewer"
      project_source: "documentation" | "zip" | "github"
      project_status: "pending" | "processing" | "ready" | "failed" | "archived"
      project_visibility: "inherited" | "restricted"
      release_status:
        | "planned"
        | "in_progress"
        | "released"
        | "blocked"
        | "cancelled"
      requirement_status: "proposed" | "approved" | "obsolete"
      review_status: "draft" | "in_review" | "approved" | "rejected"
      run_item_status:
        | "not_run"
        | "in_progress"
        | "passed"
        | "failed"
        | "blocked"
        | "skipped"
        | "not_applicable"
      run_status:
        | "planned"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "queued"
        | "failed"
      subscription_status: "trialing" | "active" | "past_due" | "canceled"
      test_case_status: "draft" | "active" | "deprecated" | "archived"
      user_role: "admin" | "qa_manager" | "qa_engineer" | "viewer"
      user_status: "active" | "pending" | "inactive" | "suspended"
      workspace_role: "owner" | "admin" | "editor" | "viewer" | "guest"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agent_status: ["idle", "learning", "executing", "paused", "error"],
      automation_status: ["manual", "planned", "automated", "obsolete"],
      build_status: ["pending", "building", "success", "failed", "cancelled"],
      cycle_status: [
        "planned",
        "in_progress",
        "paused",
        "completed",
        "cancelled",
      ],
      defect_priority: ["urgent", "high", "medium", "low"],
      defect_severity: ["critical", "major", "minor", "trivial"],
      deployment_status: [
        "pending",
        "deploying",
        "deployed",
        "failed",
        "rolled_back",
      ],
      environment_type: [
        "local",
        "dev",
        "qa",
        "uat",
        "staging",
        "production",
        "sandbox",
        "other",
      ],
      execution_status: [
        "pending",
        "in_progress",
        "passed",
        "failed",
        "blocked",
        "skipped",
      ],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      job_status: [
        "queued",
        "running",
        "waiting",
        "retrying",
        "completed",
        "failed",
        "cancelled",
        "dead_letter",
      ],
      org_role: ["owner", "billing_admin", "security_admin", "member"],
      plan_role: ["owner", "assignee", "reviewer", "viewer"],
      project_role: ["lead", "contributor", "viewer"],
      project_source: ["documentation", "zip", "github"],
      project_status: ["pending", "processing", "ready", "failed", "archived"],
      project_visibility: ["inherited", "restricted"],
      release_status: [
        "planned",
        "in_progress",
        "released",
        "blocked",
        "cancelled",
      ],
      requirement_status: ["proposed", "approved", "obsolete"],
      review_status: ["draft", "in_review", "approved", "rejected"],
      run_item_status: [
        "not_run",
        "in_progress",
        "passed",
        "failed",
        "blocked",
        "skipped",
        "not_applicable",
      ],
      run_status: [
        "planned",
        "in_progress",
        "completed",
        "cancelled",
        "queued",
        "failed",
      ],
      subscription_status: ["trialing", "active", "past_due", "canceled"],
      test_case_status: ["draft", "active", "deprecated", "archived"],
      user_role: ["admin", "qa_manager", "qa_engineer", "viewer"],
      user_status: ["active", "pending", "inactive", "suspended"],
      workspace_role: ["owner", "admin", "editor", "viewer", "guest"],
    },
  },
} as const
