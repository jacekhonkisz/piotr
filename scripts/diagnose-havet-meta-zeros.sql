-- ============================================================================
-- QUICK DIAGNOSTIC: Why Havet Shows Zeros in Meta Ads Reports
-- ============================================================================
-- Run this to quickly identify the root cause
-- ============================================================================

WITH havet_client AS (
  SELECT id, name
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
),
current_period AS (
  SELECT TO_CHAR(CURRENT_DATE, 'YYYY-MM') as month_period
),
havet_cache AS (
  SELECT 
    mm.period_id,
    mm.last_updated,
    mm.cache_data,
    COALESCE((mm.cache_data->'stats'->>'totalSpend')::numeric, 0) as cache_spend,
    COALESCE((mm.cache_data->'stats'->>'totalClicks')::numeric, 0) as cache_clicks,
    COALESCE(jsonb_array_length(mm.cache_data->'campaigns'), 0) as cache_campaigns,
    COALESCE((mm.cache_data->'conversionMetrics'->>'booking_step_1')::numeric, 0) as cache_booking_step_1
  FROM current_month_cache mm
  CROSS JOIN havet_client hc
  CROSS JOIN current_period cp
  WHERE mm.client_id = hc.id
    AND mm.period_id = cp.month_period
),
havet_database AS (
  SELECT 
    COALESCE(SUM((c->>'spend')::numeric), 0) as db_spend,
    COALESCE(SUM((c->>'clicks')::numeric), 0) as db_clicks,
    COUNT(*) as db_campaigns,
    COALESCE(SUM((c->>'booking_step_1')::numeric), 0) as db_booking_step_1,
    MAX(cs.summary_date) as latest_summary_date
  FROM campaign_summaries cs
  CROSS JOIN havet_client hc
  CROSS JOIN current_period cp,
  LATERAL jsonb_array_elements(cs.campaign_data) as c
  WHERE cs.client_id = hc.id
    AND cs.platform = 'meta'
    AND cs.summary_date >= TO_DATE(cp.month_period || '-01', 'YYYY-MM-DD')
    AND cs.summary_date < TO_DATE(cp.month_period || '-01', 'YYYY-MM-DD') + INTERVAL '1 month'
)
SELECT 
  '🔍 HAVET META ADS DIAGNOSTIC' as diagnostic,
  '' as metric,
  '' as value
UNION ALL
SELECT 
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  '',
  ''
UNION ALL
SELECT 
  '📊 CACHE STATUS',
  '',
  ''
UNION ALL
SELECT 
  '  Cache Exists',
  CASE WHEN hc.period_id IS NOT NULL THEN 'YES' ELSE 'NO' END,
  ''
FROM havet_cache hc
RIGHT JOIN current_period cp ON true
UNION ALL
SELECT 
  '  Cache Spend',
  COALESCE(hc.cache_spend::text, '0'),
  'PLN'
FROM havet_cache hc
UNION ALL
SELECT 
  '  Cache Clicks',
  COALESCE(hc.cache_clicks::text, '0'),
  ''
FROM havet_cache hc
UNION ALL
SELECT 
  '  Cache Campaigns',
  COALESCE(hc.cache_campaigns::text, '0'),
  ''
FROM havet_cache hc
UNION ALL
SELECT 
  '  Cache Booking Step 1',
  COALESCE(hc.cache_booking_step_1::text, '0'),
  ''
FROM havet_cache hc
UNION ALL
SELECT 
  '  Cache Last Updated',
  COALESCE(hc.last_updated::text, 'N/A'),
  ''
FROM havet_cache hc
UNION ALL
SELECT 
  '',
  '',
  ''
UNION ALL
SELECT 
  '💾 DATABASE STATUS',
  '',
  ''
UNION ALL
SELECT 
  '  Database Spend',
  COALESCE(hd.db_spend::text, '0'),
  'PLN'
FROM havet_database hd
UNION ALL
SELECT 
  '  Database Clicks',
  COALESCE(hd.db_clicks::text, '0'),
  ''
FROM havet_database hd
UNION ALL
SELECT 
  '  Database Campaigns',
  COALESCE(hd.db_campaigns::text, '0'),
  ''
FROM havet_database hd
UNION ALL
SELECT 
  '  Database Booking Step 1',
  COALESCE(hd.db_booking_step_1::text, '0'),
  ''
FROM havet_database hd
UNION ALL
SELECT 
  '  Latest Summary Date',
  COALESCE(hd.latest_summary_date::text, 'N/A'),
  ''
FROM havet_database hd
UNION ALL
SELECT 
  '',
  '',
  ''
UNION ALL
SELECT 
  '🎯 ROOT CAUSE ANALYSIS',
  '',
  ''
UNION ALL
SELECT 
  '  Issue',
  CASE 
    WHEN (SELECT cache_spend FROM havet_cache) = 0 
         AND (SELECT db_spend FROM havet_database) > 0 
    THEN 'Cache has zeros but database has data - Cache needs refresh'
    WHEN (SELECT cache_spend FROM havet_cache) = 0 
         AND (SELECT db_spend FROM havet_database) = 0 
    THEN 'Both cache and database have zeros - Data collection issue'
    WHEN (SELECT cache_spend FROM havet_cache) > 0 
         AND (SELECT db_spend FROM havet_database) = 0 
    THEN 'Cache has data but database is empty - Database sync issue'
    ELSE 'Unknown - Check individual metrics above'
  END,
  ''
UNION ALL
SELECT 
  '  Recommended Action',
  CASE 
    WHEN (SELECT cache_spend FROM havet_cache) = 0 
         AND (SELECT db_spend FROM havet_database) > 0 
    THEN 'Delete cache and force refresh: DELETE FROM current_month_cache WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE ''%havet%'') AND period_id = TO_CHAR(CURRENT_DATE, ''YYYY-MM'')'
    WHEN (SELECT cache_spend FROM havet_cache) = 0 
         AND (SELECT db_spend FROM havet_database) = 0 
    THEN 'Check Meta API permissions and run recollect script'
    ELSE 'Review cache and database data above'
  END,
  '';

