-- ============================================================================
-- BELMONTE GOOGLE ADS DATA AUDIT
-- ============================================================================
-- User ID: 0f2ff3cb-896c-4688-841a-1a9851ec1746
-- Email: belmonte@hotel.com
-- Date: November 6, 2025
-- ============================================================================

-- ============================================================================
-- 1. FIND BELMONTE CLIENT RECORD (CORRECTED)
-- ============================================================================
-- Note: Clients table doesn't have user_id, use email instead
SELECT 
  id as client_id,
  name,
  email,
  google_ads_enabled,
  google_ads_customer_id,
  google_ads_refresh_token IS NOT NULL as has_refresh_token,
  meta_access_token IS NOT NULL as has_meta_token,
  created_at,
  updated_at
FROM clients
WHERE email = 'belmonte@hotel.com';

-- Expected: Should show client_id and Google Ads configuration


-- ============================================================================
-- 2. CHECK CURRENT MONTH SMART CACHE (November 2025)
-- ============================================================================
SELECT 
  id,
  client_id,
  period_id,
  last_updated,
  EXTRACT(EPOCH FROM (NOW() - last_updated))/3600 as hours_since_update,
  created_at,
  -- Check what data is in cache
  jsonb_object_keys(cache_data) as cache_keys,
  -- Campaign count
  jsonb_array_length(cache_data->'campaigns') as campaign_count,
  -- Total spend
  (cache_data->'stats'->>'totalSpend')::numeric as total_spend,
  -- Check if tables data exists
  (cache_data->'googleAdsTables') IS NOT NULL as has_tables_data
FROM google_ads_current_month_cache
WHERE client_id IN (
  SELECT id FROM clients WHERE email = 'belmonte@hotel.com'
)
AND period_id = to_char(NOW(), 'YYYY-MM')
ORDER BY last_updated DESC;

-- Expected: Should show cache entry for November 2025 with fresh data (< 6 hours old)


-- ============================================================================
-- 3. CHECK CURRENT WEEK SMART CACHE
-- ============================================================================
SELECT 
  id,
  client_id,
  period_id,
  last_updated,
  EXTRACT(EPOCH FROM (NOW() - last_updated))/3600 as hours_since_update,
  created_at,
  jsonb_object_keys(cache_data) as cache_keys,
  jsonb_array_length(cache_data->'campaigns') as campaign_count,
  (cache_data->'stats'->>'totalSpend')::numeric as total_spend,
  (cache_data->'googleAdsTables') IS NOT NULL as has_tables_data
FROM google_ads_current_week_cache
WHERE client_id IN (
  SELECT id FROM clients WHERE email = 'belmonte@hotel.com'
)
AND period_id = to_char(NOW(), 'IYYY-"W"IW')
ORDER BY last_updated DESC;

-- Expected: Should show cache entry for current week


-- ============================================================================
-- 4. CHECK DETAILED CACHE DATA (November 2025 Full Structure)
-- ============================================================================
SELECT 
  period_id,
  last_updated,
  -- Main data keys
  jsonb_object_keys(cache_data) as main_keys,
  -- Campaign details
  jsonb_array_length(cache_data->'campaigns') as campaigns_count,
  -- Stats
  cache_data->'stats' as stats,
  -- Conversion metrics
  cache_data->'conversionMetrics' as conversion_metrics,
  -- Tables data structure
  jsonb_object_keys(cache_data->'googleAdsTables') as tables_keys,
  -- Network performance count
  jsonb_array_length(cache_data->'googleAdsTables'->'networkPerformance') as network_rows,
  -- Quality metrics count
  jsonb_array_length(cache_data->'googleAdsTables'->'qualityMetrics') as quality_rows,
  -- Device performance count
  jsonb_array_length(cache_data->'googleAdsTables'->'devicePerformance') as device_rows,
  -- Keyword performance count
  jsonb_array_length(cache_data->'googleAdsTables'->'keywordPerformance') as keyword_rows
FROM google_ads_current_month_cache
WHERE client_id IN (
  SELECT id FROM clients WHERE email = 'belmonte@hotel.com'
)
AND period_id = to_char(NOW(), 'YYYY-MM');

-- Expected: Should show complete data structure with all components


-- ============================================================================
-- 5. CHECK HISTORICAL GOOGLE ADS DATA (campaign_summaries)
-- ============================================================================
SELECT 
  id,
  client_id,
  platform,
  summary_type,
  summary_date,
  total_spend,
  total_impressions,
  total_clicks,
  total_conversions,
  -- Google Ads specific conversions
  click_to_call,
  email_contacts,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  last_updated
FROM campaign_summaries
WHERE client_id IN (
  SELECT id FROM clients WHERE email = 'belmonte@hotel.com'
)
AND platform = 'google'
ORDER BY summary_date DESC
LIMIT 50;

-- Expected: Should show historical Google Ads data (if any collected)


-- ============================================================================
-- 6. CHECK HISTORICAL DATA BY MONTH
-- ============================================================================
SELECT 
  to_char(summary_date, 'YYYY-MM') as month,
  summary_type,
  COUNT(*) as record_count,
  SUM(total_spend) as total_spend,
  SUM(total_impressions) as total_impressions,
  SUM(total_clicks) as total_clicks,
  SUM(total_conversions) as total_conversions,
  SUM(reservations) as total_reservations,
  SUM(reservation_value) as total_reservation_value,
  MAX(last_updated) as latest_update
FROM campaign_summaries
WHERE client_id IN (
  SELECT id FROM clients WHERE email = 'belmonte@hotel.com'
)
AND platform = 'google'
AND summary_date >= CURRENT_DATE - INTERVAL '14 months'
GROUP BY to_char(summary_date, 'YYYY-MM'), summary_type
ORDER BY month DESC, summary_type;

-- Expected: Should show monthly aggregations for last 14 months


-- ============================================================================
-- 7. CHECK DAILY KPI DATA (Should be EMPTY for Google Ads)
-- ============================================================================
SELECT 
  id,
  client_id,
  platform,
  date,
  data_source,
  spend,
  impressions,
  clicks,
  conversions,
  click_to_call,
  reservations,
  reservation_value,
  created_at
FROM daily_kpi_data
WHERE client_id IN (
  SELECT id FROM clients WHERE email = 'belmonte@hotel.com'
)
AND platform = 'google'
ORDER BY date DESC
LIMIT 20;

-- Expected: Should return 0 rows (Google Ads doesn't use this table)


-- ============================================================================
-- 8. CHECK ALL CACHE ENTRIES (Historical View)
-- ============================================================================
SELECT 
  period_id,
  last_updated,
  EXTRACT(EPOCH FROM (NOW() - last_updated))/3600 as hours_old,
  jsonb_array_length(cache_data->'campaigns') as campaigns,
  (cache_data->'stats'->>'totalSpend')::numeric as spend,
  (cache_data->'conversionMetrics'->>'reservations')::integer as reservations,
  (cache_data->'googleAdsTables') IS NOT NULL as has_tables
FROM google_ads_current_month_cache
WHERE client_id IN (
  SELECT id FROM clients WHERE email = 'belmonte@hotel.com'
)
ORDER BY period_id DESC;

-- Expected: Shows all historical cache entries for this client


-- ============================================================================
-- 9. COMPARE META VS GOOGLE ADS DATA (Same Period)
-- ============================================================================
WITH client_data AS (
  SELECT id as client_id FROM clients 
  WHERE email = 'belmonte@hotel.com'
)
SELECT 
  'Meta Ads' as platform,
  COUNT(*) as records,
  SUM(total_spend) as total_spend,
  SUM(total_conversions) as total_conversions,
  MIN(summary_date) as earliest_date,
  MAX(summary_date) as latest_date
FROM campaign_summaries, client_data
WHERE campaign_summaries.client_id = client_data.client_id
AND platform = 'meta'
AND summary_date >= CURRENT_DATE - INTERVAL '3 months'

UNION ALL

SELECT 
  'Google Ads' as platform,
  COUNT(*) as records,
  SUM(total_spend) as total_spend,
  SUM(total_conversions) as total_conversions,
  MIN(summary_date) as earliest_date,
  MAX(summary_date) as latest_date
FROM campaign_summaries, client_data
WHERE campaign_summaries.client_id = client_data.client_id
AND platform = 'google'
AND summary_date >= CURRENT_DATE - INTERVAL '3 months';

-- Expected: Compare data volume between Meta and Google Ads


-- ============================================================================
-- 10. CHECK GOOGLE ADS SYSTEM SETTINGS
-- ============================================================================
SELECT 
  key,
  CASE 
    WHEN key LIKE '%secret%' OR key LIKE '%token%' THEN '***REDACTED***'
    ELSE value
  END as value,
  updated_at
FROM system_settings
WHERE key LIKE 'google_ads_%'
ORDER BY key;

-- Expected: Shows Google Ads system configuration (tokens redacted)


-- ============================================================================
-- 11. FULL DATA AVAILABILITY SUMMARY
-- ============================================================================
WITH client_data AS (
  SELECT id as client_id FROM clients 
  WHERE email = 'belmonte@hotel.com'
)
SELECT 
  'Current Month Cache (google_ads_current_month_cache)' as data_source,
  COUNT(*) as record_count,
  MAX(last_updated) as last_updated,
  CASE WHEN COUNT(*) > 0 THEN '✅' ELSE '❌' END as status
FROM google_ads_current_month_cache, client_data
WHERE google_ads_current_month_cache.client_id = client_data.client_id
AND period_id = to_char(NOW(), 'YYYY-MM')

UNION ALL

SELECT 
  'Current Week Cache (google_ads_current_week_cache)' as data_source,
  COUNT(*) as record_count,
  MAX(last_updated) as last_updated,
  CASE WHEN COUNT(*) > 0 THEN '✅' ELSE '❌' END as status
FROM google_ads_current_week_cache, client_data
WHERE google_ads_current_week_cache.client_id = client_data.client_id
AND period_id = to_char(NOW(), 'IYYY-"W"IW')

UNION ALL

SELECT 
  'Historical Data (campaign_summaries)' as data_source,
  COUNT(*) as record_count,
  MAX(last_updated) as last_updated,
  CASE WHEN COUNT(*) > 0 THEN '✅' ELSE '❌' END as status
FROM campaign_summaries, client_data
WHERE campaign_summaries.client_id = client_data.client_id
AND platform = 'google'

UNION ALL

SELECT 
  'Daily KPI Data (daily_kpi_data)' as data_source,
  COUNT(*) as record_count,
  MAX(created_at) as last_updated,
  CASE WHEN COUNT(*) > 0 THEN '⚠️ Unexpected' ELSE '✅ Empty (correct)' END as status
FROM daily_kpi_data, client_data
WHERE daily_kpi_data.client_id = client_data.client_id
AND platform = 'google';

-- Expected: Summary of data availability across all sources


-- ============================================================================
-- 12. EXTRACT SAMPLE CAMPAIGN DATA (First 3 campaigns from cache)
-- ============================================================================
SELECT 
  period_id,
  jsonb_array_elements(cache_data->'campaigns')->>'campaignName' as campaign_name,
  jsonb_array_elements(cache_data->'campaigns')->>'campaignId' as campaign_id,
  (jsonb_array_elements(cache_data->'campaigns')->>'spend')::numeric as spend,
  (jsonb_array_elements(cache_data->'campaigns')->>'impressions')::integer as impressions,
  (jsonb_array_elements(cache_data->'campaigns')->>'clicks')::integer as clicks,
  jsonb_array_elements(cache_data->'campaigns')->>'status' as status
FROM google_ads_current_month_cache
WHERE client_id IN (
  SELECT id FROM clients WHERE email = 'belmonte@hotel.com'
)
AND period_id = to_char(NOW(), 'YYYY-MM')
LIMIT 3;

-- Expected: Sample of campaign names and metrics from cache


-- ============================================================================
-- 13. CHECK IF TABLES DATA IS IN CACHE
-- ============================================================================
SELECT 
  period_id,
  last_updated,
  -- Check each table component
  (cache_data->'googleAdsTables'->'networkPerformance') IS NOT NULL as has_network,
  (cache_data->'googleAdsTables'->'qualityMetrics') IS NOT NULL as has_quality,
  (cache_data->'googleAdsTables'->'devicePerformance') IS NOT NULL as has_device,
  (cache_data->'googleAdsTables'->'keywordPerformance') IS NOT NULL as has_keyword,
  -- Count rows in each table
  jsonb_array_length(cache_data->'googleAdsTables'->'networkPerformance') as network_count,
  jsonb_array_length(cache_data->'googleAdsTables'->'qualityMetrics') as quality_count,
  jsonb_array_length(cache_data->'googleAdsTables'->'devicePerformance') as device_count,
  jsonb_array_length(cache_data->'googleAdsTables'->'keywordPerformance') as keyword_count
FROM google_ads_current_month_cache
WHERE client_id IN (
  SELECT id FROM clients WHERE email = 'belmonte@hotel.com'
)
AND period_id = to_char(NOW(), 'YYYY-MM');

-- Expected: All should be TRUE with row counts > 0


-- ============================================================================
-- EXECUTION INSTRUCTIONS
-- ============================================================================
-- Run these queries in order to get a complete picture of Belmonte's Google Ads data
-- 
-- Quick Health Check (Run these first):
-- - Query #1: Get client_id
-- - Query #2: Check current month cache
-- - Query #11: Data availability summary
-- 
-- Detailed Investigation (If issues found):
-- - Query #4: Full cache structure
-- - Query #5: Historical data
-- - Query #13: Tables data verification
-- 
-- Performance Check:
-- - Query #2: Look at hours_since_update (should be < 6)
-- - Query #13: Verify all tables have data
-- ============================================================================

