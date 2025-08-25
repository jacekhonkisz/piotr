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
      campaign_summaries: {
        Row: {
          active_campaigns: number
          average_cpa: number
          average_cpc: number
          average_ctr: number
          campaign_data: Json | null
          client_id: string
          created_at: string
          data_source: string | null
          id: string
          last_updated: string | null
          meta_tables: Json | null
          summary_date: string
          summary_type: string
          total_campaigns: number
          total_clicks: number
          total_conversions: number
          total_impressions: number
          total_spend: number
        }
        Insert: {
          active_campaigns?: number
          average_cpa?: number
          average_cpc?: number
          average_ctr?: number
          campaign_data?: Json | null
          client_id: string
          created_at?: string
          data_source?: string | null
          id?: string
          last_updated?: string | null
          meta_tables?: Json | null
          summary_date: string
          summary_type: string
          total_campaigns?: number
          total_clicks?: number
          total_conversions?: number
          total_impressions?: number
          total_spend?: number
        }
        Update: {
          active_campaigns?: number
          average_cpa?: number
          average_cpc?: number
          average_ctr?: number
          campaign_data?: Json | null
          client_id?: string
          created_at?: string
          data_source?: string | null
          id?: string
          last_updated?: string | null
          meta_tables?: Json | null
          summary_date?: string
          summary_type?: string
          total_campaigns?: number
          total_clicks?: number
          total_conversions?: number
          total_impressions?: number
          total_spend?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_summaries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_summaries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "token_health_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          booking_step_1: number | null
          booking_step_2: number | null
          booking_step_3: number | null
          campaign_id: string
          campaign_name: string
          click_to_call: number | null
          clicks: number
          client_id: string
          conversions: number
          cost_per_reservation: number | null
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
          lead: number | null
          purchase: number | null
          purchase_value: number | null
          reach: number | null
          roas: number | null
          spend: number
          status: string
          updated_at: string
        }
        Insert: {
          booking_step_1?: number | null
          booking_step_2?: number | null
          booking_step_3?: number | null
          campaign_id: string
          campaign_name: string
          click_to_call?: number | null
          clicks?: number
          client_id: string
          conversions?: number
          cost_per_reservation?: number | null
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
          lead?: number | null
          purchase?: number | null
          purchase_value?: number | null
          reach?: number | null
          roas?: number | null
          spend?: number
          status: string
          updated_at?: string
        }
        Update: {
          booking_step_1?: number | null
          booking_step_2?: number | null
          booking_step_3?: number | null
          campaign_id?: string
          campaign_name?: string
          click_to_call?: number | null
          clicks?: number
          client_id?: string
          conversions?: number
          cost_per_reservation?: number | null
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
          lead?: number | null
          purchase?: number | null
          purchase_value?: number | null
          reach?: number | null
          roas?: number | null
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
          contact_emails: string[] | null
          created_at: string
          credentials_generated_at: string | null
          email: string
          email_send_count: number | null
          generated_password: string | null
          generated_username: string | null
          google_ads_access_token: string | null
          google_ads_customer_id: string | null
          google_ads_enabled: boolean | null
          google_ads_refresh_token: string | null
          google_ads_token_expires_at: string | null
          id: string
          last_report_date: string | null
          last_report_sent_at: string | null
          last_token_validation: string | null
          logo_url: string | null
          meta_access_token: string | null
          name: string
          next_report_scheduled_at: string | null
          notes: string | null
          reporting_frequency: Database["public"]["Enums"]["reporting_frequency"]
          send_day: number | null
          system_user_token: string | null
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
          contact_emails?: string[] | null
          created_at?: string
          credentials_generated_at?: string | null
          email: string
          email_send_count?: number | null
          generated_password?: string | null
          generated_username?: string | null
          google_ads_access_token?: string | null
          google_ads_customer_id?: string | null
          google_ads_enabled?: boolean | null
          google_ads_refresh_token?: string | null
          google_ads_token_expires_at?: string | null
          id?: string
          last_report_date?: string | null
          last_report_sent_at?: string | null
          last_token_validation?: string | null
          logo_url?: string | null
          meta_access_token?: string | null
          name: string
          next_report_scheduled_at?: string | null
          notes?: string | null
          reporting_frequency?: Database["public"]["Enums"]["reporting_frequency"]
          send_day?: number | null
          system_user_token?: string | null
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
          contact_emails?: string[] | null
          created_at?: string
          credentials_generated_at?: string | null
          email?: string
          email_send_count?: number | null
          generated_password?: string | null
          generated_username?: string | null
          google_ads_access_token?: string | null
          google_ads_customer_id?: string | null
          google_ads_enabled?: boolean | null
          google_ads_refresh_token?: string | null
          google_ads_token_expires_at?: string | null
          id?: string
          last_report_date?: string | null
          last_report_sent_at?: string | null
          last_token_validation?: string | null
          logo_url?: string | null
          meta_access_token?: string | null
          name?: string
          next_report_scheduled_at?: string | null
          notes?: string | null
          reporting_frequency?: Database["public"]["Enums"]["reporting_frequency"]
          send_day?: number | null
          system_user_token?: string | null
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
      current_month_cache: {
        Row: {
          cache_data: Json
          client_id: string
          created_at: string
          id: string
          last_updated: string
          period_id: string
        }
        Insert: {
          cache_data: Json
          client_id: string
          created_at?: string
          id?: string
          last_updated?: string
          period_id: string
        }
        Update: {
          cache_data?: Json
          client_id?: string
          created_at?: string
          id?: string
          last_updated?: string
          period_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "current_month_cache_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "current_month_cache_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "token_health_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      current_week_cache: {
        Row: {
          cache_data: Json
          client_id: string
          created_at: string
          id: string
          last_updated: string
          period_id: string
        }
        Insert: {
          cache_data: Json
          client_id: string
          created_at?: string
          id?: string
          last_updated?: string
          period_id: string
        }
        Update: {
          cache_data?: Json
          client_id?: string
          created_at?: string
          id?: string
          last_updated?: string
          period_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "current_week_cache_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "current_week_cache_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "token_health_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_kpi_data: {
        Row: {
          average_cpc: number
          average_ctr: number
          booking_step_1: number
          booking_step_2: number
          campaigns_count: number
          click_to_call: number
          client_id: string
          cost_per_reservation: number
          created_at: string
          data_source: string
          date: string
          email_contacts: number
          id: string
          last_updated: string
          reservation_value: number
          reservations: number
          roas: number
          total_clicks: number
          total_conversions: number
          total_impressions: number
          total_spend: number
          updated_at: string
        }
        Insert: {
          average_cpc?: number
          average_ctr?: number
          booking_step_1?: number
          booking_step_2?: number
          campaigns_count?: number
          click_to_call?: number
          client_id: string
          cost_per_reservation?: number
          created_at?: string
          data_source?: string
          date: string
          email_contacts?: number
          id?: string
          last_updated?: string
          reservation_value?: number
          reservations?: number
          roas?: number
          total_clicks?: number
          total_conversions?: number
          total_impressions?: number
          total_spend?: number
          updated_at?: string
        }
        Update: {
          average_cpc?: number
          average_ctr?: number
          booking_step_1?: number
          booking_step_2?: number
          campaigns_count?: number
          click_to_call?: number
          client_id?: string
          cost_per_reservation?: number
          created_at?: string
          data_source?: string
          date?: string
          email_contacts?: number
          id?: string
          last_updated?: string
          reservation_value?: number
          reservations?: number
          roas?: number
          total_clicks?: number
          total_conversions?: number
          total_impressions?: number
          total_spend?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_kpi_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_kpi_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "token_health_overview"
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
      email_scheduler_logs: {
        Row: {
          admin_id: string | null
          client_id: string | null
          created_at: string
          email_sent: boolean
          email_sent_at: string | null
          error_message: string | null
          frequency: string
          id: string
          operation_type: string
          report_period_end: string
          report_period_start: string
          retry_count: number | null
          send_day: number | null
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          client_id?: string | null
          created_at?: string
          email_sent?: boolean
          email_sent_at?: string | null
          error_message?: string | null
          frequency: string
          id?: string
          operation_type: string
          report_period_end: string
          report_period_start: string
          retry_count?: number | null
          send_day?: number | null
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          client_id?: string | null
          created_at?: string
          email_sent?: boolean
          email_sent_at?: string | null
          error_message?: string | null
          frequency?: string
          id?: string
          operation_type?: string
          report_period_end?: string
          report_period_start?: string
          retry_count?: number | null
          send_day?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_scheduler_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_scheduler_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_scheduler_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "token_health_overview"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_summaries: {
        Row: {
          client_id: string
          content: string
          created_at: string | null
          date_range_end: string
          date_range_start: string
          generated_at: string | null
          id: string
          is_ai_generated: boolean | null
          updated_at: string | null
        }
        Insert: {
          client_id: string
          content: string
          created_at?: string | null
          date_range_end: string
          date_range_start: string
          generated_at?: string | null
          id?: string
          is_ai_generated?: boolean | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          content?: string
          created_at?: string | null
          date_range_end?: string
          date_range_start?: string
          generated_at?: string | null
          id?: string
          is_ai_generated?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "executive_summaries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executive_summaries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "token_health_overview"
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
      sent_reports: {
        Row: {
          client_id: string
          created_at: string
          file_size_bytes: number | null
          id: string
          meta: Json | null
          pdf_url: string
          recipient_email: string
          report_id: string
          report_period: string
          sent_at: string
          status: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          file_size_bytes?: number | null
          id?: string
          meta?: Json | null
          pdf_url: string
          recipient_email: string
          report_id: string
          report_period: string
          sent_at?: string
          status?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          file_size_bytes?: number | null
          id?: string
          meta?: Json | null
          pdf_url?: string
          recipient_email?: string
          report_id?: string
          report_period?: string
          sent_at?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sent_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "token_health_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sent_reports_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      system_logs: {
        Row: {
          created_at: string | null
          id: string
          level: string | null
          message: string
          metadata: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          level?: string | null
          message: string
          metadata?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          level?: string | null
          message?: string
          metadata?: Json | null
        }
        Relationships: []
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
      google_ads_campaigns: {
        Row: {
          booking_step_1: number
          booking_step_2: number
          booking_step_3: number
          campaign_id: string
          campaign_name: string
          clicks: number
          client_id: string
          cpc: number
          ctr: number
          created_at: string
          date_range_end: string
          date_range_start: string
          demographics: Json | null
          email_clicks: number
          form_submissions: number
          id: string
          impressions: number
          phone_calls: number
          phone_clicks: number
          reservation_value: number
          reservations: number
          roas: number
          spend: number
          status: string
          updated_at: string
        }
        Insert: {
          booking_step_1?: number
          booking_step_2?: number
          booking_step_3?: number
          campaign_id: string
          campaign_name: string
          clicks?: number
          client_id: string
          cpc?: number
          ctr?: number
          created_at?: string
          date_range_end: string
          date_range_start: string
          demographics?: Json | null
          email_clicks?: number
          form_submissions?: number
          id?: string
          impressions?: number
          phone_calls?: number
          phone_clicks?: number
          reservation_value?: number
          reservations?: number
          roas?: number
          spend?: number
          status: string
          updated_at?: string
        }
        Update: {
          booking_step_1?: number
          booking_step_2?: number
          booking_step_3?: number
          campaign_id?: string
          campaign_name?: string
          clicks?: number
          client_id?: string
          cpc?: number
          ctr?: number
          created_at?: string
          date_range_end?: string
          date_range_start?: string
          demographics?: Json | null
          email_clicks?: number
          form_submissions?: number
          id?: string
          impressions?: number
          phone_calls?: number
          phone_clicks?: number
          reservation_value?: number
          reservations?: number
          roas?: number
          spend?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_ads_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ads_tables_data: {
        Row: {
          client_id: string
          created_at: string
          data_source: string | null
          date_range_end: string
          date_range_start: string
          demographic_performance: Json | null
          device_performance: Json | null
          hourly_performance: Json | null
          id: string
          keywords_performance: Json | null
          last_updated: string | null
          placement_performance: Json | null
        }
        Insert: {
          client_id: string
          created_at?: string
          data_source?: string | null
          date_range_end: string
          date_range_start: string
          demographic_performance?: Json | null
          device_performance?: Json | null
          hourly_performance?: Json | null
          id?: string
          keywords_performance?: Json | null
          last_updated?: string | null
          placement_performance?: Json | null
        }
        Update: {
          client_id?: string
          created_at?: string
          data_source?: string | null
          date_range_end?: string
          date_range_start?: string
          demographic_performance?: Json | null
          device_performance?: Json | null
          hourly_performance?: Json | null
          id?: string
          keywords_performance?: Json | null
          last_updated?: string | null
          placement_performance?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "google_ads_tables_data_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
      automated_cache_cleanup: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_cache: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_campaign_summaries: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_daily_kpi_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_sent_reports: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_weekly_cache: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      get_cache_performance_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          cache_type: string
          total_entries: number
          cache_status: string
        }[]
      }
      get_campaign_summary: {
        Args: {
          p_client_id: string
          p_summary_type: string
          p_summary_date: string
        }
        Returns: {
          id: string
          client_id: string
          summary_type: string
          summary_date: string
          total_spend: number
          total_impressions: number
          total_clicks: number
          total_conversions: number
          average_ctr: number
          average_cpc: number
          average_cpa: number
          active_campaigns: number
          total_campaigns: number
          campaign_data: Json
          meta_tables: Json
          data_source: string
          last_updated: string
          created_at: string
        }[]
      }
      get_daily_kpi_for_carousel: {
        Args: { p_client_id: string }
        Returns: {
          date: string
          total_clicks: number
          total_impressions: number
          total_spend: number
          total_conversions: number
          click_to_call: number
          email_contacts: number
          reservations: number
          reservation_value: number
          average_ctr: number
          average_cpc: number
          data_source: string
          days_in_month: number
        }[]
      }
      get_recent_logs: {
        Args: { p_hours?: number }
        Returns: {
          id: string
          message: string
          level: string
          created_at: string
        }[]
      }
      get_storage_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_summaries: number
          monthly_count: number
          weekly_count: number
          oldest_date: string
          newest_date: string
          total_size_mb: number
        }[]
      }
      upsert_daily_kpi_data: {
        Args: {
          p_client_id: string
          p_date: string
          p_clicks: number
          p_impressions: number
          p_spend: number
          p_conversions: number
          p_click_to_call?: number
          p_email_contacts?: number
          p_booking_step_1?: number
          p_reservations?: number
          p_reservation_value?: number
          p_booking_step_2?: number
          p_campaigns_count?: number
          p_data_source?: string
        }
        Returns: string
      }
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
