-- ============================================================================
-- BELMONTE GOOGLE ADS - CORRECTED QUERIES
-- ============================================================================
-- User: belmonte@hotel.com
-- Auth ID: 0f2ff3cb-896c-4688-841a-1a9851ec1746
-- ============================================================================

-- 1️⃣ GET CLIENT ID (CORRECTED)
SELECT 
  id as client_id,
  name,
  email,
  google_ads_enabled,
  google_ads_customer_id,
  google_ads_refresh_token IS NOT NULL as has_refresh_token,
  created_at
FROM clients
WHERE email = 'belmonte@hotel.com';
-- Save the 'id' (client_id) for next queries


-- 2️⃣ CHECK CURRENT MONTH CACHE
-- Replace YOUR_CLIENT_ID with the id from query #1
SELECT 
  period_id,
  last_updated,
  ROUND(EXTRACT(EPOCH FROM (NOW() - last_updated))/3600, 2) as hours_old,
  jsonb_array_length(cache_data->'campaigns') as campaigns,
  ROUND((cache_data->'stats'->>'totalSpend')::numeric, 2) as spend,
  (cache_data->'conversionMetrics'->>'reservations')::integer as reservations,
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
WHERE client_id = 'YOUR_CLIENT_ID'  -- Replace with ID from query #1
AND period_id = to_char(NOW(), 'YYYY-MM');


-- 3️⃣ QUICK HEALTH CHECK
SELECT 
  CASE 
    WHEN COUNT(*) > 0 AND MAX(last_updated) > NOW() - INTERVAL '6 hours' THEN '✅ HEALTHY - Cache is fresh'
    WHEN COUNT(*) > 0 AND MAX(last_updated) > NOW() - INTERVAL '24 hours' THEN '⚠️ STALE - Cache needs refresh'
    WHEN COUNT(*) > 0 THEN '❌ VERY OLD - Cron may not be running'
    ELSE '❌ NO DATA - Cache empty'
  END as cache_status,
  COUNT(*) as cache_entries,
  MAX(last_updated) as last_refresh,
  ROUND(EXTRACT(EPOCH FROM (NOW() - MAX(last_updated)))/3600, 2) as hours_since_refresh,
  jsonb_array_length(MAX(cache_data)->'campaigns') as campaign_count,
  ROUND((MAX(cache_data)->'stats'->>'totalSpend')::numeric, 2) as total_spend,
  CASE 
    WHEN (MAX(cache_data)->'googleAdsTables') IS NOT NULL THEN '✅ Yes'
    ELSE '❌ No'
  END as has_tables_data
FROM google_ads_current_month_cache
WHERE client_id = 'YOUR_CLIENT_ID'  -- Replace with ID from query #1
AND period_id = to_char(NOW(), 'YYYY-MM');


-- 4️⃣ CHECK HISTORICAL DATA (Last 6 months)
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
WHERE client_id = 'YOUR_CLIENT_ID'  -- Replace with ID from query #1
AND platform = 'google'
AND summary_date >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY to_char(summary_date, 'YYYY-MM'), summary_type
ORDER BY month DESC, summary_type;


-- 5️⃣ CHECK ALL AVAILABLE DATA SOURCES
SELECT 
  'Current Month Cache' as data_source,
  to_char(MAX(last_updated), 'YYYY-MM-DD HH24:MI:SS') as last_update,
  COUNT(*) as records,
  CASE WHEN COUNT(*) > 0 THEN '✅' ELSE '❌' END as available
FROM google_ads_current_month_cache
WHERE client_id = 'YOUR_CLIENT_ID'
AND period_id = to_char(NOW(), 'YYYY-MM')

UNION ALL

SELECT 
  'Current Week Cache' as data_source,
  to_char(MAX(last_updated), 'YYYY-MM-DD HH24:MI:SS') as last_update,
  COUNT(*) as records,
  CASE WHEN COUNT(*) > 0 THEN '✅' ELSE '❌' END as available
FROM google_ads_current_week_cache
WHERE client_id = 'YOUR_CLIENT_ID'
AND period_id = to_char(NOW(), 'IYYY-"W"IW')

UNION ALL

SELECT 
  'Historical Data (campaign_summaries)' as data_source,
  to_char(MAX(last_updated), 'YYYY-MM-DD HH24:MI:SS') as last_update,
  COUNT(*) as records,
  CASE WHEN COUNT(*) > 0 THEN '✅' ELSE '❌' END as available
FROM campaign_summaries
WHERE client_id = 'YOUR_CLIENT_ID'
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
WHERE client_id = 'YOUR_CLIENT_ID'
AND platform = 'google';


-- ============================================================================
-- ONE-STEP QUERY: Get everything at once
-- ============================================================================
WITH belmonte_client AS (
  SELECT id, name, email, google_ads_customer_id, google_ads_enabled
  FROM clients
  WHERE email = 'belmonte@hotel.com'
),
current_cache AS (
  SELECT 
    'Current Month Cache' as source,
    period_id,
    last_updated,
    ROUND(EXTRACT(EPOCH FROM (NOW() - last_updated))/3600, 2) as hours_old,
    jsonb_array_length(cache_data->'campaigns') as campaigns,
    ROUND((cache_data->'stats'->>'totalSpend')::numeric, 2) as spend,
    CASE 
      WHEN EXTRACT(EPOCH FROM (NOW() - last_updated))/3600 < 6 THEN '✅ Fresh'
      WHEN EXTRACT(EPOCH FROM (NOW() - last_updated))/3600 < 24 THEN '⚠️ Aging'
      ELSE '❌ Stale'
    END as status
  FROM google_ads_current_month_cache, belmonte_client
  WHERE client_id = belmonte_client.id
  AND period_id = to_char(NOW(), 'YYYY-MM')
),
historical_summary AS (
  SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT to_char(summary_date, 'YYYY-MM')) as months_with_data,
    ROUND(SUM(total_spend), 2) as total_historical_spend,
    MAX(summary_date) as latest_date
  FROM campaign_summaries, belmonte_client
  WHERE client_id = belmonte_client.id
  AND platform = 'google'
)
SELECT 
  -- Client Info
  bc.id as client_id,
  bc.name,
  bc.email,
  bc.google_ads_customer_id,
  bc.google_ads_enabled,
  
  -- Current Cache
  cc.period_id as current_period,
  cc.last_updated as cache_last_updated,
  cc.hours_old as cache_age_hours,
  cc.campaigns as current_campaigns,
  cc.spend as current_spend,
  cc.status as cache_status,
  
  -- Historical Data
  hs.total_records as historical_records,
  hs.months_with_data,
  hs.total_historical_spend,
  hs.latest_date as latest_historical_date
FROM belmonte_client bc
LEFT JOIN current_cache cc ON true
LEFT JOIN historical_summary hs ON true;


-- ============================================================================
-- EXPECTED RESULTS FOR HEALTHY SYSTEM:
-- ============================================================================
-- Query #3 should show:
--   cache_status: '✅ HEALTHY - Cache is fresh'
--   hours_since_refresh: < 6
--   campaign_count: > 0 (e.g., 25)
--   total_spend: > 0 (e.g., 1723.33)
--   has_tables_data: '✅ Yes'
--
-- Query #5 should show:
--   Current Month Cache: ✅ with recent timestamp
--   Current Week Cache: ✅ with recent timestamp
--   Historical Data: ✅ with records
--   Daily KPI Data: '✅ Empty (correct)'
-- ============================================================================

