-- Migration: Add automation triggers for smart data loading
-- This adds database-level automation for data freshness and cleanup

-- Function to check data freshness and trigger refresh if needed
CREATE OR REPLACE FUNCTION check_data_freshness()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if data is older than 7 days for monthly, 24 hours for weekly
  IF NEW.summary_type = 'monthly' AND 
     NEW.last_updated < NOW() - INTERVAL '7 days' THEN
    -- Log that data needs refresh
    INSERT INTO system_logs (message, level, created_at)
    VALUES ('Monthly data needs refresh for client ' || NEW.client_id, 'warning', NOW());
  END IF;
  
  IF NEW.summary_type = 'weekly' AND 
     NEW.last_updated < NOW() - INTERVAL '24 hours' THEN
    -- Log that data needs refresh
    INSERT INTO system_logs (message, level, created_at)
    VALUES ('Weekly data needs refresh for client ' || NEW.client_id, 'warning', NOW());
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to check data freshness on update
CREATE TRIGGER check_data_freshness_trigger
  AFTER UPDATE ON campaign_summaries
  FOR EACH ROW
  EXECUTE FUNCTION check_data_freshness();

-- Function to automatically clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Remove data older than 12 months
  DELETE FROM campaign_summaries 
  WHERE summary_date < CURRENT_DATE - INTERVAL '12 months';
  
  -- Log cleanup
  INSERT INTO system_logs (message, level, created_at)
  VALUES ('Cleaned up old campaign summaries', 'info', NOW());
END;
$$ LANGUAGE plpgsql;

-- Function to get storage statistics
CREATE OR REPLACE FUNCTION get_storage_stats()
RETURNS TABLE (
  total_summaries BIGINT,
  monthly_count BIGINT,
  weekly_count BIGINT,
  oldest_date DATE,
  newest_date DATE,
  total_size_mb NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_summaries,
    COUNT(*) FILTER (WHERE summary_type = 'monthly') as monthly_count,
    COUNT(*) FILTER (WHERE summary_type = 'weekly') as weekly_count,
    MIN(summary_date) as oldest_date,
    MAX(summary_date) as newest_date,
    ROUND(pg_total_relation_size('campaign_summaries') / 1024.0 / 1024.0, 2) as total_size_mb
  FROM campaign_summaries;
END;
$$ LANGUAGE plpgsql;

-- Create system_logs table for monitoring
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message TEXT NOT NULL,
  level TEXT CHECK (level IN ('info', 'warning', 'error')) DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for efficient log querying
CREATE INDEX idx_system_logs_created_at ON system_logs(created_at);
CREATE INDEX idx_system_logs_level ON system_logs(level);

-- RLS policies for system_logs
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all logs
CREATE POLICY "Admins can view system logs" ON system_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Function to get recent system logs
CREATE OR REPLACE FUNCTION get_recent_logs(p_hours INTEGER DEFAULT 24)
RETURNS TABLE (
  id UUID,
  message TEXT,
  level TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sl.id,
    sl.message,
    sl.level,
    sl.created_at
  FROM system_logs sl
  WHERE sl.created_at >= NOW() - (p_hours || ' hours')::INTERVAL
  ORDER BY sl.created_at DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql; 