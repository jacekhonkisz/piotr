-- =====================================================
-- DEBUG WEEK 46 DATA ISSUE
-- =====================================================
-- This script checks ALL possible data for Week 46
-- Run in Supabase Dashboard SQL Editor
-- =====================================================

-- ✅ EXACT QUERY USED BY StandardizedDataFetcher for Week 46
SELECT 
  '1. StandardizedDataFetcher Query (exact match)' as query_type,
  summary_date,
  summary_type,
  platform,
  total_spend,
  total_impressions,
  total_clicks,
  total_conversions,
  COALESCE(jsonb_array_length(campaign_data::jsonb), 0) as campaign_count
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'weekly'
  AND platform = 'meta'
  AND summary_date >= '2025-11-10'
  AND summary_date <= '2025-11-16'
ORDER BY summary_date DESC;

-- ✅ ALL WEEKLY DATA FOR NOVEMBER 2025
SELECT 
  '2. All November weekly data' as query_type,
  summary_date,
  summary_type,
  platform,
  total_spend,
  total_impressions,
  total_clicks,
  COALESCE(jsonb_array_length(campaign_data::jsonb), 0) as campaign_count,
  created_at
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'weekly'
  AND summary_date >= '2025-11-01'
  AND summary_date <= '2025-11-30'
ORDER BY summary_date ASC;

-- ✅ WHAT findMissingWeeks() CHECKS (from incremental collection)
SELECT 
  '4. What incremental collection checks' as query_type,
  summary_date,
  summary_type,
  platform,
  total_spend
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'weekly'
  AND platform = 'meta'
  AND summary_date >= '2025-11-10'
  AND summary_date <= (DATE '2025-11-10' + INTERVAL '6 days')::date;

-- ✅ COUNT ALL SUMMARIES FOR THIS CLIENT
SELECT 
  '5. Total summary count' as query_type,
  summary_type,
  platform,
  COUNT(*) as count,
  MIN(summary_date) as earliest_date,
  MAX(summary_date) as latest_date,
  SUM(total_spend) as total_spend_all
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
GROUP BY summary_type, platform
ORDER BY summary_type, platform;

-- ✅ CHECK CURRENT WEEK CACHE (if table exists)
SELECT 
  '6. Current week cache' as query_type,
  last_updated,
  EXTRACT(EPOCH FROM (NOW() - last_updated)) / 3600 as age_hours,
  COALESCE(jsonb_array_length((cache_data->'campaigns')::jsonb), 0) as campaign_count,
  (cache_data->>'totalSpend')::float as total_spend
FROM current_week_cache
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
ORDER BY last_updated DESC
LIMIT 10;

-- ✅ FINAL DIAGNOSIS: What should be done?
SELECT 
  '7. DIAGNOSIS' as info,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM campaign_summaries
      WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
        AND summary_type = 'weekly'
        AND platform = 'meta'
        AND summary_date BETWEEN '2025-11-10' AND '2025-11-16'
    ) THEN '✅ Week 46 data EXISTS in campaign_summaries'
    ELSE '❌ Week 46 data MISSING from campaign_summaries'
  END as status,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM campaign_summaries
      WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
        AND summary_type = 'weekly'
        AND platform = 'meta'
        AND summary_date BETWEEN '2025-11-10' AND '2025-11-16'
        AND total_spend > 0
    ) THEN '✅ Week 46 has actual spend data'
    ELSE '⚠️ Week 46 has NO spend (could be dummy/placeholder)'
  END as data_quality;

