-- Migration: Add sent_reports table for tracking actually sent PDF reports
-- This table will store only reports that have been sent to clients as PDFs
-- with automatic cleanup after 12 months

-- Create sent_reports table
CREATE TABLE sent_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  report_period TEXT NOT NULL, -- e.g., "January 2025", "Q1 2025"
  pdf_url TEXT NOT NULL, -- Supabase Storage URL to the PDF file
  recipient_email TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'delivered', 'bounced')),
  file_size_bytes INTEGER,
  meta JSONB, -- Additional metadata like campaign IDs, summary, etc.
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure no duplicate sent reports for same client and period
  UNIQUE(client_id, report_period)
);

-- Create indexes for performance
CREATE INDEX idx_sent_reports_client_id ON sent_reports(client_id);
CREATE INDEX idx_sent_reports_sent_at ON sent_reports(sent_at);
CREATE INDEX idx_sent_reports_status ON sent_reports(status);
CREATE INDEX idx_sent_reports_report_period ON sent_reports(report_period);

-- Create function to automatically clean up old sent reports (older than 12 months)
CREATE OR REPLACE FUNCTION cleanup_old_sent_reports()
RETURNS void AS $$
BEGIN
  -- Delete sent reports older than 12 months
  DELETE FROM sent_reports 
  WHERE sent_at < NOW() - INTERVAL '12 months';
  
  -- Note: PDF files in Supabase Storage should be cleaned up separately
  -- This can be done via a scheduled job or manual cleanup
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup every month
-- Note: This requires pg_cron extension which may not be available in all Supabase plans
-- For now, this will be handled manually or via external cron jobs

-- Add RLS policies for sent_reports
ALTER TABLE sent_reports ENABLE ROW LEVEL SECURITY;

-- Admin can view all sent reports
CREATE POLICY "Admins can view all sent reports" ON sent_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Admin can insert sent reports
CREATE POLICY "Admins can insert sent reports" ON sent_reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Admin can update sent reports
CREATE POLICY "Admins can update sent reports" ON sent_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Admin can delete sent reports
CREATE POLICY "Admins can delete sent reports" ON sent_reports
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Clients can only view their own sent reports
CREATE POLICY "Clients can view their own sent reports" ON sent_reports
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE email = (
        SELECT email FROM auth.users 
        WHERE id = auth.uid()
      )
    )
  ); 