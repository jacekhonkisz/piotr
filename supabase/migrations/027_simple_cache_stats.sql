-- Simple cache statistics function
-- This migration creates a simpler version that works with actual column types

-- Drop the problematic function
DROP FUNCTION IF EXISTS get_cache_performance_stats();

-- Create a simple working version
CREATE OR REPLACE FUNCTION get_cache_performance_stats()
RETURNS TABLE (
  cache_type TEXT,
  total_entries BIGINT,
  cache_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'current_month_cache'::TEXT as cache_type,
    COUNT(*)::BIGINT as total_entries,
    CASE 
      WHEN COUNT(*) = 0 THEN 'empty'
      WHEN COUNT(CASE WHEN last_updated > NOW() - INTERVAL '3 hours' THEN 1 END) > 0 THEN 'fresh'
      ELSE 'stale'
    END as cache_status
  FROM current_month_cache
  
  UNION ALL
  
  SELECT 
    'campaign_summaries'::TEXT as cache_type,
    COUNT(*)::BIGINT as total_entries,
    CASE 
      WHEN COUNT(*) = 0 THEN 'empty'
      WHEN COUNT(CASE WHEN last_updated > NOW() - INTERVAL '7 days' THEN 1 END) > 0 THEN 'fresh'
      ELSE 'stale'
    END as cache_status
  FROM campaign_summaries;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_cache_performance_stats() TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_cache_performance_stats() IS 'Provides simple cache statistics for monitoring'; 