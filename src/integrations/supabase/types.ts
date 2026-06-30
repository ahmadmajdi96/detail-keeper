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
          id: string
          metadata: Json
          name: string | null
          project_id: string
          release_id: string | null
          status: Database["public"]["Enums"]["build_status"]
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
          id?: string
          metadata?: Json
          name?: string | null
          project_id: string
          release_id?: string | null
          status?: Database["public"]["Enums"]["build_status"]
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
          id?: string
          metadata?: Json
          name?: string | null
          project_id?: string
          release_id?: string | null
          status?: Database["public"]["Enums"]["build_status"]
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
      defects: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          execution_id: string | null
          id: string
          priority: Database["public"]["Enums"]["defect_priority"]
          project_id: string | null
          reported_by: string | null
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
          created_at?: string
          description?: string | null
          execution_id?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["defect_priority"]
          project_id?: string | null
          reported_by?: string | null
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
          created_at?: string
          description?: string | null
          execution_id?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["defect_priority"]
          project_id?: string | null
          reported_by?: string | null
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
          defect_id: string | null
          description: string | null
          execution_id: string | null
          file_name: string
          file_type: string
          file_url: string
          id: string
          project_id: string | null
          step_result_id: string | null
          workspace_id: string | null
        }
        Insert: {
          captured_at?: string
          defect_id?: string | null
          description?: string | null
          execution_id?: string | null
          file_name: string
          file_type: string
          file_url: string
          id?: string
          project_id?: string | null
          step_result_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          captured_at?: string
          defect_id?: string | null
          description?: string | null
          execution_id?: string | null
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          project_id?: string | null
          step_result_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
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
      profiles: {
        Row: {
          avatar: string | null
          created_at: string
          email: string
          id: string
          last_login: string | null
          name: string
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          team_id: string | null
          updated_at: string
        }
        Insert: {
          avatar?: string | null
          created_at?: string
          email: string
          id: string
          last_login?: string | null
          name: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar?: string | null
          created_at?: string
          email?: string
          id?: string
          last_login?: string | null
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          team_id?: string | null
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
      projects: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          endpoints_count: number | null
          files_count: number | null
          github_branch: string | null
          github_is_private: boolean | null
          github_token_secret_name: string | null
          github_url: string | null
          id: string
          last_processed_at: string | null
          name: string
          process_error: string | null
          source_type: Database["public"]["Enums"]["project_source"]
          status: Database["public"]["Enums"]["project_status"]
          test_cases_count: number | null
          updated_at: string
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
          github_token_secret_name?: string | null
          github_url?: string | null
          id?: string
          last_processed_at?: string | null
          name: string
          process_error?: string | null
          source_type?: Database["public"]["Enums"]["project_source"]
          status?: Database["public"]["Enums"]["project_status"]
          test_cases_count?: number | null
          updated_at?: string
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
          github_token_secret_name?: string | null
          github_url?: string | null
          id?: string
          last_processed_at?: string | null
          name?: string
          process_error?: string | null
          source_type?: Database["public"]["Enums"]["project_source"]
          status?: Database["public"]["Enums"]["project_status"]
          test_cases_count?: number | null
          updated_at?: string
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
          coverage_tags: string[] | null
          created_at: string
          created_by: string | null
          description: string | null
          expected_result: string | null
          id: string
          preconditions: string | null
          priority: number
          project_id: string | null
          requirement_ids: string[] | null
          status: Database["public"]["Enums"]["test_case_status"]
          title: string
          updated_at: string
          version: number
          workspace_id: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_generated?: boolean
          coverage_tags?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_result?: string | null
          id?: string
          preconditions?: string | null
          priority?: number
          project_id?: string | null
          requirement_ids?: string[] | null
          status?: Database["public"]["Enums"]["test_case_status"]
          title: string
          updated_at?: string
          version?: number
          workspace_id?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_generated?: boolean
          coverage_tags?: string[] | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_result?: string | null
          id?: string
          preconditions?: string | null
          priority?: number
          project_id?: string | null
          requirement_ids?: string[] | null
          status?: Database["public"]["Enums"]["test_case_status"]
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
      test_plan_assignees: {
        Row: {
          assigned_by: string | null
          created_at: string
          id: string
          role: string
          test_plan_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role?: string
          test_plan_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          id?: string
          role?: string
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
          ai_last_run_at: string | null
          ai_status: string | null
          ai_suggested: boolean | null
          created_at: string
          created_by: string | null
          current_version: number
          description: string | null
          id: string
          name: string
          objective: string | null
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
          ai_last_run_at?: string | null
          ai_status?: string | null
          ai_suggested?: boolean | null
          created_at?: string
          created_by?: string | null
          current_version?: number
          description?: string | null
          id?: string
          name: string
          objective?: string | null
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
          ai_last_run_at?: string | null
          ai_status?: string | null
          ai_suggested?: boolean | null
          created_at?: string
          created_by?: string | null
          current_version?: number
          description?: string | null
          id?: string
          name?: string
          objective?: string | null
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
          owner_id: string | null
          projects_count: number | null
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
          owner_id?: string | null
          projects_count?: number | null
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
          owner_id?: string | null
          projects_count?: number | null
          status?: string
          storage_quota?: number | null
          storage_used?: number | null
          updated_at?: string
        }
        Relationships: [
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
      is_workspace_member: {
        Args: { _user: string; _workspace: string }
        Returns: boolean
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
      workspace_of_project: { Args: { _project: string }; Returns: string }
      workspace_role_of: {
        Args: { _user: string; _workspace: string }
        Returns: Database["public"]["Enums"]["workspace_role"]
      }
    }
    Enums: {
      agent_status: "idle" | "learning" | "executing" | "paused" | "error"
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
      project_source: "documentation" | "zip" | "github"
      project_status: "pending" | "processing" | "ready" | "failed" | "archived"
      release_status:
        | "planned"
        | "in_progress"
        | "released"
        | "blocked"
        | "cancelled"
      run_item_status:
        | "not_run"
        | "in_progress"
        | "passed"
        | "failed"
        | "blocked"
        | "skipped"
        | "not_applicable"
      run_status: "planned" | "in_progress" | "completed" | "cancelled"
      test_case_status: "draft" | "active" | "deprecated" | "archived"
      user_role: "admin" | "qa_manager" | "qa_engineer" | "viewer"
      user_status: "active" | "pending" | "inactive" | "suspended"
      workspace_role: "owner" | "admin" | "editor" | "viewer"
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
      project_source: ["documentation", "zip", "github"],
      project_status: ["pending", "processing", "ready", "failed", "archived"],
      release_status: [
        "planned",
        "in_progress",
        "released",
        "blocked",
        "cancelled",
      ],
      run_item_status: [
        "not_run",
        "in_progress",
        "passed",
        "failed",
        "blocked",
        "skipped",
        "not_applicable",
      ],
      run_status: ["planned", "in_progress", "completed", "cancelled"],
      test_case_status: ["draft", "active", "deprecated", "archived"],
      user_role: ["admin", "qa_manager", "qa_engineer", "viewer"],
      user_status: ["active", "pending", "inactive", "suspended"],
      workspace_role: ["owner", "admin", "editor", "viewer"],
    },
  },
} as const
