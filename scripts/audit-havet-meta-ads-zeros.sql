-- ============================================================================
-- AUDIT: Why Havet Shows Zeros in Meta Ads Reports
-- ============================================================================
-- This query compares Havet's Meta Ads cache with other clients to find the issue
-- ============================================================================

-- ============================================================================
-- 1. CHECK HAVET META CACHE vs OTHER CLIENTS
-- ============================================================================
WITH current_periods AS (
  SELECT 
    TO_CHAR(CURRENT_DATE, 'YYYY-MM') as month_period,
    TO_CHAR(CURRENT_DATE, 'IYYY') || '-W' || LPAD(TO_CHAR(CURRENT_DATE, 'IW'), 2, '0') as week_period
),
havet_client AS (
  SELECT id, name
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
),
all_clients_meta_month AS (
  SELECT 
    c.name as client_name,
    c.id as client_id,
    mm.period_id,
    mm.last_updated,
    COALESCE((mm.cache_data->'stats'->>'totalSpend')::numeric, 0) as total_spend,
    COALESCE((mm.cache_data->'stats'->>'totalImpressions')::numeric, 0) as total_impressions,
    COALESCE((mm.cache_data->'stats'->>'totalClicks')::numeric, 0) as total_clicks,
    COALESCE((mm.cache_data->'conversionMetrics'->>'booking_step_1')::numeric, 0) as booking_step_1,
    COALESCE(jsonb_array_length(mm.cache_data->'campaigns'), 0) as campaigns_count,
    CASE WHEN c.id = (SELECT id FROM havet_client) THEN 'HAVET' ELSE 'OTHER' END as client_type
  FROM current_month_cache mm
  JOIN clients c ON c.id = mm.client_id
  CROSS JOIN current_periods cp
  WHERE mm.period_id = cp.month_period
)
SELECT 
  client_type,
  COUNT(*) as client_count,
  COUNT(CASE WHEN total_spend > 0 THEN 1 END) as clients_with_spend,
  COUNT(CASE WHEN campaigns_count > 0 THEN 1 END) as clients_with_campaigns,
  COUNT(CASE WHEN booking_step_1 > 0 THEN 1 END) as clients_with_booking_steps,
  AVG(total_spend) as avg_spend,
  AVG(campaigns_count) as avg_campaigns,
  AVG(booking_step_1) as avg_booking_step_1
FROM all_clients_meta_month
GROUP BY client_type;

-- ============================================================================
-- 2. HAVET SPECIFIC: Check Cache vs Database
-- ============================================================================
WITH havet_client AS (
  SELECT id, name
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
),
current_periods AS (
  SELECT 
    TO_CHAR(CURRENT_DATE, 'YYYY-MM') as month_period
),
cache_data AS (
  SELECT 
    'CACHE' as source,
    COALESCE((mm.cache_data->'stats'->>'totalSpend')::numeric, 0) as total_spend,
    COALESCE((mm.cache_data->'stats'->>'totalImpressions')::numeric, 0) as total_impressions,
    COALESCE((mm.cache_data->'stats'->>'totalClicks')::numeric, 0) as total_clicks,
    COALESCE((mm.cache_data->'conversionMetrics'->>'booking_step_1')::numeric, 0) as booking_step_1,
    COALESCE(jsonb_array_length(mm.cache_data->'campaigns'), 0) as campaigns_count,
    mm.last_updated
  FROM current_month_cache mm
  CROSS JOIN havet_client hc
  CROSS JOIN current_periods cp
  WHERE mm.client_id = hc.id
    AND mm.period_id = cp.month_period
),
database_data AS (
  SELECT 
    'DATABASE' as source,
    COALESCE(SUM((c->>'spend')::numeric), 0) as total_spend,
    COALESCE(SUM((c->>'impressions')::numeric), 0) as total_impressions,
    COALESCE(SUM((c->>'clicks')::numeric), 0) as total_clicks,
    COALESCE(SUM((c->>'booking_step_1')::numeric), 0) as booking_step_1,
    COUNT(*) as campaigns_count,
    MAX(cs.summary_date) as last_updated
  FROM campaign_summaries cs
  CROSS JOIN havet_client hc
  CROSS JOIN current_periods cp,
  LATERAL jsonb_array_elements(cs.campaign_data) as c
  WHERE cs.client_id = hc.id
    AND cs.platform = 'meta'
    AND cs.summary_date >= (SELECT TO_DATE(cp.month_period || '-01', 'YYYY-MM-DD') FROM current_periods LIMIT 1)
    AND cs.summary_date < (SELECT TO_DATE(cp.month_period || '-01', 'YYYY-MM-DD') + INTERVAL '1 month' FROM current_periods LIMIT 1)
  GROUP BY cs.client_id
)
SELECT * FROM cache_data
UNION ALL
SELECT * FROM database_data;

-- ============================================================================
-- 3. CHECK IF HAVET HAS META TOKEN AND AD ACCOUNT
-- ============================================================================
WITH havet_client AS (
  SELECT 
    id,
    name,
    CASE WHEN meta_access_token IS NOT NULL THEN 'YES' ELSE 'NO' END as has_meta_token,
    CASE WHEN system_user_token IS NOT NULL THEN 'YES' ELSE 'NO' END as has_system_token,
    CASE WHEN ad_account_id IS NOT NULL THEN 'YES (' || ad_account_id || ')' ELSE 'NO' END as has_ad_account,
    COALESCE(api_status, 'UNKNOWN') as api_status
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
)
SELECT 
  'HAVET META CONFIGURATION' as check_type,
  '' as field_name,
  '' as field_value
UNION ALL
SELECT 
  'Client Name',
  hc.name,
  ''
FROM havet_client hc
UNION ALL
SELECT 
  'Has Meta Access Token',
  hc.has_meta_token,
  ''
FROM havet_client hc
UNION ALL
SELECT 
  'Has System User Token',
  hc.has_system_token,
  ''
FROM havet_client hc
UNION ALL
SELECT 
  'Has Ad Account ID',
  hc.has_ad_account,
  ''
FROM havet_client hc
UNION ALL
SELECT 
  'API Status',
  hc.api_status,
  ''
FROM havet_client hc;

-- ============================================================================
-- 4. CHECK CACHE AGE AND FRESHNESS
-- ============================================================================
WITH havet_client AS (
  SELECT id, name
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
),
current_periods AS (
  SELECT 
    TO_CHAR(CURRENT_DATE, 'YYYY-MM') as month_period
)
SELECT 
  'CACHE FRESHNESS CHECK' as check_type,
  mm.period_id,
  mm.last_updated,
  NOW() - mm.last_updated as cache_age,
  CASE 
    WHEN (NOW() - mm.last_updated) < INTERVAL '3 hours' THEN 'FRESH'
    WHEN (NOW() - mm.last_updated) < INTERVAL '6 hours' THEN 'STALE'
    ELSE 'VERY OLD'
  END as freshness_status,
  COALESCE((mm.cache_data->'stats'->>'totalSpend')::numeric, 0) as total_spend,
  COALESCE(jsonb_array_length(mm.cache_data->'campaigns'), 0) as campaigns_count
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period;

-- ============================================================================
-- 5. COMPARE HAVET vs WORKING CLIENT (Sample)
-- ============================================================================
WITH current_periods AS (
  SELECT 
    TO_CHAR(CURRENT_DATE, 'YYYY-MM') as month_period
),
working_client AS (
  SELECT 
    c.id,
    c.name,
    mm.cache_data,
    mm.last_updated
  FROM current_month_cache mm
  JOIN clients c ON c.id = mm.client_id
  CROSS JOIN current_periods cp
  WHERE mm.period_id = cp.month_period
    AND COALESCE((mm.cache_data->'stats'->>'totalSpend')::numeric, 0) > 0
    AND LOWER(c.name) NOT LIKE '%havet%'
  LIMIT 1
),
havet_cache AS (
  SELECT 
    c.id,
    c.name,
    mm.cache_data,
    mm.last_updated
  FROM current_month_cache mm
  JOIN clients c ON c.id = mm.client_id
  CROSS JOIN current_periods cp
  WHERE mm.period_id = cp.month_period
    AND LOWER(c.name) LIKE '%havet%'
  LIMIT 1
)
SELECT 
  'COMPARISON: HAVET vs WORKING CLIENT' as check_type,
  '' as field_name,
  '' as field_value
UNION ALL
SELECT 
  'Working Client',
  wc.name,
  ''
FROM working_client wc
UNION ALL
SELECT 
  'Working Client - Total Spend',
  COALESCE((wc.cache_data->'stats'->>'totalSpend')::text, '0'),
  'PLN'
FROM working_client wc
UNION ALL
SELECT 
  'Working Client - Campaigns',
  COALESCE(jsonb_array_length(wc.cache_data->'campaigns')::text, '0'),
  ''
FROM working_client wc
UNION ALL
SELECT 
  'Havet - Total Spend',
  COALESCE((hc.cache_data->'stats'->>'totalSpend')::text, '0'),
  'PLN'
FROM havet_cache hc
UNION ALL
SELECT 
  'Havet - Campaigns',
  COALESCE(jsonb_array_length(hc.cache_data->'campaigns')::text, '0'),
  ''
FROM havet_cache hc
UNION ALL
SELECT 
  'Havet Cache Structure',
  CASE 
    WHEN hc.cache_data IS NULL THEN 'NULL'
    WHEN hc.cache_data->'stats' IS NULL THEN 'Missing stats'
    WHEN hc.cache_data->'campaigns' IS NULL THEN 'Missing campaigns'
    WHEN jsonb_array_length(hc.cache_data->'campaigns') = 0 THEN 'Empty campaigns array'
    ELSE 'Has structure'
  END,
  ''
FROM havet_cache hc;

