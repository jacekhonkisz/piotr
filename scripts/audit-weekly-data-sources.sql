-- AUDIT: Where is Weekly Report Data Coming From?
-- This will check ALL possible sources that weekly reports might use

-- ============================================================================
-- SOURCE 1: campaign_summaries (Primary Storage)
-- ============================================================================

SELECT 
  '📊 SOURCE 1: campaign_summaries' as source,
  COUNT(*) as total_weekly_records,
  COUNT(DISTINCT client_id) as clients_with_data,
  MIN(summary_date) as earliest_week,
  MAX(summary_date) as latest_week
FROM campaign_summaries
WHERE summary_type = 'weekly';

-- Expected after deletion: 0 records

-- ============================================================================
-- SOURCE 2: smart_cache (May have cached weekly data)
-- ============================================================================

SELECT 
  '🔄 SOURCE 2: smart_cache' as source,
  COUNT(*) as total_cache_entries,
  COUNT(*) FILTER (WHERE cache_type = 'current_week') as current_week_caches,
  COUNT(*) FILTER (WHERE cache_type LIKE '%week%') as week_related_caches,
  MAX(created_at) as most_recent_cache
FROM smart_cache
WHERE cache_type LIKE '%week%';

-- If this shows data, weekly reports might be using cache!

-- ============================================================================
-- SOURCE 3: daily_kpi_data (Could be aggregated into weekly)
-- ============================================================================

SELECT 
  '📅 SOURCE 3: daily_kpi_data' as source,
  COUNT(*) as total_daily_records,
  COUNT(DISTINCT client_id) as clients_with_data,
  COUNT(DISTINCT date) as unique_dates,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM daily_kpi_data;

-- This is RAW daily data that could be aggregated on-the-fly

-- ============================================================================
-- SOURCE 4: Check Smart Cache Details
-- ============================================================================

SELECT 
  sc.cache_type,
  c.name as client_name,
  sc.period_start,
  sc.period_end,
  sc.created_at,
  sc.updated_at,
  CASE 
    WHEN sc.cached_data IS NOT NULL THEN 'Has data'
    ELSE 'No data'
  END as data_status,
  LENGTH(sc.cached_data::text) as data_size_bytes
FROM smart_cache sc
JOIN clients c ON c.id = sc.client_id
WHERE sc.cache_type LIKE '%week%'
ORDER BY sc.updated_at DESC
LIMIT 20;

-- Shows recent weekly cache entries

-- ============================================================================
-- SOURCE 5: Check if API might be generating data on-the-fly
-- ============================================================================

-- Check for Meta API tokens (could fetch live)
SELECT 
  '🔑 META API STATUS' as info,
  COUNT(*) as total_clients,
  COUNT(*) FILTER (WHERE meta_access_token IS NOT NULL) as clients_with_meta_token,
  COUNT(*) FILTER (WHERE ad_account_id IS NOT NULL) as clients_with_ad_account
FROM clients;

-- If clients have tokens, API might fetch live data

-- ============================================================================
-- SOURCE 6: Summary of All Data Sources
-- ============================================================================

WITH weekly_summary AS (
  SELECT 'campaign_summaries' as source, COUNT(*) as record_count
  FROM campaign_summaries
  WHERE summary_type = 'weekly'
),
cache_summary AS (
  SELECT 'smart_cache' as source, COUNT(*) as record_count
  FROM smart_cache
  WHERE cache_type LIKE '%week%'
),
daily_summary AS (
  SELECT 'daily_kpi_data' as source, COUNT(*) as record_count
  FROM daily_kpi_data
)
SELECT * FROM weekly_summary
UNION ALL
SELECT * FROM cache_summary
UNION ALL
SELECT * FROM daily_summary
ORDER BY record_count DESC;

-- ============================================================================
-- DIAGNOSTIC: What's showing in reports?
-- ============================================================================

-- Get a sample of what SHOULD NOT exist
SELECT 
  '🔍 SAMPLE DATA CHECK' as info,
  c.name as client_name,
  cs.summary_type,
  cs.summary_date,
  cs.platform,
  cs.total_spend,
  cs.reservations,
  cs.created_at
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
LIMIT 10;

-- If this shows data, deletion didn't work!

-- ============================================================================
-- RECOMMENDATIONS
-- ============================================================================

/*
Based on results above, here's what to check:

1. If campaign_summaries shows 0 records:
   ✅ Database deletion worked
   ❌ But reports are pulling from elsewhere

2. If smart_cache shows records:
   🔄 Clear the cache!
   DELETE FROM smart_cache WHERE cache_type LIKE '%week%';

3. If daily_kpi_data shows records:
   📊 Reports might be aggregating daily data on-the-fly
   This is OK - daily data should stay

4. If reports still show data after all:
   🔍 Check frontend code - might be:
   - Using localStorage/sessionStorage
   - Fetching from different API endpoint
   - Using backup/archive tables
*/

