-- ============================================================================
-- BELMONTE GOOGLE ADS DATA CHECK - FIXED VERSION
-- ============================================================================
-- Client ID: ab0b4c7e-2bf0-46bc-b455-b18ef6942baa
-- All queries tested and working
-- ============================================================================

-- 1️⃣ QUICK HEALTH CHECK (FIXED)
SELECT 
  CASE 
    WHEN COUNT(*) > 0 AND MAX(last_updated) > NOW() - INTERVAL '6 hours' THEN '✅ HEALTHY - Cache is fresh'
    WHEN COUNT(*) > 0 AND MAX(last_updated) > NOW() - INTERVAL '24 hours' THEN '⚠️ STALE - Cache needs refresh'
    WHEN COUNT(*) > 0 THEN '❌ VERY OLD - Cron may not be running'
    ELSE '❌ NO DATA - Cache is empty'
  END as cache_status,
  COUNT(*) as cache_entries,
  to_char(MAX(last_updated), 'YYYY-MM-DD HH24:MI:SS') as last_refresh,
  ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(last_updated)))/3600, 2) as hours_since_refresh
FROM google_ads_current_month_cache
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
AND period_id = to_char(NOW(), 'YYYY-MM');

-- If result shows data exists, run this to get details:


-- 2️⃣ CURRENT MONTH CACHE FULL DETAILS
SELECT 
  period_id,
  to_char(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated,
  ROUND(EXTRACT(EPOCH FROM (NOW() - last_updated))/3600, 2) as hours_old,
  jsonb_array_length(cache_data->'campaigns') as campaigns,
  ROUND((cache_data->'stats'->>'totalSpend')::numeric, 2) as spend,
  (cache_data->'stats'->>'totalImpressions')::integer as impressions,
  (cache_data->'stats'->>'totalClicks')::integer as clicks,
  (cache_data->'conversionMetrics'->>'reservations')::integer as reservations,
  ROUND((cache_data->'conversionMetrics'->>'reservation_value')::numeric, 2) as reservation_value,
  CASE 
    WHEN (cache_data->'googleAdsTables') IS NOT NULL THEN '✅ Yes'
    ELSE '❌ No'
  END as has_tables_data,
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - last_updated))/3600 < 6 THEN '✅ Fresh'
    WHEN EXTRACT(EPOCH FROM (NOW() - last_updated))/3600 < 24 THEN '⚠️ Aging'
    ELSE '❌ Stale'
  END as freshness_status
FROM google_ads_current_month_cache
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
AND period_id = to_char(NOW(), 'YYYY-MM');


-- 3️⃣ CHECK TABLES DATA AVAILABILITY
SELECT 
  period_id,
  to_char(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated,
  CASE 
    WHEN (cache_data->'googleAdsTables'->'networkPerformance') IS NOT NULL THEN '✅ Yes' 
    ELSE '❌ No' 
  END as has_network,
  CASE 
    WHEN (cache_data->'googleAdsTables'->'qualityMetrics') IS NOT NULL THEN '✅ Yes' 
    ELSE '❌ No' 
  END as has_quality,
  CASE 
    WHEN (cache_data->'googleAdsTables'->'devicePerformance') IS NOT NULL THEN '✅ Yes' 
    ELSE '❌ No' 
  END as has_device,
  CASE 
    WHEN (cache_data->'googleAdsTables'->'keywordPerformance') IS NOT NULL THEN '✅ Yes' 
    ELSE '❌ No' 
  END as has_keyword,
  COALESCE(jsonb_array_length(cache_data->'googleAdsTables'->'networkPerformance'), 0) as network_rows,
  COALESCE(jsonb_array_length(cache_data->'googleAdsTables'->'qualityMetrics'), 0) as quality_rows,
  COALESCE(jsonb_array_length(cache_data->'googleAdsTables'->'devicePerformance'), 0) as device_rows,
  COALESCE(jsonb_array_length(cache_data->'googleAdsTables'->'keywordPerformance'), 0) as keyword_rows
FROM google_ads_current_month_cache
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
AND period_id = to_char(NOW(), 'YYYY-MM');


-- 4️⃣ SAMPLE CAMPAIGNS (First 3)
SELECT 
  jsonb_array_elements(cache_data->'campaigns')->>'campaignName' as campaign_name,
  jsonb_array_elements(cache_data->'campaigns')->>'campaignId' as campaign_id,
  ROUND((jsonb_array_elements(cache_data->'campaigns')->>'spend')::numeric, 2) as spend,
  (jsonb_array_elements(cache_data->'campaigns')->>'impressions')::integer as impressions,
  (jsonb_array_elements(cache_data->'campaigns')->>'clicks')::integer as clicks,
  jsonb_array_elements(cache_data->'campaigns')->>'status' as status
FROM google_ads_current_month_cache
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
AND period_id = to_char(NOW(), 'YYYY-MM')
LIMIT 3;


-- 5️⃣ HISTORICAL DATA SUMMARY (Last 6 months)
SELECT 
  to_char(summary_date, 'YYYY-MM') as month,
  summary_type,
  COUNT(*) as records,
  ROUND(SUM(total_spend), 2) as total_spend,
  SUM(total_impressions) as impressions,
  SUM(total_clicks) as clicks,
  SUM(reservations) as reservations,
  ROUND(SUM(reservation_value), 2) as reservation_value
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
AND platform = 'google'
AND summary_date >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY to_char(summary_date, 'YYYY-MM'), summary_type
ORDER BY month DESC, summary_type;


-- 6️⃣ ALL DATA SOURCES STATUS
WITH current_month AS (
  SELECT 
    'Current Month Cache' as data_source,
    to_char(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_update,
    1 as records,
    '✅' as available
  FROM google_ads_current_month_cache
  WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND period_id = to_char(NOW(), 'YYYY-MM')
  LIMIT 1
),
current_week AS (
  SELECT 
    'Current Week Cache' as data_source,
    to_char(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_update,
    1 as records,
    '✅' as available
  FROM google_ads_current_week_cache
  WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND period_id = to_char(NOW(), 'IYYY-"W"IW')
  LIMIT 1
),
historical AS (
  SELECT 
    'Historical Data (campaign_summaries)' as data_source,
    to_char(MAX(last_updated), 'YYYY-MM-DD HH24:MI:SS') as last_update,
    COUNT(*)::integer as records,
    CASE WHEN COUNT(*) > 0 THEN '✅' ELSE '❌' END as available
  FROM campaign_summaries
  WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'google'
),
daily_kpi AS (
  SELECT 
    'Daily KPI Data (should be empty)' as data_source,
    to_char(MAX(created_at), 'YYYY-MM-DD HH24:MI:SS') as last_update,
    COUNT(*)::integer as records,
    CASE 
      WHEN COUNT(*) = 0 THEN '✅ Empty (correct)'
      ELSE '⚠️ Has data (unexpected)'
    END as available
  FROM daily_kpi_data
  WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'google'
)
SELECT * FROM current_month
UNION ALL SELECT * FROM current_week
UNION ALL SELECT * FROM historical
UNION ALL SELECT * FROM daily_kpi;


-- 7️⃣ SIMPLE CHECK: Does cache exist?
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM google_ads_current_month_cache 
      WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
      AND period_id = to_char(NOW(), 'YYYY-MM')
    ) THEN '✅ YES - Cache exists'
    ELSE '❌ NO - Cache is empty'
  END as cache_exists,
  to_char(NOW(), 'YYYY-MM') as current_period;


-- ============================================================================
-- SUPER SIMPLE ONE-LINER (Run this first!)
-- ============================================================================
SELECT COUNT(*) as cache_count FROM google_ads_current_month_cache 
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
AND period_id = to_char(NOW(), 'YYYY-MM');
-- Expected: 1 (cache exists) or 0 (no cache)


-- ============================================================================
-- EXPECTED RESULTS
-- ============================================================================
-- 
-- Query #1: Should show cache_status and hours_since_refresh
-- Query #2: Full details with campaigns, spend, etc.
-- Query #3: Should show '✅ Yes' for all tables if working correctly
-- Query #7: Should say '✅ YES - Cache exists'
-- One-liner: Should return 1
--
-- ============================================================================

