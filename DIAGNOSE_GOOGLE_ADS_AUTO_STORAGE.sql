-- Diagnose why Google Ads data is not being stored automatically for Havet
-- Check client configuration, cache status, and cron job eligibility

-- ============================================================================
-- 1. CHECK HAVET CLIENT CONFIGURATION
-- ============================================================================
SELECT 
  '1️⃣ HAVET CLIENT CONFIG' as check_type,
  id,
  name,
  email,
  google_ads_customer_id,
  CASE WHEN google_ads_refresh_token IS NOT NULL THEN '✅ HAS TOKEN' ELSE '❌ NO TOKEN' END as token_status,
  api_status,
  CASE 
    WHEN api_status = 'valid' THEN '✅ ELIGIBLE for auto-refresh'
    ELSE '❌ NOT ELIGIBLE - api_status must be "valid"'
  END as cron_eligibility
FROM clients
WHERE name ILIKE '%havet%'
LIMIT 1;

-- ============================================================================
-- 2. CHECK CURRENT MONTH CACHE STATUS
-- ============================================================================
SELECT 
  '2️⃣ CURRENT MONTH CACHE STATUS' as check_type,
  gmc.period_id,
  gmc.client_id,
  (gmc.cache_data->'stats'->>'totalSpend')::numeric as cached_spend,
  (gmc.cache_data->'stats'->>'totalImpressions')::numeric as cached_impressions,
  TO_CHAR(gmc.last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated,
  EXTRACT(EPOCH FROM (NOW() - gmc.last_updated)) / 3600 as hours_old,
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - gmc.last_updated)) / 3600 < 3 THEN '✅ FRESH (< 3 hours)'
    WHEN EXTRACT(EPOCH FROM (NOW() - gmc.last_updated)) / 3600 < 6 THEN '⚠️ STALE (3-6 hours)'
    ELSE '❌ VERY STALE (> 6 hours)'
  END as cache_status
FROM google_ads_current_month_cache gmc
WHERE gmc.client_id = (SELECT id FROM clients WHERE name ILIKE '%havet%' LIMIT 1)
  AND gmc.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
ORDER BY gmc.last_updated DESC
LIMIT 1;

-- ============================================================================
-- 3. CHECK IF CACHE EXISTS FOR CURRENT MONTH
-- ============================================================================
SELECT 
  '3️⃣ CACHE EXISTS?' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ YES - Cache entry exists'
    ELSE '❌ NO - No cache entry found'
  END as cache_exists,
  COUNT(*) as cache_count,
  MAX(TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS')) as most_recent_update
FROM google_ads_current_month_cache
WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%havet%' LIMIT 1)
  AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

-- ============================================================================
-- 4. CHECK ALL RECENT CACHE UPDATES (LAST 7 DAYS)
-- ============================================================================
SELECT 
  '4️⃣ RECENT CACHE UPDATES' as check_type,
  period_id,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated,
  (cache_data->'stats'->>'totalSpend')::numeric as spend,
  EXTRACT(EPOCH FROM (NOW() - last_updated)) / 3600 as hours_ago
FROM google_ads_current_month_cache
WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%havet%' LIMIT 1)
  AND last_updated >= NOW() - INTERVAL '7 days'
ORDER BY last_updated DESC
LIMIT 10;

-- ============================================================================
-- 5. COMPARE WITH META (WORKING) - Check if Meta cache is being updated
-- ============================================================================
SELECT 
  '5️⃣ META CACHE (FOR COMPARISON)' as check_type,
  'meta' as platform,
  period_id,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated,
  (cache_data->'stats'->>'totalSpend')::numeric as spend,
  EXTRACT(EPOCH FROM (NOW() - last_updated)) / 3600 as hours_ago
FROM current_month_cache
WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%havet%' LIMIT 1)
  AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
ORDER BY last_updated DESC
LIMIT 1;

-- ============================================================================
-- 6. CHECK SYSTEM SETTINGS FOR MANAGER TOKEN
-- ============================================================================
SELECT 
  '6️⃣ MANAGER TOKEN STATUS' as check_type,
  CASE 
    WHEN value IS NOT NULL THEN '✅ Manager token exists'
    ELSE '❌ No manager token'
  END as manager_token_status,
  CASE 
    WHEN value IS NOT NULL THEN 'Clients can use manager token'
    ELSE 'Clients need individual tokens'
  END as note
FROM system_settings
WHERE key = 'google_ads_manager_refresh_token'
LIMIT 1;

-- ============================================================================
-- 7. SUMMARY - WHY AUTO-STORAGE MIGHT NOT BE WORKING
-- ============================================================================
SELECT 
  '7️⃣ DIAGNOSIS SUMMARY' as check_type,
  CASE 
    WHEN (SELECT api_status FROM clients WHERE name ILIKE '%havet%' LIMIT 1) != 'valid' 
      THEN '❌ PROBLEM: api_status is not "valid" - cron job will skip this client'
    WHEN (SELECT google_ads_customer_id FROM clients WHERE name ILIKE '%havet%' LIMIT 1) IS NULL
      THEN '❌ PROBLEM: google_ads_customer_id is missing'
    WHEN (SELECT google_ads_refresh_token FROM clients WHERE name ILIKE '%havet%' LIMIT 1) IS NULL
      AND (SELECT value FROM system_settings WHERE key = 'google_ads_manager_refresh_token') IS NULL
      THEN '❌ PROBLEM: No refresh token (client or manager)'
    WHEN (SELECT COUNT(*) FROM google_ads_current_month_cache 
          WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%havet%' LIMIT 1)
            AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')) = 0
      THEN '⚠️ WARNING: No cache entry exists for current month'
    WHEN (SELECT MAX(last_updated) FROM google_ads_current_month_cache 
          WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%havet%' LIMIT 1)
            AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')) < NOW() - INTERVAL '6 hours'
      THEN '⚠️ WARNING: Cache is stale (> 6 hours old) - cron job may not be running'
    ELSE '✅ Configuration looks correct - check cron job logs'
  END as diagnosis
FROM clients
WHERE name ILIKE '%havet%'
LIMIT 1;

