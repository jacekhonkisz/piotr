-- Migration: Generated Reports System
-- Creates tables and indexes for automated report generation and storage

-- Create generated_reports table
CREATE TABLE generated_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) NOT NULL,
  report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('monthly', 'weekly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Polish content
  polish_summary TEXT NOT NULL,
  polish_subject VARCHAR(255) NOT NULL,
  
  -- PDF storage
  pdf_url TEXT,
  pdf_size_bytes INTEGER,
  pdf_generated_at TIMESTAMP WITH TIME ZONE,
  
  -- Performance data (for quick access without recalculation)
  total_spend DECIMAL(12,2),
  total_impressions INTEGER,
  total_clicks INTEGER,
  total_conversions INTEGER,
  ctr DECIMAL(5,2),
  cpc DECIMAL(8,2),
  cpm DECIMAL(8,2),
  cpa DECIMAL(8,2),
  
  -- Metadata
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('generating', 'completed', 'failed')),
  error_message TEXT,
  
  -- Ensure one report per client per period
  UNIQUE(client_id, report_type, period_start, period_end)
);

-- Create indexes for fast retrieval
CREATE INDEX idx_generated_reports_client_period ON generated_reports(client_id, period_start, period_end);
CREATE INDEX idx_generated_reports_status ON generated_reports(status);
CREATE INDEX idx_generated_reports_type_period ON generated_reports(report_type, period_start, period_end);
CREATE INDEX idx_generated_reports_generated_at ON generated_reports(generated_at DESC);

-- Add column to email_logs to link emails to generated reports
ALTER TABLE email_logs ADD COLUMN generated_report_id UUID REFERENCES generated_reports(id);

-- Create index on the new foreign key
CREATE INDEX idx_email_logs_generated_report ON email_logs(generated_report_id);

-- Insert a comment describing the table purpose
COMMENT ON TABLE generated_reports IS 'Stores pre-generated reports with Polish summaries and PDF attachments';
COMMENT ON COLUMN generated_reports.polish_summary IS 'Complete Polish summary text for email body';
COMMENT ON COLUMN generated_reports.polish_subject IS 'Polish email subject line';
COMMENT ON COLUMN generated_reports.pdf_url IS 'Supabase Storage URL for the generated PDF';
COMMENT ON COLUMN generated_reports.status IS 'Generation status: generating, completed, failed';

-- RLS policies for generated_reports
ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;

-- Clients can only see their own reports
CREATE POLICY "Clients can view their own generated reports" ON generated_reports
  FOR SELECT USING (client_id = auth.uid());

-- Admins can see all reports
CREATE POLICY "Admins can view all generated reports" ON generated_reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Service role can manage all reports (for automated generation)
CREATE POLICY "Service role can manage generated reports" ON generated_reports
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role'); 