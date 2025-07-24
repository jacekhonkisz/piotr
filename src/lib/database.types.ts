export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          role: 'admin' | 'client'
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role: 'admin' | 'client'
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'admin' | 'client'
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          id: string
          admin_id: string
          name: string
          email: string
          company: string | null
          meta_access_token: string
          ad_account_id: string
          reporting_frequency: 'monthly' | 'weekly' | 'on_demand'
          last_report_date: string | null
          api_status: 'valid' | 'invalid' | 'expired' | 'pending'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          admin_id: string
          name: string
          email: string
          company?: string | null
          meta_access_token: string
          ad_account_id: string
          reporting_frequency?: 'monthly' | 'weekly' | 'on_demand'
          last_report_date?: string | null
          api_status?: 'valid' | 'invalid' | 'expired' | 'pending'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          admin_id?: string
          name?: string
          email?: string
          company?: string | null
          meta_access_token?: string
          ad_account_id?: string
          reporting_frequency?: 'monthly' | 'weekly' | 'on_demand'
          last_report_date?: string | null
          api_status?: 'valid' | 'invalid' | 'expired' | 'pending'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_admin_id_fkey"
            columns: ["admin_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      reports: {
        Row: {
          id: string
          client_id: string
          date_range_start: string
          date_range_end: string
          file_url: string | null
          file_size_bytes: number | null
          generation_time_ms: number | null
          email_sent: boolean
          email_sent_at: string | null
          generated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          client_id: string
          date_range_start: string
          date_range_end: string
          file_url?: string | null
          file_size_bytes?: number | null
          generation_time_ms?: number | null
          email_sent?: boolean
          email_sent_at?: string | null
          generated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          date_range_start?: string
          date_range_end?: string
          file_url?: string | null
          file_size_bytes?: number | null
          generation_time_ms?: number | null
          email_sent?: boolean
          email_sent_at?: string | null
          generated_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_client_id_fkey"
            columns: ["client_id"]
            referencedRelation: "clients"
            referencedColumns: ["id"]
          }
        ]
      }
      campaigns: {
        Row: {
          id: string
          client_id: string
          campaign_id: string
          campaign_name: string
          status: string
          date_range_start: string
          date_range_end: string
          impressions: number
          clicks: number
          spend: number
          conversions: number
          ctr: number
          cpc: number
          cpp: number | null
          frequency: number | null
          reach: number | null
          demographics: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          client_id: string
          campaign_id: string
          campaign_name: string
          status: string
          date_range_start: string
          date_range_end: string
          impressions: number
          clicks: number
          spend: number
          conversions: number
          ctr: number
          cpc: number
          cpp?: number | null
          frequency?: number | null
          reach?: number | null
          demographics?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          client_id?: string
          campaign_id?: string
          campaign_name?: string
          status?: string
          date_range_start?: string
          date_range_end?: string
          impressions?: number
          clicks?: number
          spend?: number
          conversions?: number
          ctr?: number
          cpc?: number
          cpp?: number | null
          frequency?: number | null
          reach?: number | null
          demographics?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_client_id_fkey"
            columns: ["client_id"]
            referencedRelation: "clients"
            referencedColumns: ["id"]
          }
        ]
      }
      email_logs: {
        Row: {
          id: string
          report_id: string
          recipient_email: string
          subject: string
          status: 'sent' | 'delivered' | 'failed' | 'bounced'
          provider_id: string | null
          error_message: string | null
          sent_at: string
          delivered_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          report_id: string
          recipient_email: string
          subject: string
          status?: 'sent' | 'delivered' | 'failed' | 'bounced'
          provider_id?: string | null
          error_message?: string | null
          sent_at: string
          delivered_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          report_id?: string
          recipient_email?: string
          subject?: string
          status?: 'sent' | 'delivered' | 'failed' | 'bounced'
          provider_id?: string | null
          error_message?: string | null
          sent_at?: string
          delivered_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_report_id_fkey"
            columns: ["report_id"]
            referencedRelation: "reports"
            referencedColumns: ["id"]
          }
        ]
      }
      system_settings: {
        Row: {
          id: string
          key: string
          value: Json
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          value: Json
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: Json
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'admin' | 'client'
      client_status: 'active' | 'inactive' | 'suspended'
      api_status: 'valid' | 'invalid' | 'expired' | 'pending'
      reporting_frequency: 'monthly' | 'weekly' | 'on_demand'
      email_status: 'sent' | 'delivered' | 'failed' | 'bounced'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
} 