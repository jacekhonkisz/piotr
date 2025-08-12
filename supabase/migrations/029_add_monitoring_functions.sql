-- Migration: Add monitoring functions for admin monitoring page
-- This migration creates the missing functions that the monitoring page is trying to call

-- Function to get storage statistics
CREATE OR REPLACE FUNCTION get_storage_stats()
RETURNS TABLE (
  total_summaries BIGINT,
  monthly_count BIGINT,
  weekly_count BIGINT,
  oldest_date TEXT,
  newest_date TEXT,
  total_size_mb DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_summaries,
    COUNT(*) FILTER (WHERE summary_type = 'monthly')::BIGINT as monthly_count,
    COUNT(*) FILTER (WHERE summary_type = 'weekly')::BIGINT as weekly_count,
    COALESCE(MIN(summary_date)::TEXT, 'No data') as oldest_date,
    COALESCE(MAX(summary_date)::TEXT, 'No data') as newest_date,
    0.00 as total_size_mb
  FROM campaign_summaries;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent system logs
CREATE OR REPLACE FUNCTION get_recent_logs(p_hours INTEGER DEFAULT 24)
RETURNS TABLE (
  id UUID,
  message TEXT,
  level TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- For now, return a simple log entry since we don't have a logs table
  -- In the future, you can create a proper logs table and modify this function
  RETURN QUERY
  SELECT 
    gen_random_uuid()::UUID as id,
    'System monitoring active - ' || p_hours || ' hours' as message,
    'info' as level,
    NOW() as created_at
  WHERE p_hours > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_storage_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_logs(INTEGER) TO authenticated;

-- Create a simple logs table for future use (optional)
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL,
  level TEXT CHECK (level IN ('info', 'warning', 'error')) DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

-- Enable RLS on system_logs
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view system logs
CREATE POLICY "Admins can view system logs" ON system_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Policy: Only admins can insert system logs
CREATE POLICY "Admins can insert system logs" ON system_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Insert a sample log entry
INSERT INTO system_logs (message, level, metadata) VALUES 
  ('Monitoring functions created successfully', 'info', '{"migration": "029_add_monitoring_functions.sql"}')
ON CONFLICT DO NOTHING; 