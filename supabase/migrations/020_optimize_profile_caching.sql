-- Optimize profile caching performance
-- This migration adds indexes and optimizations for faster profile lookups

-- 1. Add indexes for faster profile queries
CREATE INDEX IF NOT EXISTS idx_profiles_id_email ON profiles(id, email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at);

-- 2. Add indexes for cache tables
CREATE INDEX IF NOT EXISTS idx_current_month_cache_lookup ON current_month_cache(client_id, period_id, last_updated);
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_lookup ON campaign_summaries(client_id, summary_type, summary_date, last_updated);

-- 3. Optimize RLS policies for better performance
-- Drop existing policies and recreate with better performance
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Recreate with optimized policies
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 4. Add function for cache statistics
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
    EXTRACT(EPOCH FROM (NOW() - AVG(last_updated))) / 60 as avg_age_minutes,
    (COUNT(CASE WHEN last_updated > NOW() - INTERVAL '3 hours' THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC * 100) as hit_rate_estimate
  FROM current_month_cache
  
  UNION ALL
  
  SELECT 
    'campaign_summaries'::TEXT as cache_type,
    COUNT(*)::BIGINT as total_entries,
    EXTRACT(EPOCH FROM (NOW() - AVG(last_updated))) / 60 as avg_age_minutes,
    (COUNT(CASE WHEN last_updated > NOW() - INTERVAL '7 days' THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC * 100) as hit_rate_estimate
  FROM campaign_summaries;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Add function for cache cleanup automation
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
  DELETE FROM executive_summaries 
  WHERE date_range_start < (CURRENT_DATE - INTERVAL '12 months')::TEXT;
  
  RAISE NOTICE 'Automated cache cleanup completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_cache_performance_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION automated_cache_cleanup() TO service_role;

-- 7. Add comments for documentation
COMMENT ON INDEX idx_profiles_id_email IS 'Optimizes profile lookups by user ID and email';
COMMENT ON INDEX idx_current_month_cache_lookup IS 'Optimizes smart cache lookups';
COMMENT ON INDEX idx_campaign_summaries_lookup IS 'Optimizes historical data cache lookups';
COMMENT ON FUNCTION get_cache_performance_stats() IS 'Provides cache performance statistics for monitoring';
COMMENT ON FUNCTION automated_cache_cleanup() IS 'Automated cleanup of old cache entries'; 