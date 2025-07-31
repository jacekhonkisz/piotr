export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      campaigns: {
        Row: {
          campaign_id: string
          campaign_name: string
          clicks: number
          client_id: string
          conversions: number
          cpc: number
          cpp: number | null
          created_at: string
          ctr: number
          date_range_end: string
          date_range_start: string
          demographics: Json | null
          frequency: number | null
          id: string
          impressions: number
          reach: number | null
          spend: number
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          campaign_name: string
          clicks?: number
          client_id: string
          conversions?: number
          cpc?: number
          cpp?: number | null
          created_at?: string
          ctr?: number
          date_range_end: string
          date_range_start: string
          demographics?: Json | null
          frequency?: number | null
          id?: string
          impressions?: number
          reach?: number | null
          spend?: number
          status: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          campaign_name?: string
          clicks?: number
          client_id?: string
          conversions?: number
          cpc?: number
          cpp?: number | null
          created_at?: string
          ctr?: number
          date_range_end?: string
          date_range_start?: string
          demographics?: Json | null
          frequency?: number | null
          id?: string
          impressions?: number
          reach?: number | null
          spend?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "token_health_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      client_notes: {
        Row: {
          admin_id: string
          client_id: string
          content: string
          created_at: string
          id: string
          note_type: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          admin_id: string
          client_id: string
          content: string
          created_at?: string
          id?: string
          note_type?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          admin_id?: string
          client_id?: string
          content?: string
          created_at?: string
          id?: string
          note_type?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_notes_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "token_health_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          ad_account_id: string
          admin_id: string
          api_status: Database["public"]["Enums"]["api_status"]
          company: string | null
          created_at: string
          credentials_generated_at: string | null
          email: string
          generated_password: string | null
          generated_username: string | null
          id: string
          last_report_date: string | null
          last_token_validation: string | null
          meta_access_token: string
          name: string
          notes: string | null
          reporting_frequency: Database["public"]["Enums"]["reporting_frequency"]
          token_expires_at: string | null
          token_health_status: string | null
          token_refresh_count: number | null
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          admin_id: string
          api_status?: Database["public"]["Enums"]["api_status"]
          company?: string | null
          created_at?: string
          credentials_generated_at?: string | null
          email: string
          generated_password?: string | null
          generated_username?: string | null
          id?: string
          last_report_date?: string | null
          last_token_validation?: string | null
          meta_access_token: string
          name: string
          notes?: string | null
          reporting_frequency?: Database["public"]["Enums"]["reporting_frequency"]
          token_expires_at?: string | null
          token_health_status?: string | null
          token_refresh_count?: number | null
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          admin_id?: string
          api_status?: Database["public"]["Enums"]["api_status"]
          company?: string | null
          created_at?: string
          credentials_generated_at?: string | null
          email?: string
          generated_password?: string | null
          generated_username?: string | null
          id?: string
          last_report_date?: string | null
          last_token_validation?: string | null
          meta_access_token?: string
          name?: string
          notes?: string | null
          reporting_frequency?: Database["public"]["Enums"]["reporting_frequency"]
          token_expires_at?: string | null
          token_health_status?: string | null
          token_refresh_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          created_at: string
          delivered_at: string | null
          error_message: string | null
          id: string
          provider_id: string | null
          recipient_email: string
          report_id: string
          sent_at: string
          status: Database["public"]["Enums"]["email_status"]
          subject: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          provider_id?: string | null
          recipient_email: string
          report_id: string
          sent_at?: string
          status?: Database["public"]["Enums"]["email_status"]
          subject: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          provider_id?: string | null
          recipient_email?: string
          report_id?: string
          sent_at?: string
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs_bulk: {
        Row: {
          admin_id: string
          completed_at: string | null
          created_at: string
          error_details: Json | null
          failed_sends: number
          id: string
          operation_type: string
          started_at: string
          status: string
          successful_sends: number
          total_recipients: number
        }
        Insert: {
          admin_id: string
          completed_at?: string | null
          created_at?: string
          error_details?: Json | null
          failed_sends?: number
          id?: string
          operation_type: string
          started_at?: string
          status?: string
          successful_sends?: number
          total_recipients?: number
        }
        Update: {
          admin_id?: string
          completed_at?: string | null
          created_at?: string
          error_details?: Json | null
          failed_sends?: number
          id?: string
          operation_type?: string
          started_at?: string
          status?: string
          successful_sends?: number
          total_recipients?: number
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_bulk_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          client_id: string
          created_at: string
          date_range_end: string
          date_range_start: string
          email_sent: boolean
          email_sent_at: string | null
          file_size_bytes: number | null
          file_url: string | null
          generated_at: string
          generation_time_ms: number | null
          id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          date_range_end: string
          date_range_start: string
          email_sent?: boolean
          email_sent_at?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          generated_at?: string
          generation_time_ms?: number | null
          id?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          date_range_end?: string
          date_range_start?: string
          email_sent?: boolean
          email_sent_at?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          generated_at?: string
          generation_time_ms?: number | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "token_health_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
    }
    Views: {
      token_health_overview: {
        Row: {
          api_status: Database["public"]["Enums"]["api_status"] | null
          email: string | null
          expiration_status: string | null
          id: string | null
          last_token_validation: string | null
          name: string | null
          token_expires_at: string | null
          token_health_status: string | null
          token_refresh_count: number | null
        }
        Insert: {
          api_status?: Database["public"]["Enums"]["api_status"] | null
          email?: string | null
          expiration_status?: never
          id?: string | null
          last_token_validation?: string | null
          name?: string | null
          token_expires_at?: string | null
          token_health_status?: string | null
          token_refresh_count?: number | null
        }
        Update: {
          api_status?: Database["public"]["Enums"]["api_status"] | null
          email?: string | null
          expiration_status?: never
          id?: string | null
          last_token_validation?: string | null
          name?: string | null
          token_expires_at?: string | null
          token_health_status?: string | null
          token_refresh_count?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      api_status: "valid" | "invalid" | "expired" | "pending"
      client_status: "active" | "inactive" | "suspended"
      email_status: "sent" | "delivered" | "failed" | "bounced"
      reporting_frequency: "monthly" | "weekly" | "on_demand"
      user_role: "admin" | "client"
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
      api_status: ["valid", "invalid", "expired", "pending"],
      client_status: ["active", "inactive", "suspended"],
      email_status: ["sent", "delivered", "failed", "bounced"],
      reporting_frequency: ["monthly", "weekly", "on_demand"],
      user_role: ["admin", "client"],
    },
  },
} as const
