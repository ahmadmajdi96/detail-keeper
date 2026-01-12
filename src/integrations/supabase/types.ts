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
      defects: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          execution_id: string | null
          id: string
          priority: Database["public"]["Enums"]["defect_priority"]
          reported_by: string | null
          severity: Database["public"]["Enums"]["defect_severity"]
          status: string
          step_result_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          execution_id?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["defect_priority"]
          reported_by?: string | null
          severity?: Database["public"]["Enums"]["defect_severity"]
          status?: string
          step_result_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          execution_id?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["defect_priority"]
          reported_by?: string | null
          severity?: Database["public"]["Enums"]["defect_severity"]
          status?: string
          step_result_id?: string | null
          title?: string
          updated_at?: string
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
          requirements_count?: number | null
          status?: string
          uploader_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
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
          step_result_id: string | null
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
          step_result_id?: string | null
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
          step_result_id?: string | null
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
            foreignKeyName: "evidence_step_result_id_fkey"
            columns: ["step_result_id"]
            isOneToOne: false
            referencedRelation: "execution_step_results"
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
          started_at: string | null
          status: Database["public"]["Enums"]["execution_status"]
          test_case_id: string
          test_run_id: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          environment?: string | null
          executor_id?: string | null
          id?: string
          notes?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["execution_status"]
          test_case_id: string
          test_run_id?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          environment?: string | null
          executor_id?: string | null
          id?: string
          notes?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["execution_status"]
          test_case_id?: string
          test_run_id?: string | null
          updated_at?: string
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
            foreignKeyName: "test_executions_test_case_id_fkey"
            columns: ["test_case_id"]
            isOneToOne: false
            referencedRelation: "test_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      test_plans: {
        Row: {
          ai_suggested: boolean | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          progress: number | null
          runs_count: number | null
          status: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          ai_suggested?: boolean | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          progress?: number | null
          runs_count?: number | null
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          ai_suggested?: boolean | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          progress?: number | null
          runs_count?: number | null
          status?: string
          updated_at?: string
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
            foreignKeyName: "test_plans_workspace_id_fkey"
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
      [_ in never]: never
    }
    Enums: {
      agent_status: "idle" | "learning" | "executing" | "paused" | "error"
      defect_priority: "urgent" | "high" | "medium" | "low"
      defect_severity: "critical" | "major" | "minor" | "trivial"
      execution_status:
        | "pending"
        | "in_progress"
        | "passed"
        | "failed"
        | "blocked"
        | "skipped"
      test_case_status: "draft" | "active" | "deprecated" | "archived"
      user_role: "admin" | "qa_manager" | "qa_engineer" | "viewer"
      user_status: "active" | "pending" | "inactive" | "suspended"
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
      defect_priority: ["urgent", "high", "medium", "low"],
      defect_severity: ["critical", "major", "minor", "trivial"],
      execution_status: [
        "pending",
        "in_progress",
        "passed",
        "failed",
        "blocked",
        "skipped",
      ],
      test_case_status: ["draft", "active", "deprecated", "archived"],
      user_role: ["admin", "qa_manager", "qa_engineer", "viewer"],
      user_status: ["active", "pending", "inactive", "suspended"],
    },
  },
} as const
