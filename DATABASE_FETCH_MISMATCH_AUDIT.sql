-- ============================================================================
-- AUDIT: Why is the query not finding data when 1178 records exist?
-- ============================================================================

-- 1. Check what platforms are actually stored
SELECT 
  platform,
  COUNT(*) as count
FROM campaign_summaries
GROUP BY platform
ORDER BY count DESC;

-- 2. Check what summary_types exist
SELECT 
  summary_type,
  COUNT(*) as count
FROM campaign_summaries
GROUP BY summary_type
ORDER BY count DESC;

-- 3. Check date format in database
SELECT 
  summary_date,
  summary_type,
  platform,
  TO_CHAR(summary_date, 'YYYY-MM-DD') as formatted_date,
  EXTRACT(YEAR FROM summary_date) as year,
  EXTRACT(MONTH FROM summary_date) as month
FROM campaign_summaries
ORDER BY summary_date DESC
LIMIT 10;

-- 4. Check if there are NULL platforms (would not match query)
SELECT 
  COUNT(*) as null_platform_count
FROM campaign_summaries
WHERE platform IS NULL;

-- 5. Check recent months (what's actually available)
SELECT 
  TO_CHAR(summary_date, 'YYYY-MM') as year_month,
  summary_type,
  platform,
  COUNT(*) as count,
  SUM(total_spend) as total_spend
FROM campaign_summaries
WHERE summary_date >= NOW() - INTERVAL '6 months'
GROUP BY TO_CHAR(summary_date, 'YYYY-MM'), summary_type, platform
ORDER BY year_month DESC, summary_type, platform;

-- 6. Sample query that mimics the application query
-- This is what the app is doing for a monthly request
SELECT 
  client_id,
  summary_date,
  summary_type,
  platform,
  total_spend,
  total_impressions,
  total_clicks
FROM campaign_summaries
WHERE summary_type = 'monthly'
  AND platform = 'meta'
  AND summary_date >= NOW() - INTERVAL '3 months'
ORDER BY summary_date DESC
LIMIT 5;

-- 7. Check if data has the right unique constraint
SELECT 
  client_id,
  summary_type,
  summary_date,
  platform,
  COUNT(*) as duplicate_count
FROM campaign_summaries
GROUP BY client_id, summary_type, summary_date, platform
HAVING COUNT(*) > 1;

-- 8. Check for data quality issues
SELECT 
  'Records with zero metrics' as issue,
  COUNT(*) as count
FROM campaign_summaries
WHERE total_spend = 0 
  AND total_impressions = 0 
  AND total_clicks = 0;
