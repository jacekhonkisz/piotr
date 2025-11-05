-- Migration: Add PDF generation jobs table for async processing
-- This allows PDF generation to happen in the background while users see progress

CREATE TABLE IF NOT EXISTS pdf_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
  
  -- Job metadata
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  
  -- Date range for the report
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  
  -- Result
  pdf_url TEXT,
  pdf_size_bytes INTEGER,
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Prevent duplicate jobs
  UNIQUE(client_id, date_range_start, date_range_end)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pdf_jobs_status 
  ON pdf_generation_jobs(client_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pdf_jobs_created 
  ON pdf_generation_jobs(created_at DESC)
  WHERE status IN ('pending', 'processing');

-- RLS Policies
ALTER TABLE pdf_generation_jobs ENABLE ROW LEVEL SECURITY;

-- Clients can view their own jobs
CREATE POLICY "Clients can view their own PDF jobs" ON pdf_generation_jobs
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Admins can view all jobs
CREATE POLICY "Admins can view all PDF jobs" ON pdf_generation_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Service role can manage all jobs
CREATE POLICY "Service role can manage PDF jobs" ON pdf_generation_jobs
  FOR ALL USING (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- Add comment
COMMENT ON TABLE pdf_generation_jobs IS 'Background PDF generation jobs with progress tracking';
COMMENT ON COLUMN pdf_generation_jobs.status IS 'Job status: pending, processing, completed, failed';
COMMENT ON COLUMN pdf_generation_jobs.progress IS 'Progress percentage (0-100)';

