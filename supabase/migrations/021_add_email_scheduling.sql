-- Migration: Add email scheduling fields to clients table
-- This migration adds the necessary fields for automated email scheduling

-- Add email scheduling fields to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS send_day INTEGER DEFAULT 5;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_report_sent_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS next_report_scheduled_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS email_send_count INTEGER DEFAULT 0;

-- Add system settings for global email scheduling defaults
INSERT INTO system_settings (key, value, description) VALUES
  ('global_default_frequency', '"monthly"', 'Global default email frequency for all clients'),
  ('global_default_send_day', '5', 'Global default day of month/week for sending reports'),
  ('email_scheduler_enabled', 'true', 'Enable/disable automated email scheduling'),
  ('email_scheduler_time', '"09:00"', 'Time of day to send scheduled emails (HH:MM)'),
  ('email_retry_attempts', '3', 'Number of retry attempts for failed emails'),
  ('email_retry_delay_minutes', '30', 'Delay between email retry attempts in minutes')
ON CONFLICT (key) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_clients_next_report_scheduled ON clients(next_report_scheduled_at);
CREATE INDEX IF NOT EXISTS idx_clients_last_report_sent ON clients(last_report_sent_at);
CREATE INDEX IF NOT EXISTS idx_clients_frequency_send_day ON clients(reporting_frequency, send_day);

-- Create email_scheduler_logs table for tracking automated email operations
CREATE TABLE IF NOT EXISTS email_scheduler_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL, -- 'scheduled', 'manual', 'retry'
  frequency TEXT NOT NULL, -- 'monthly', 'weekly', 'on_demand'
  send_day INTEGER,
  report_period_start DATE NOT NULL,
  report_period_end DATE NOT NULL,
  email_sent BOOLEAN DEFAULT FALSE NOT NULL,
  email_sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for email_scheduler_logs
CREATE INDEX IF NOT EXISTS idx_email_scheduler_logs_client_id ON email_scheduler_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_email_scheduler_logs_created_at ON email_scheduler_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_email_scheduler_logs_email_sent ON email_scheduler_logs(email_sent);

-- Enable RLS on email_scheduler_logs
ALTER TABLE email_scheduler_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_scheduler_logs
CREATE POLICY "Admins can view email scheduler logs" ON email_scheduler_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage email scheduler logs" ON email_scheduler_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Add updated_at trigger for email_scheduler_logs
CREATE TRIGGER update_email_scheduler_logs_updated_at BEFORE UPDATE ON email_scheduler_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 