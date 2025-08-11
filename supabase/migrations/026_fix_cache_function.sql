-- Fix cache performance function
-- This migration fixes the timestamp handling in the cache performance function

-- Drop the problematic function
DROP FUNCTION IF EXISTS get_cache_performance_stats();

-- Recreate with fixed timestamp handling
CREATE OR REPLACE FUNCTION get_cache_performance_stats()
RETURNS TABLE (
  cache_type TEXT,
  total_entries BIGINT,
  avg_age_minutes NUMERIC,
  hit_rate_estimate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'current_month_cache'::TEXT as cache_type,
    COUNT(*)::BIGINT as total_entries,
    COALESCE(EXTRACT(EPOCH FROM (NOW() - AVG(last_updated::timestamp))) / 60, 0) as avg_age_minutes,
    COALESCE((COUNT(CASE WHEN last_updated > NOW() - INTERVAL '3 hours' THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 0) as hit_rate_estimate
  FROM current_month_cache
  
  UNION ALL
  
  SELECT 
    'campaign_summaries'::TEXT as cache_type,
    COUNT(*)::BIGINT as total_entries,
    COALESCE(EXTRACT(EPOCH FROM (NOW() - AVG(last_updated::timestamp))) / 60, 0) as avg_age_minutes,
    COALESCE((COUNT(CASE WHEN last_updated > NOW() - INTERVAL '7 days' THEN 1 END)::NUMERIC / NULLIF(COUNT(*), 0) * 100), 0) as hit_rate_estimate
  FROM campaign_summaries;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_cache_performance_stats() TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_cache_performance_stats() IS 'Provides cache performance statistics for monitoring (fixed version)'; 