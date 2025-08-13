-- Migration: Fix cleanup functions for year-over-year comparisons
-- This migration updates all cleanup functions to preserve 13+ months of data
-- instead of 12 months, ensuring year-over-year comparisons always work

-- 1. Update the main automated cleanup function
CREATE OR REPLACE FUNCTION automated_cache_cleanup()
RETURNS void AS $$
BEGIN
  -- Clean up old current month cache (older than 7 days)
  DELETE FROM current_month_cache 
  WHERE last_updated < NOW() - INTERVAL '7 days';
  
  -- Clean up old campaign summaries (older than 13 months for year-over-year comparisons)
  -- Changed from 12 to 13 months to ensure we always have comparison data
  DELETE FROM campaign_summaries 
  WHERE summary_date < CURRENT_DATE - INTERVAL '13 months';
  
  -- Clean up old executive summaries (older than 13 months)
  DELETE FROM executive_summaries 
  WHERE date_range_start < (CURRENT_DATE - INTERVAL '13 months')::TEXT;
  
  RAISE NOTICE 'Automated cache cleanup completed (13 months retention for year-over-year comparisons)';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update the generic cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Remove data older than 13 months (changed from 12 for year-over-year comparisons)
  DELETE FROM campaign_summaries 
  WHERE summary_date < CURRENT_DATE - INTERVAL '13 months';
  
  -- Log cleanup
  INSERT INTO system_logs (message, level, created_at)
  VALUES ('Cleaned up old campaign summaries (13 months retention)', 'info', NOW());
END;
$$ LANGUAGE plpgsql;

-- 3. Update sent reports cleanup (can stay at 12 months as they're not used for comparisons)
CREATE OR REPLACE FUNCTION cleanup_old_sent_reports()
RETURNS void AS $$
BEGIN
  -- Delete sent reports older than 12 months (these don't need year-over-year comparison)
  DELETE FROM sent_reports 
  WHERE sent_at < NOW() - INTERVAL '12 months';
  
  -- Note: PDF files in Supabase Storage should be cleaned up separately
  -- This can be done via a scheduled job or manual cleanup
END;
$$ LANGUAGE plpgsql;

-- 4. Add a function specifically for year-over-year data validation
CREATE OR REPLACE FUNCTION validate_year_over_year_data()
RETURNS TABLE (
  current_month TEXT,
  has_previous_year_data BOOLEAN,
  months_of_data_available INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs_current.summary_date as current_month,
    EXISTS(
      SELECT 1 FROM campaign_summaries cs_prev
      WHERE cs_prev.summary_date = (
        TO_DATE(cs_current.summary_date, 'YYYY-MM-DD') - INTERVAL '1 year'
      )::DATE::TEXT
      AND cs_prev.client_id = cs_current.client_id
      AND cs_prev.summary_type = 'monthly'
    ) as has_previous_year_data,
    (
      SELECT COUNT(DISTINCT summary_date)::INTEGER
      FROM campaign_summaries cs_count
      WHERE cs_count.client_id = cs_current.client_id
      AND cs_count.summary_type = 'monthly'
    ) as months_of_data_available
  FROM campaign_summaries cs_current
  WHERE cs_current.summary_type = 'monthly'
  AND cs_current.summary_date >= (CURRENT_DATE - INTERVAL '12 months')::TEXT
  ORDER BY cs_current.summary_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION automated_cache_cleanup() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_data() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_sent_reports() TO service_role;
GRANT EXECUTE ON FUNCTION validate_year_over_year_data() TO authenticated;

-- 6. Add comments
COMMENT ON FUNCTION automated_cache_cleanup() IS 'Automated cleanup with 13 months retention for year-over-year comparisons';
COMMENT ON FUNCTION cleanup_old_data() IS 'Clean up old campaign summaries with 13 months retention';
COMMENT ON FUNCTION validate_year_over_year_data() IS 'Validates year-over-year data availability for each client'; 