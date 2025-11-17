-- ============================================================================
-- Smart Cache Status Diagnostic Report
-- Run this to check the health of all cache tables
-- ============================================================================

-- Display header
SELECT '╔════════════════════════════════════════════════════════════════════╗' as " ";
SELECT '║              SMART CACHE STATUS DIAGNOSTIC REPORT                  ║' as " ";
SELECT '╚════════════════════════════════════════════════════════════════════╝' as " ";
SELECT '' as " ";

-- ============================================================================
-- 1. OVERALL CACHE SUMMARY
-- ============================================================================
SELECT '═══ 1. OVERALL CACHE SUMMARY ═══' as section;
SELECT '' as " ";

WITH cache_summary AS (
  SELECT 
    'Meta Monthly' as cache_type,
    COUNT(*) as total_entries,
    COUNT(CASE WHEN AGE(NOW(), last_updated) < INTERVAL '3 hours' THEN 1 END) as fresh_count,
    COUNT(CASE WHEN AGE(NOW(), last_updated) >= INTERVAL '3 hours' THEN 1 END) as stale_count,
    MAX(last_updated) as latest_update,
    MIN(last_updated) as oldest_update
  FROM current_month_cache
  
  UNION ALL
  
  SELECT 
    'Meta Weekly' as cache_type,
    COUNT(*) as total_entries,
    COUNT(CASE WHEN AGE(NOW(), last_updated) < INTERVAL '3 hours' THEN 1 END) as fresh_count,
    COUNT(CASE WHEN AGE(NOW(), last_updated) >= INTERVAL '3 hours' THEN 1 END) as stale_count,
    MAX(last_updated) as latest_update,
    MIN(last_updated) as oldest_update
  FROM current_week_cache
  
  UNION ALL
  
  SELECT 
    'Google Ads Monthly' as cache_type,
    COUNT(*) as total_entries,
    COUNT(CASE WHEN AGE(NOW(), last_updated) < INTERVAL '3 hours' THEN 1 END) as fresh_count,
    COUNT(CASE WHEN AGE(NOW(), last_updated) >= INTERVAL '3 hours' THEN 1 END) as stale_count,
    MAX(last_updated) as latest_update,
    MIN(last_updated) as oldest_update
  FROM google_ads_current_month_cache
  
  UNION ALL
  
  SELECT 
    'Google Ads Weekly' as cache_type,
    COUNT(*) as total_entries,
    COUNT(CASE WHEN AGE(NOW(), last_updated) < INTERVAL '3 hours' THEN 1 END) as fresh_count,
    COUNT(CASE WHEN AGE(NOW(), last_updated) >= INTERVAL '3 hours' THEN 1 END) as stale_count,
    MAX(last_updated) as latest_update,
    MIN(last_updated) as oldest_update
  FROM google_ads_current_week_cache
)
SELECT 
  cache_type as "Cache Type",
  total_entries as "Total",
  fresh_count as "Fresh (<3h)",
  stale_count as "Stale (>3h)",
  CASE 
    WHEN total_entries = 0 THEN '0%'
    ELSE ROUND(100.0 * fresh_count / total_entries, 0) || '%'
  END as "Fresh %",
  CASE 
    WHEN total_entries = 0 THEN '⚠️ Empty'
    WHEN fresh_count = total_entries THEN '✅ All Fresh'
    WHEN fresh_count = 0 THEN '🔴 All Stale'
    ELSE '⚠️ Mixed'
  END as "Status",
  TO_CHAR(latest_update, 'YYYY-MM-DD HH24:MI') as "Latest Update",
  TO_CHAR(oldest_update, 'YYYY-MM-DD HH24:MI') as "Oldest Update"
FROM cache_summary;

SELECT '' as " ";

-- ============================================================================
-- 2. META MONTHLY CACHE - DETAILED BREAKDOWN
-- ============================================================================
SELECT '═══ 2. META MONTHLY CACHE - CLIENT BREAKDOWN ═══' as section;
SELECT '' as " ";

SELECT 
  c.name as "Client Name",
  cmc.period_id as "Period",
  TO_CHAR(cmc.last_updated, 'YYYY-MM-DD HH24:MI:SS') as "Last Updated",
  EXTRACT(EPOCH FROM AGE(NOW(), cmc.last_updated))/3600 as "Age (hours)",
  CASE 
    WHEN AGE(NOW(), cmc.last_updated) < INTERVAL '3 hours' THEN '✅ Fresh'
    WHEN AGE(NOW(), cmc.last_updated) < INTERVAL '24 hours' THEN '⚠️ Stale'
    ELSE '🔴 Very Stale'
  END as "Status",
  JSONB_ARRAY_LENGTH(cmc.cache_data->'campaigns') as "Campaigns",
  (cmc.cache_data->'stats'->>'totalSpend')::numeric as "Total Spend"
FROM current_month_cache cmc
JOIN clients c ON c.id = cmc.client_id
ORDER BY cmc.last_updated DESC;

SELECT '' as " ";

-- ============================================================================
-- 3. META WEEKLY CACHE - DETAILED BREAKDOWN
-- ============================================================================
SELECT '═══ 3. META WEEKLY CACHE - CLIENT BREAKDOWN ═══' as section;
SELECT '' as " ";

SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '⚠️ No entries found - Weekly cache is empty'
    ELSE NULL
  END as "Warning"
FROM current_week_cache;

SELECT 
  c.name as "Client Name",
  cwc.period_id as "Period",
  TO_CHAR(cwc.last_updated, 'YYYY-MM-DD HH24:MI:SS') as "Last Updated",
  EXTRACT(EPOCH FROM AGE(NOW(), cwc.last_updated))/3600 as "Age (hours)",
  CASE 
    WHEN AGE(NOW(), cwc.last_updated) < INTERVAL '3 hours' THEN '✅ Fresh'
    WHEN AGE(NOW(), cwc.last_updated) < INTERVAL '24 hours' THEN '⚠️ Stale'
    ELSE '🔴 Very Stale'
  END as "Status",
  JSONB_ARRAY_LENGTH(cwc.cache_data->'campaigns') as "Campaigns"
FROM current_week_cache cwc
JOIN clients c ON c.id = cwc.client_id
ORDER BY cwc.last_updated DESC;

SELECT '' as " ";

-- ============================================================================
-- 4. GOOGLE ADS MONTHLY CACHE - DETAILED BREAKDOWN
-- ============================================================================
SELECT '═══ 4. GOOGLE ADS MONTHLY CACHE - CLIENT BREAKDOWN ═══' as section;
SELECT '' as " ";

SELECT 
  c.name as "Client Name",
  gmc.period_id as "Period",
  TO_CHAR(gmc.last_updated, 'YYYY-MM-DD HH24:MI:SS') as "Last Updated",
  EXTRACT(EPOCH FROM AGE(NOW(), gmc.last_updated))/3600 as "Age (hours)",
  CASE 
    WHEN AGE(NOW(), gmc.last_updated) < INTERVAL '3 hours' THEN '✅ Fresh'
    WHEN AGE(NOW(), gmc.last_updated) < INTERVAL '24 hours' THEN '⚠️ Stale'
    ELSE '🔴 Very Stale'
  END as "Status",
  JSONB_ARRAY_LENGTH(gmc.cache_data->'campaigns') as "Campaigns",
  (gmc.cache_data->'stats'->>'totalCost')::numeric as "Total Cost"
FROM google_ads_current_month_cache gmc
JOIN clients c ON c.id = gmc.client_id
ORDER BY gmc.last_updated DESC;

SELECT '' as " ";

-- ============================================================================
-- 5. GOOGLE ADS WEEKLY CACHE - DETAILED BREAKDOWN
-- ============================================================================
SELECT '═══ 5. GOOGLE ADS WEEKLY CACHE - CLIENT BREAKDOWN ═══' as section;
SELECT '' as " ";

SELECT 
  CASE 
    WHEN COUNT(*) = 0 THEN '⚠️ No entries found - Google Ads weekly cache is empty'
    ELSE NULL
  END as "Warning"
FROM google_ads_current_week_cache;

SELECT 
  c.name as "Client Name",
  gwc.period_id as "Period",
  TO_CHAR(gwc.last_updated, 'YYYY-MM-DD HH24:MI:SS') as "Last Updated",
  EXTRACT(EPOCH FROM AGE(NOW(), gwc.last_updated))/3600 as "Age (hours)",
  CASE 
    WHEN AGE(NOW(), gwc.last_updated) < INTERVAL '3 hours' THEN '✅ Fresh'
    WHEN AGE(NOW(), gwc.last_updated) < INTERVAL '24 hours' THEN '⚠️ Stale'
    ELSE '🔴 Very Stale'
  END as "Status",
  JSONB_ARRAY_LENGTH(gwc.cache_data->'campaigns') as "Campaigns"
FROM google_ads_current_week_cache gwc
JOIN clients c ON c.id = gwc.client_id
ORDER BY gwc.last_updated DESC;

SELECT '' as " ";

-- ============================================================================
-- 6. CLIENTS WITH NO CACHE ENTRIES
-- ============================================================================
SELECT '═══ 6. CLIENTS WITHOUT CACHE ENTRIES ═══' as section;
SELECT '' as " ";

WITH current_period AS (
  SELECT 
    TO_CHAR(CURRENT_DATE, 'YYYY-MM') as current_month,
    TO_CHAR(CURRENT_DATE, 'IYYY-"W"IW') as current_week
)
SELECT 
  c.name as "Client Name",
  c.api_status as "API Status",
  CASE WHEN c.meta_access_token IS NOT NULL THEN '✅' ELSE '❌' END as "Has Meta Token",
  CASE WHEN c.ad_account_id IS NOT NULL THEN '✅' ELSE '❌' END as "Has Meta Account",
  CASE WHEN c.google_ads_customer_id IS NOT NULL THEN '✅' ELSE '❌' END as "Has Google Ads",
  CASE 
    WHEN cmc.client_id IS NULL THEN '❌ Missing'
    ELSE '✅ Has Cache'
  END as "Meta Monthly Cache",
  CASE 
    WHEN cwc.client_id IS NULL THEN '❌ Missing'
    ELSE '✅ Has Cache'
  END as "Meta Weekly Cache"
FROM clients c
CROSS JOIN current_period cp
LEFT JOIN current_month_cache cmc ON c.id = cmc.client_id AND cmc.period_id = cp.current_month
LEFT JOIN current_week_cache cwc ON c.id = cwc.client_id AND cwc.period_id = cp.current_week
WHERE c.api_status = 'valid'
ORDER BY c.name;

SELECT '' as " ";

-- ============================================================================
-- 7. CACHE REFRESH RECOMMENDATIONS
-- ============================================================================
SELECT '═══ 7. REFRESH RECOMMENDATIONS ═══' as section;
SELECT '' as " ";

WITH refresh_needs AS (
  SELECT 
    'Meta Monthly' as cache_type,
    COUNT(*) FILTER (WHERE AGE(NOW(), last_updated) >= INTERVAL '3 hours') as needs_refresh,
    COUNT(*) as total_entries
  FROM current_month_cache
  
  UNION ALL
  
  SELECT 
    'Meta Weekly' as cache_type,
    COUNT(*) FILTER (WHERE AGE(NOW(), last_updated) >= INTERVAL '3 hours') as needs_refresh,
    COUNT(*) as total_entries
  FROM current_week_cache
  
  UNION ALL
  
  SELECT 
    'Google Ads Monthly' as cache_type,
    COUNT(*) FILTER (WHERE AGE(NOW(), last_updated) >= INTERVAL '3 hours') as needs_refresh,
    COUNT(*) as total_entries
  FROM google_ads_current_month_cache
  
  UNION ALL
  
  SELECT 
    'Google Ads Weekly' as cache_type,
    COUNT(*) FILTER (WHERE AGE(NOW(), last_updated) >= INTERVAL '3 hours') as needs_refresh,
    COUNT(*) as total_entries
  FROM google_ads_current_week_cache
)
SELECT 
  cache_type as "Cache Type",
  needs_refresh as "Entries Needing Refresh",
  total_entries as "Total Entries",
  CASE 
    WHEN needs_refresh = 0 AND total_entries > 0 THEN '✅ All fresh'
    WHEN needs_refresh = 0 AND total_entries = 0 THEN '⚠️ Empty cache'
    WHEN needs_refresh = total_entries THEN '🔴 All stale - REFRESH NOW'
    ELSE '⚠️ Partial refresh needed'
  END as "Recommendation"
FROM refresh_needs;

SELECT '' as " ";

-- ============================================================================
-- 8. SYSTEM INFORMATION
-- ============================================================================
SELECT '═══ 8. SYSTEM INFORMATION ═══' as section;
SELECT '' as " ";

SELECT 
  'Current Timestamp' as "Info",
  TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS TZ') as "Value"
UNION ALL
SELECT 
  'Current Month Period',
  TO_CHAR(CURRENT_DATE, 'YYYY-MM')
UNION ALL
SELECT 
  'Current Week Period',
  TO_CHAR(CURRENT_DATE, 'IYYY-"W"IW')
UNION ALL
SELECT 
  'Cache Freshness Threshold',
  '3 hours'
UNION ALL
SELECT 
  'Total Active Clients',
  COUNT(*)::text
FROM clients 
WHERE api_status = 'valid';

SELECT '' as " ";
SELECT '══════════════════════════════════════════════════════════════════' as " ";
SELECT '                    END OF DIAGNOSTIC REPORT                      ' as " ";
SELECT '══════════════════════════════════════════════════════════════════' as " ";

