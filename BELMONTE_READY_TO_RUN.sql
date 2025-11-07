-- ============================================================================
-- BELMONTE GOOGLE ADS DATA CHECK - READY TO RUN
-- ============================================================================
-- Client ID: ab0b4c7e-2bf0-46bc-b455-b18ef6942baa
-- Email: belmonte@hotel.com
-- Customer ID: 789-260-9395
-- ============================================================================

-- 1️⃣ QUICK HEALTH CHECK
SELECT 
  CASE 
    WHEN COUNT(*) > 0 AND MAX(last_updated) > NOW() - INTERVAL '6 hours' THEN '✅ HEALTHY - Cache is fresh'
    WHEN COUNT(*) > 0 AND MAX(last_updated) > NOW() - INTERVAL '24 hours' THEN '⚠️ STALE - Cache needs refresh'
    WHEN COUNT(*) > 0 THEN '❌ VERY OLD - Cron may not be running'
    ELSE '❌ NO DATA - Cache is empty'
  END as cache_status,
  COUNT(*) as cache_entries,
  to_char(MAX(last_updated), 'YYYY-MM-DD HH24:MI:SS') as last_refresh,
  ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(last_updated)))/3600, 2) as hours_since_refresh,
  jsonb_array_length(MAX(cache_data)->'campaigns') as campaign_count,
  ROUND((MAX(cache_data)->'stats'->>'totalSpend')::numeric, 2) as total_spend,
  CASE 
    WHEN (MAX(cache_data)->'googleAdsTables') IS NOT NULL THEN '✅ Yes'
    ELSE '❌ No'
  END as has_tables_data
FROM google_ads_current_month_cache
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
AND period_id = to_char(NOW(), 'YYYY-MM');


-- 2️⃣ CURRENT MONTH CACHE DETAILS
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


-- 3️⃣ CHECK TABLES DATA IN CACHE
SELECT 
  period_id,
  to_char(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated,
  -- Check each table component
  (cache_data->'googleAdsTables'->'networkPerformance') IS NOT NULL as has_network,
  (cache_data->'googleAdsTables'->'qualityMetrics') IS NOT NULL as has_quality,
  (cache_data->'googleAdsTables'->'devicePerformance') IS NOT NULL as has_device,
  (cache_data->'googleAdsTables'->'keywordPerformance') IS NOT NULL as has_keyword,
  -- Count rows in each table
  jsonb_array_length(cache_data->'googleAdsTables'->'networkPerformance') as network_rows,
  jsonb_array_length(cache_data->'googleAdsTables'->'qualityMetrics') as quality_rows,
  jsonb_array_length(cache_data->'googleAdsTables'->'devicePerformance') as device_rows,
  jsonb_array_length(cache_data->'googleAdsTables'->'keywordPerformance') as keyword_rows
FROM google_ads_current_month_cache
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
AND period_id = to_char(NOW(), 'YYYY-MM');


-- 4️⃣ SAMPLE CAMPAIGNS FROM CACHE (First 5)
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
LIMIT 5;


-- 5️⃣ HISTORICAL DATA (Last 6 months)
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


-- 6️⃣ ALL DATA SOURCES SUMMARY
SELECT 
  'Current Month Cache' as data_source,
  to_char(MAX(last_updated), 'YYYY-MM-DD HH24:MI:SS') as last_update,
  COUNT(*) as records,
  CASE WHEN COUNT(*) > 0 THEN '✅' ELSE '❌' END as available
FROM google_ads_current_month_cache
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
AND period_id = to_char(NOW(), 'YYYY-MM')

UNION ALL

SELECT 
  'Current Week Cache' as data_source,
  to_char(MAX(last_updated), 'YYYY-MM-DD HH24:MI:SS') as last_update,
  COUNT(*) as records,
  CASE WHEN COUNT(*) > 0 THEN '✅' ELSE '❌' END as available
FROM google_ads_current_week_cache
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
AND period_id = to_char(NOW(), 'IYYY-"W"IW')

UNION ALL

SELECT 
  'Historical Data (campaign_summaries)' as data_source,
  to_char(MAX(last_updated), 'YYYY-MM-DD HH24:MI:SS') as last_update,
  COUNT(*) as records,
  CASE WHEN COUNT(*) > 0 THEN '✅' ELSE '❌' END as available
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
AND platform = 'google'

UNION ALL

SELECT 
  'Daily KPI Data (should be empty)' as data_source,
  to_char(MAX(created_at), 'YYYY-MM-DD HH24:MI:SS') as last_update,
  COUNT(*) as records,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ Empty (correct)'
    ELSE '⚠️ Has data (unexpected)'
  END as available
FROM daily_kpi_data
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
AND platform = 'google';


-- 7️⃣ ALL CACHE HISTORY (All periods)
SELECT 
  period_id,
  to_char(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated,
  ROUND(EXTRACT(EPOCH FROM (NOW() - last_updated))/3600, 2) as hours_old,
  jsonb_array_length(cache_data->'campaigns') as campaigns,
  ROUND((cache_data->'stats'->>'totalSpend')::numeric, 2) as spend,
  (cache_data->'conversionMetrics'->>'reservations')::integer as reservations,
  (cache_data->'googleAdsTables') IS NOT NULL as has_tables
FROM google_ads_current_month_cache
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
ORDER BY period_id DESC;


-- ============================================================================
-- EXPECTED RESULTS FOR HEALTHY SYSTEM
-- ============================================================================
-- 
-- Query #1 (Health Check):
--   cache_status: '✅ HEALTHY - Cache is fresh'
--   hours_since_refresh: < 6
--   campaign_count: > 0 (e.g., 25)
--   total_spend: > 0 
--   has_tables_data: '✅ Yes'
--
-- Query #2 (Cache Details):
--   hours_old: < 6
--   campaigns: 25 (or actual count)
--   spend: 1723.33 (or actual)
--   has_tables_data: '✅ Yes'
--   freshness_status: '✅ Fresh'
--
-- Query #3 (Tables Data):
--   has_network: true
--   has_quality: true
--   has_device: true
--   has_keyword: true
--   All row counts: > 0
--
-- Query #6 (Data Sources):
--   Current Month Cache: ✅
--   Current Week Cache: ✅
--   Historical Data: ✅
--   Daily KPI Data: '✅ Empty (correct)'
--
-- ============================================================================

