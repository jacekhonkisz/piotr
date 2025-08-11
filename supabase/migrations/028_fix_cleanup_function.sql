-- Fix automated cleanup function
-- This migration fixes the date comparison issues in the cleanup function

-- Drop the problematic function
DROP FUNCTION IF EXISTS automated_cache_cleanup();

-- Create a fixed version
CREATE OR REPLACE FUNCTION automated_cache_cleanup()
RETURNS void AS $$
BEGIN
  -- Clean up old current month cache (older than 7 days)
  DELETE FROM current_month_cache 
  WHERE last_updated < NOW() - INTERVAL '7 days';
  
  -- Clean up old campaign summaries (older than 12 months)
  DELETE FROM campaign_summaries 
  WHERE summary_date < CURRENT_DATE - INTERVAL '12 months';
  
  -- Clean up old executive summaries (older than 12 months)
  -- Note: executive_summaries table might not exist yet, so we'll skip it for now
  -- DELETE FROM executive_summaries 
  -- WHERE date_range_start < (CURRENT_DATE - INTERVAL '12 months')::TEXT;
  
  RAISE NOTICE 'Automated cache cleanup completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION automated_cache_cleanup() TO service_role;

-- Add comment
COMMENT ON FUNCTION automated_cache_cleanup() IS 'Automated cleanup of old cache entries (fixed version)'; 