-- 🔍 BELMONTE DATA INVESTIGATION
-- Finding out what data actually exists for Belmonte
-- Client ID: 0f2ff3cb-896c-4688-841a-1a9851ec1746

-- ============================================
-- QUERY 1: Check ALL campaign_summaries data
-- ============================================
-- Let's see what months ACTUALLY have data

SELECT 
  summary_date,
  summary_type,
  platform,
  total_spend,
  total_conversions,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  created_at
FROM campaign_summaries
WHERE client_id = '0f2ff3cb-896c-4688-841a-1a9851ec1746'
ORDER BY summary_date DESC
LIMIT 20;

-- This shows ALL available historical data for Belmonte


-- ============================================
-- QUERY 2: Check ANY daily_kpi_data
-- ============================================
-- Maybe there's data for other months?

SELECT 
  DATE(date) as collection_date,
  COUNT(*) as records,
  SUM(total_spend) as daily_spend,
  SUM(booking_step_1) as step_1_sum,
  SUM(reservations) as reservations_sum,
  MAX(created_at) as last_collection
FROM daily_kpi_data
WHERE client_id = '0f2ff3cb-896c-4688-841a-1a9851ec1746'
  AND data_source = 'meta_api'
GROUP BY DATE(date)
ORDER BY collection_date DESC
LIMIT 20;

-- Shows what days we DO have data for


-- ============================================
-- QUERY 3: Check the "campaigns" table
-- ============================================
-- Maybe data is in the old campaigns table?

SELECT 
  campaign_name,
  spend,
  conversions,
  date_range_start,
  date_range_end,
  created_at
FROM campaigns
WHERE client_id = '0f2ff3cb-896c-4688-841a-1a9851ec1746'
ORDER BY date_range_start DESC
LIMIT 20;

-- This was mentioned in the audit as the "old" data source


-- ============================================
-- QUERY 4: What's the date range of ALL data?
-- ============================================

SELECT 
  'campaign_summaries' as table_name,
  MIN(summary_date) as earliest_date,
  MAX(summary_date) as latest_date,
  COUNT(*) as total_records,
  COUNT(DISTINCT summary_date) as unique_periods
FROM campaign_summaries
WHERE client_id = '0f2ff3cb-896c-4688-841a-1a9851ec1746'

UNION ALL

SELECT 
  'daily_kpi_data' as table_name,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  COUNT(*) as total_records,
  COUNT(DISTINCT date) as unique_periods
FROM daily_kpi_data
WHERE client_id = '0f2ff3cb-896c-4688-841a-1a9851ec1746'

UNION ALL

SELECT 
  'campaigns' as table_name,
  MIN(date_range_start) as earliest_date,
  MAX(date_range_start) as latest_date,
  COUNT(*) as total_records,
  COUNT(DISTINCT date_range_start) as unique_periods
FROM campaigns
WHERE client_id = '0f2ff3cb-896c-4688-841a-1a9851ec1746';

-- Shows what date ranges exist in each table


-- ============================================
-- QUERY 5: Check current_month_cache
-- ============================================
-- Maybe the data is in the smart cache tables?

SELECT 
  period_id,
  last_refreshed,
  cache_data->'stats'->>'totalSpend' as cached_spend,
  cache_data->'conversionMetrics'->>'booking_step_1' as cached_step_1,
  cache_data->'conversionMetrics'->>'booking_step_2' as cached_step_2,
  cache_data->'conversionMetrics'->>'booking_step_3' as cached_step_3,
  cache_data->'conversionMetrics'->>'reservations' as cached_reservations,
  NOW() - last_refreshed as cache_age
FROM current_month_cache
WHERE client_id = '0f2ff3cb-896c-4688-841a-1a9851ec1746'
ORDER BY last_refreshed DESC;

-- Shows what's currently cached for current month


-- ============================================
-- QUERY 6: Debug - Check if client data is correct
-- ============================================

SELECT 
  id,
  name,
  email,
  ad_account_id,
  meta_access_token IS NOT NULL as has_meta_token,
  reporting_frequency,
  created_at
FROM clients
WHERE id = '0f2ff3cb-896c-4688-841a-1a9851ec1746';

-- Verify client exists and has proper Meta configuration


-- ============================================
-- INTERPRETATION GUIDE
-- ============================================

/*

SCENARIO A: No data in ANY table
  → Daily collection never ran
  → Monthly summaries never created
  → System completely broken for this client

SCENARIO B: Data exists but for different dates
  → November 2024 data doesn't exist
  → YoY comparison using wrong months
  → Need to check what months ARE available

SCENARIO C: Data in campaigns table but not summaries
  → Old system worked, new system didn't migrate
  → Need to backfill campaign_summaries from campaigns

SCENARIO D: Data in cache but not database
  → Smart cache working but not persisting
  → Storage layer broken

*/




