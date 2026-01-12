-- Check why Google Ads cache is not updating automatically for Havet
-- Client is valid, so checking cache status and update history

-- ============================================================================
-- 1. CURRENT MONTH CACHE STATUS
-- ============================================================================
SELECT 
  '1️⃣ CURRENT MONTH CACHE' as check_type,
  period_id,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated,
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at,
  EXTRACT(EPOCH FROM (NOW() - last_updated)) / 3600 as hours_since_update,
  (cache_data->'stats'->>'totalSpend')::numeric as spend,
  (cache_data->'stats'->>'totalImpressions')::numeric as impressions,
  jsonb_array_length(COALESCE(cache_data->'campaigns', '[]'::jsonb)) as campaign_count,
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - last_updated)) / 3600 < 3 THEN '✅ FRESH'
    WHEN EXTRACT(EPOCH FROM (NOW() - last_updated)) / 3600 < 6 THEN '⚠️ STALE'
    ELSE '❌ VERY STALE'
  END as status
FROM google_ads_current_month_cache
WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
  AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
ORDER BY last_updated DESC
LIMIT 1;

-- ============================================================================
-- 2. ALL CACHE ENTRIES FOR HAVET (LAST 30 DAYS)
-- ============================================================================
SELECT 
  '2️⃣ ALL RECENT CACHE ENTRIES' as check_type,
  period_id,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated,
  EXTRACT(EPOCH FROM (NOW() - last_updated)) / 3600 as hours_ago,
  (cache_data->'stats'->>'totalSpend')::numeric as spend,
  CASE 
    WHEN (cache_data->'stats'->>'totalSpend')::numeric = 0 THEN '❌ ZEROS'
    WHEN (cache_data->'stats'->>'totalSpend')::numeric > 0 THEN '✅ HAS DATA'
    ELSE '⚠️ NULL'
  END as data_status
FROM google_ads_current_month_cache
WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
  AND last_updated >= NOW() - INTERVAL '30 days'
ORDER BY last_updated DESC;

-- ============================================================================
-- 3. COMPARE WITH META CACHE (TO SEE IF IT'S UPDATING)
-- ============================================================================
SELECT 
  '3️⃣ META CACHE (COMPARISON)' as check_type,
  'meta' as platform,
  period_id,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated,
  EXTRACT(EPOCH FROM (NOW() - last_updated)) / 3600 as hours_ago,
  (cache_data->'stats'->>'totalSpend')::numeric as spend
FROM current_month_cache
WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
  AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
ORDER BY last_updated DESC
LIMIT 1;

-- ============================================================================
-- 4. CHECK IF CACHE EXISTS AT ALL
-- ============================================================================
SELECT 
  '4️⃣ CACHE EXISTS?' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ YES'
    ELSE '❌ NO - No cache entry found'
  END as cache_exists,
  COUNT(*) as total_entries,
  MAX(TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS')) as most_recent_update,
  MIN(TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS')) as oldest_update
FROM google_ads_current_month_cache
WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1';

-- ============================================================================
-- 5. CHECK REFRESH TOKEN STATUS
-- ============================================================================
SELECT 
  '5️⃣ REFRESH TOKEN CHECK' as check_type,
  CASE 
    WHEN google_ads_refresh_token IS NOT NULL THEN '✅ Client has token'
    ELSE '❌ Client has no token'
  END as client_token,
  CASE 
    WHEN (SELECT value FROM system_settings WHERE key = 'google_ads_manager_refresh_token') IS NOT NULL 
      THEN '✅ Manager token exists'
    ELSE '❌ No manager token'
  END as manager_token,
  CASE 
    WHEN google_ads_refresh_token IS NOT NULL 
      OR (SELECT value FROM system_settings WHERE key = 'google_ads_manager_refresh_token') IS NOT NULL
      THEN '✅ Token available (client or manager)'
    ELSE '❌ No token available'
  END as token_status
FROM clients
WHERE id = '93d46876-addc-4b99-b1e1-437428dd54f1';

-- ============================================================================
-- 6. DIAGNOSIS - WHY AUTO-UPDATE MIGHT NOT BE WORKING
-- ============================================================================
SELECT 
  '6️⃣ DIAGNOSIS' as check_type,
  CASE 
    -- Check if cache exists
    WHEN (SELECT COUNT(*) FROM google_ads_current_month_cache 
          WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
            AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')) = 0
      THEN '❌ NO CACHE ENTRY - Cron job may not be creating cache entries'
    
    -- Check if cache is stale
    WHEN (SELECT MAX(last_updated) FROM google_ads_current_month_cache 
          WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
            AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')) < NOW() - INTERVAL '6 hours'
      THEN '⚠️ CACHE IS STALE (>6 hours) - Cron job may not be running or failing'
    
    -- Check if cache has zeros
    WHEN (SELECT (cache_data->'stats'->>'totalSpend')::numeric FROM google_ads_current_month_cache 
          WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
            AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
          ORDER BY last_updated DESC LIMIT 1) = 0
      THEN '⚠️ CACHE HAS ZEROS - Fetching may be failing silently'
    
    -- Check token
    WHEN (SELECT google_ads_refresh_token FROM clients WHERE id = '93d46876-addc-4b99-b1e1-437428dd54f1') IS NULL
      AND (SELECT value FROM system_settings WHERE key = 'google_ads_manager_refresh_token') IS NULL
      THEN '❌ NO REFRESH TOKEN - Cannot fetch data'
    
    ELSE '✅ Configuration looks correct - Check cron job logs for errors'
  END as diagnosis,
  (SELECT MAX(TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS')) FROM google_ads_current_month_cache 
   WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
     AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')) as last_cache_update,
  (SELECT (cache_data->'stats'->>'totalSpend')::numeric FROM google_ads_current_month_cache 
   WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
     AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
   ORDER BY last_updated DESC LIMIT 1) as cached_spend;

