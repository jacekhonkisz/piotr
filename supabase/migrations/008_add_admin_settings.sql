-- Add admin settings for email configuration and reporting defaults

-- Insert email configuration settings
INSERT INTO system_settings (key, value, description) VALUES
  ('smtp_host', '""', 'SMTP server hostname'),
  ('smtp_port', '587', 'SMTP server port'),
  ('smtp_username', '""', 'SMTP username'),
  ('smtp_password', '""', 'SMTP password (encrypted)'),
  ('smtp_secure', 'true', 'Use SSL/TLS for SMTP'),
  ('email_from_name', '""', 'Default sender name for emails'),
  ('email_from_address', '""', 'Default sender email address'),
  ('email_provider', '"smtp"', 'Email provider (smtp, sendgrid, mailgun, etc.)'),
  ('sendgrid_api_key', '""', 'SendGrid API key (if using SendGrid)'),
  ('mailgun_api_key', '""', 'Mailgun API key (if using Mailgun)'),
  ('email_test_status', '"not_configured"', 'Email configuration test status'),
  ('last_email_test', 'null', 'Last email test timestamp'),
  ('email_test_result', '""', 'Last email test result message')
ON CONFLICT (key) DO NOTHING;

-- Insert reporting settings
INSERT INTO system_settings (key, value, description) VALUES
  ('default_reporting_day', '5', 'Default day of month for monthly reports'),
  ('default_reporting_weekday', '1', 'Default weekday for weekly reports (1=Monday)'),
  ('bulk_report_send_enabled', 'true', 'Enable bulk report sending'),
  ('last_bulk_report_send', 'null', 'Last bulk report send timestamp'),
  ('bulk_report_send_count', '0', 'Number of reports sent in last bulk send'),
  ('bulk_report_send_errors', '0', 'Number of errors in last bulk send'),
  ('auto_report_generation', 'true', 'Enable automatic report generation'),
  ('report_retention_days', '365', 'Number of days to keep reports')
ON CONFLICT (key) DO NOTHING;

-- Insert client management settings
INSERT INTO system_settings (key, value, description) VALUES
  ('default_client_status', '"active"', 'Default status for new clients'),
  ('auto_assign_tokens', 'false', 'Automatically assign tokens to new clients'),
  ('client_approval_required', 'false', 'Require admin approval for new clients')
ON CONFLICT (key) DO NOTHING;

-- Insert security settings
INSERT INTO system_settings (key, value, description) VALUES
  ('session_timeout_hours', '24', 'Session timeout in hours'),
  ('require_password_change_days', '90', 'Require password change every X days'),
  ('max_login_attempts', '5', 'Maximum login attempts before lockout'),
  ('lockout_duration_minutes', '30', 'Account lockout duration in minutes')
ON CONFLICT (key) DO NOTHING;

-- Create email_logs_bulk table for tracking bulk email operations
CREATE TABLE email_logs_bulk (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  operation_type TEXT NOT NULL, -- 'bulk_report_send', 'test_email', etc.
  total_recipients INTEGER DEFAULT 0 NOT NULL,
  successful_sends INTEGER DEFAULT 0 NOT NULL,
  failed_sends INTEGER DEFAULT 0 NOT NULL,
  error_details JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running' NOT NULL, -- 'running', 'completed', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX idx_email_logs_bulk_admin_id ON email_logs_bulk(admin_id);
CREATE INDEX idx_email_logs_bulk_status ON email_logs_bulk(status);
CREATE INDEX idx_email_logs_bulk_created_at ON email_logs_bulk(created_at);

-- Enable RLS on email_logs_bulk
ALTER TABLE email_logs_bulk ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_logs_bulk
CREATE POLICY "Admins can view their bulk email logs" ON email_logs_bulk
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
      AND profiles.id = email_logs_bulk.admin_id
    )
  );

CREATE POLICY "Admins can manage their bulk email logs" ON email_logs_bulk
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
      AND profiles.id = email_logs_bulk.admin_id
    )
  );

-- Add updated_at trigger for email_logs_bulk
CREATE TRIGGER update_email_logs_bulk_updated_at BEFORE UPDATE ON email_logs_bulk
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 