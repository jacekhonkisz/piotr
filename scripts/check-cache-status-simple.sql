-- Simple cache status check - returns all data in one query
-- This version works better with SQL clients that only show the last result

SELECT 
  'Meta Monthly' as cache_type,
  COUNT(*) as total_entries,
  COUNT(CASE WHEN AGE(NOW(), last_updated) < INTERVAL '3 hours' THEN 1 END) as fresh_count,
  COUNT(CASE WHEN AGE(NOW(), last_updated) >= INTERVAL '3 hours' THEN 1 END) as stale_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '0%'
    ELSE ROUND(100.0 * COUNT(CASE WHEN AGE(NOW(), last_updated) < INTERVAL '3 hours' THEN 1 END) / COUNT(*), 0)::text || '%'
  END as fresh_percentage,
  CASE 
    WHEN COUNT(*) = 0 THEN '⚠️ Empty'
    WHEN COUNT(CASE WHEN AGE(NOW(), last_updated) < INTERVAL '3 hours' THEN 1 END) = COUNT(*) THEN '✅ All Fresh'
    WHEN COUNT(CASE WHEN AGE(NOW(), last_updated) >= INTERVAL '3 hours' THEN 1 END) = COUNT(*) THEN '🔴 All Stale'
    ELSE '⚠️ Mixed'
  END as status,
  TO_CHAR(MAX(last_updated), 'YYYY-MM-DD HH24:MI') as latest_update,
  TO_CHAR(MIN(last_updated), 'YYYY-MM-DD HH24:MI') as oldest_update
FROM current_month_cache

UNION ALL

SELECT 
  'Meta Weekly' as cache_type,
  COUNT(*) as total_entries,
  COUNT(CASE WHEN AGE(NOW(), last_updated) < INTERVAL '3 hours' THEN 1 END) as fresh_count,
  COUNT(CASE WHEN AGE(NOW(), last_updated) >= INTERVAL '3 hours' THEN 1 END) as stale_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '0%'
    ELSE ROUND(100.0 * COUNT(CASE WHEN AGE(NOW(), last_updated) < INTERVAL '3 hours' THEN 1 END) / COUNT(*), 0)::text || '%'
  END as fresh_percentage,
  CASE 
    WHEN COUNT(*) = 0 THEN '⚠️ Empty'
    WHEN COUNT(CASE WHEN AGE(NOW(), last_updated) < INTERVAL '3 hours' THEN 1 END) = COUNT(*) THEN '✅ All Fresh'
    WHEN COUNT(CASE WHEN AGE(NOW(), last_updated) >= INTERVAL '3 hours' THEN 1 END) = COUNT(*) THEN '🔴 All Stale'
    ELSE '⚠️ Mixed'
  END as status,
  TO_CHAR(MAX(last_updated), 'YYYY-MM-DD HH24:MI') as latest_update,
  TO_CHAR(MIN(last_updated), 'YYYY-MM-DD HH24:MI') as oldest_update
FROM current_week_cache

UNION ALL

SELECT 
  'Google Ads Monthly' as cache_type,
  COUNT(*) as total_entries,
  COUNT(CASE WHEN AGE(NOW(), last_updated) < INTERVAL '3 hours' THEN 1 END) as fresh_count,
  COUNT(CASE WHEN AGE(NOW(), last_updated) >= INTERVAL '3 hours' THEN 1 END) as stale_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '0%'
    ELSE ROUND(100.0 * COUNT(CASE WHEN AGE(NOW(), last_updated) < INTERVAL '3 hours' THEN 1 END) / COUNT(*), 0)::text || '%'
  END as fresh_percentage,
  CASE 
    WHEN COUNT(*) = 0 THEN '⚠️ Empty'
    WHEN COUNT(CASE WHEN AGE(NOW(), last_updated) < INTERVAL '3 hours' THEN 1 END) = COUNT(*) THEN '✅ All Fresh'
    WHEN COUNT(CASE WHEN AGE(NOW(), last_updated) >= INTERVAL '3 hours' THEN 1 END) = COUNT(*) THEN '🔴 All Stale'
    ELSE '⚠️ Mixed'
  END as status,
  TO_CHAR(MAX(last_updated), 'YYYY-MM-DD HH24:MI') as latest_update,
  TO_CHAR(MIN(last_updated), 'YYYY-MM-DD HH24:MI') as oldest_update
FROM google_ads_current_month_cache

UNION ALL

SELECT 
  'Google Ads Weekly' as cache_type,
  COUNT(*) as total_entries,
  COUNT(CASE WHEN AGE(NOW(), last_updated) < INTERVAL '3 hours' THEN 1 END) as fresh_count,
  COUNT(CASE WHEN AGE(NOW(), last_updated) >= INTERVAL '3 hours' THEN 1 END) as stale_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '0%'
    ELSE ROUND(100.0 * COUNT(CASE WHEN AGE(NOW(), last_updated) < INTERVAL '3 hours' THEN 1 END) / COUNT(*), 0)::text || '%'
  END as fresh_percentage,
  CASE 
    WHEN COUNT(*) = 0 THEN '⚠️ Empty'
    WHEN COUNT(CASE WHEN AGE(NOW(), last_updated) < INTERVAL '3 hours' THEN 1 END) = COUNT(*) THEN '✅ All Fresh'
    WHEN COUNT(CASE WHEN AGE(NOW(), last_updated) >= INTERVAL '3 hours' THEN 1 END) = COUNT(*) THEN '🔴 All Stale'
    ELSE '⚠️ Mixed'
  END as status,
  TO_CHAR(MAX(last_updated), 'YYYY-MM-DD HH24:MI') as latest_update,
  TO_CHAR(MIN(last_updated), 'YYYY-MM-DD HH24:MI') as oldest_update
FROM google_ads_current_week_cache;

