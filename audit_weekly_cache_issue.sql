-- 🔍 WEEKLY CACHE AUDIT - Understanding Why 0% Fresh
-- Date: November 13, 2025
-- Issue: Weekly cache showing 0% fresh entries, but monthly cache has 20% fresh

-- ============================================================================
-- STEP 1: Check current time and cache threshold
-- ============================================================================

SELECT 
  '⏰ CURRENT SYSTEM TIME & CACHE THRESHOLD' as section;

SELECT 
  NOW() as current_time,
  NOW() - INTERVAL '3 hours' as cache_freshness_cutoff,
  '3 hours' as cache_threshold,
  'Entries updated AFTER cutoff are FRESH ✅' as note;

-- ============================================================================
-- STEP 2: Meta Weekly Cache Analysis
-- ============================================================================

SELECT 
  '📊 META WEEKLY CACHE STATUS' as section;

-- Summary statistics
SELECT 
  COUNT(*) as total_entries,
  COUNT(CASE WHEN last_updated > NOW() - INTERVAL '3 hours' THEN 1 END) as fresh_entries,
  COUNT(CASE WHEN last_updated <= NOW() - INTERVAL '3 hours' THEN 1 END) as stale_entries,
  ROUND(COUNT(CASE WHEN last_updated > NOW() - INTERVAL '3 hours' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as fresh_percentage,
  MAX(last_updated) as newest_entry,
  MIN(last_updated) as oldest_entry,
  EXTRACT(EPOCH FROM (NOW() - MAX(last_updated))) / 3600 as hours_since_newest_update
FROM current_week_cache;

-- Detailed breakdown by client
SELECT 
  c.name as client_name,
  cwc.period_id,
  cwc.last_updated,
  EXTRACT(EPOCH FROM (NOW() - cwc.last_updated)) / 3600 as hours_ago,
  CASE 
    WHEN cwc.last_updated > NOW() - INTERVAL '3 hours' THEN '✅ FRESH'
    ELSE '❌ STALE'
  END as status,
  -- Check if period_id is current week
  CASE 
    WHEN cwc.period_id = TO_CHAR(DATE_TRUNC('week', NOW()), 'IYYY-"W"IW') THEN '✅ Current Week'
    ELSE '⚠️ Old Week: ' || cwc.period_id
  END as period_check
FROM current_week_cache cwc
LEFT JOIN clients c ON cwc.client_id = c.id
ORDER BY cwc.last_updated DESC;

-- ============================================================================
-- STEP 3: Check Belmonte Specifically
-- ============================================================================

SELECT 
  '🏨 BELMONTE WEEKLY CACHE DETAILS' as section;

SELECT 
  c.name,
  cwc.period_id,
  cwc.last_updated,
  EXTRACT(EPOCH FROM (NOW() - cwc.last_updated)) / 3600 as hours_ago,
  EXTRACT(EPOCH FROM (NOW() - cwc.last_updated)) / 60 as minutes_ago,
  NOW() - INTERVAL '3 hours' as freshness_cutoff,
  CASE 
    WHEN cwc.last_updated > NOW() - INTERVAL '3 hours' THEN '✅ FRESH (< 3 hours)'
    WHEN cwc.last_updated > NOW() - INTERVAL '24 hours' THEN '⚠️ STALE (3-24 hours)'
    ELSE '❌ VERY STALE (> 24 hours)'
  END as cache_status,
  CASE 
    WHEN cwc.period_id = TO_CHAR(DATE_TRUNC('week', NOW()), 'IYYY-"W"IW') THEN '✅ Current Week'
    ELSE '⚠️ Wrong Period: ' || cwc.period_id || ' (should be ' || TO_CHAR(DATE_TRUNC('week', NOW()), 'IYYY-"W"IW') || ')'
  END as period_validation,
  -- Check if cache_data exists
  CASE 
    WHEN cwc.cache_data IS NOT NULL THEN '✅ Has data'
    ELSE '❌ No data'
  END as data_check
FROM clients c
LEFT JOIN current_week_cache cwc ON c.id = cwc.client_id
WHERE c.name ILIKE '%belmonte%';

-- ============================================================================
-- STEP 4: Compare with Monthly Cache (working better)
-- ============================================================================

SELECT 
  '📊 META MONTHLY CACHE STATUS (for comparison)' as section;

-- Summary statistics
SELECT 
  COUNT(*) as total_entries,
  COUNT(CASE WHEN last_updated > NOW() - INTERVAL '3 hours' THEN 1 END) as fresh_entries,
  COUNT(CASE WHEN last_updated <= NOW() - INTERVAL '3 hours' THEN 1 END) as stale_entries,
  ROUND(COUNT(CASE WHEN last_updated > NOW() - INTERVAL '3 hours' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as fresh_percentage,
  MAX(last_updated) as newest_entry,
  MIN(last_updated) as oldest_entry
FROM current_month_cache;

-- Belmonte monthly cache
SELECT 
  c.name,
  cmc.period_id,
  cmc.last_updated,
  EXTRACT(EPOCH FROM (NOW() - cmc.last_updated)) / 3600 as hours_ago,
  CASE 
    WHEN cmc.last_updated > NOW() - INTERVAL '3 hours' THEN '✅ FRESH'
    ELSE '❌ STALE'
  END as status
FROM clients c
LEFT JOIN current_month_cache cmc ON c.id = cmc.client_id
WHERE c.name ILIKE '%belmonte%';

-- ============================================================================
-- STEP 5: Check Current Week Calculation
-- ============================================================================

SELECT 
  '📅 CURRENT WEEK CALCULATION CHECK' as section;

SELECT 
  NOW() as current_timestamp,
  DATE_TRUNC('week', NOW()) as week_start_monday,
  DATE_TRUNC('week', NOW()) + INTERVAL '6 days' as week_end_sunday,
  TO_CHAR(DATE_TRUNC('week', NOW()), 'IYYY-"W"IW') as current_week_period_id,
  'This should match period_id in cache for current week' as note;

-- Check if any cache entries have this period_id
SELECT 
  'Current week (' || TO_CHAR(DATE_TRUNC('week', NOW()), 'IYYY-"W"IW') || ') entries:' as info,
  COUNT(*) as count_with_current_week_id,
  STRING_AGG(c.name, ', ') as clients
FROM current_week_cache cwc
LEFT JOIN clients c ON cwc.client_id = c.id
WHERE cwc.period_id = TO_CHAR(DATE_TRUNC('week', NOW()), 'IYYY-"W"IW');

-- ============================================================================
-- STEP 6: Check Background Refresh System
-- ============================================================================

SELECT 
  '🔄 BACKGROUND REFRESH INVESTIGATION' as section;

-- Check if any weekly cache was updated in the last hour (indicating active refresh)
SELECT 
  'Recent updates (last hour):' as info,
  COUNT(*) as updates_last_hour,
  STRING_AGG(c.name, ', ') as clients_updated
FROM current_week_cache cwc
LEFT JOIN clients c ON cwc.client_id = c.id
WHERE cwc.last_updated > NOW() - INTERVAL '1 hour';

-- Check if any weekly cache was updated today
SELECT 
  'Updates today:' as info,
  COUNT(*) as updates_today,
  STRING_AGG(c.name, ', ') as clients_updated
FROM current_week_cache cwc
LEFT JOIN clients c ON cwc.client_id = c.id
WHERE cwc.last_updated > CURRENT_DATE;

-- ============================================================================
-- STEP 7: Check Token Status (might be blocking refreshes)
-- ============================================================================

SELECT 
  '🔑 CLIENT TOKEN STATUS' as section;

-- Belmonte's token status
SELECT 
  name,
  ad_account_id,
  CASE 
    WHEN system_user_token IS NOT NULL THEN '✅ Has system token'
    WHEN meta_access_token IS NOT NULL THEN '⏰ Has access token'
    ELSE '❌ No token'
  END as token_status,
  token_health_status,
  api_status,
  last_token_validation
FROM clients
WHERE name ILIKE '%belmonte%';

-- All clients with ad accounts
SELECT 
  COUNT(*) as total_clients,
  COUNT(CASE WHEN system_user_token IS NOT NULL THEN 1 END) as has_system_token,
  COUNT(CASE WHEN token_health_status = 'valid' THEN 1 END) as has_valid_token,
  COUNT(CASE WHEN api_status = 'valid' THEN 1 END) as api_working
FROM clients
WHERE ad_account_id IS NOT NULL;

-- ============================================================================
-- STEP 8: Check Google Ads Weekly Cache (for comparison)
-- ============================================================================

SELECT 
  '📊 GOOGLE ADS WEEKLY CACHE STATUS' as section;

SELECT 
  COUNT(*) as total_entries,
  COUNT(CASE WHEN last_updated > NOW() - INTERVAL '3 hours' THEN 1 END) as fresh_entries,
  COUNT(CASE WHEN last_updated <= NOW() - INTERVAL '3 hours' THEN 1 END) as stale_entries,
  ROUND(COUNT(CASE WHEN last_updated > NOW() - INTERVAL '3 hours' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as fresh_percentage
FROM google_ads_current_week_cache;

-- ============================================================================
-- SUMMARY & DIAGNOSIS
-- ============================================================================

SELECT 
  '🎯 KEY FINDINGS SUMMARY' as section;

-- Side-by-side comparison
SELECT 
  'Meta Monthly' as cache_type,
  COUNT(*) as entries,
  COUNT(CASE WHEN last_updated > NOW() - INTERVAL '3 hours' THEN 1 END) as fresh,
  ROUND(COUNT(CASE WHEN last_updated > NOW() - INTERVAL '3 hours' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as fresh_pct,
  EXTRACT(EPOCH FROM (NOW() - MAX(last_updated))) / 3600 as hours_since_last_update
FROM current_month_cache

UNION ALL

SELECT 
  'Meta Weekly' as cache_type,
  COUNT(*) as entries,
  COUNT(CASE WHEN last_updated > NOW() - INTERVAL '3 hours' THEN 1 END) as fresh,
  ROUND(COUNT(CASE WHEN last_updated > NOW() - INTERVAL '3 hours' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as fresh_pct,
  EXTRACT(EPOCH FROM (NOW() - MAX(last_updated))) / 3600 as hours_since_last_update
FROM current_week_cache

UNION ALL

SELECT 
  'Google Ads Monthly' as cache_type,
  COUNT(*) as entries,
  COUNT(CASE WHEN last_updated > NOW() - INTERVAL '3 hours' THEN 1 END) as fresh,
  ROUND(COUNT(CASE WHEN last_updated > NOW() - INTERVAL '3 hours' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as fresh_pct,
  EXTRACT(EPOCH FROM (NOW() - MAX(last_updated))) / 3600 as hours_since_last_update
FROM google_ads_current_month_cache

UNION ALL

SELECT 
  'Google Ads Weekly' as cache_type,
  COUNT(*) as entries,
  COUNT(CASE WHEN last_updated > NOW() - INTERVAL '3 hours' THEN 1 END) as fresh,
  ROUND(COUNT(CASE WHEN last_updated > NOW() - INTERVAL '3 hours' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as fresh_pct,
  EXTRACT(EPOCH FROM (NOW() - MAX(last_updated))) / 3600 as hours_since_last_update
FROM google_ads_current_week_cache
ORDER BY cache_type;

-- ============================================================================
-- 🔍 DIAGNOSTIC QUESTIONS TO ANSWER
-- ============================================================================

/*
QUESTIONS THIS AUDIT WILL ANSWER:

1. ❓ Are weekly cache entries using correct period_id?
   → Check if period_id matches current week calculation

2. ❓ When was the last weekly cache update?
   → If > 3 hours ago, background refresh may not be working

3. ❓ Is Belmonte's weekly cache present and fresh?
   → Should be the most reliable client

4. ❓ Are there any pattern differences between monthly (20% fresh) vs weekly (0% fresh)?
   → Might indicate issue specific to weekly refresh logic

5. ❓ Are tokens valid and API calls working?
   → Invalid tokens would prevent cache refresh

6. ❓ Is the current week calculation correct?
   → Wrong period_id would cause cache misses

EXPECTED FINDINGS:

✅ IF WORKING PROPERLY:
   - Some weekly entries should be < 3 hours old
   - Belmonte should have fresh weekly cache
   - period_id should match current week

❌ IF BROKEN:
   - All weekly entries > 3 hours old
   - Background refresh not triggering
   - Possible issues: wrong period_id, disabled refresh, token issues
*/

