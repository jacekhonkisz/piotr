-- ============================================================================
-- CHECK HAVET CURRENT PERIOD DATA
-- ============================================================================
-- This query shows what data is stored for Havet in current period caches
-- ============================================================================

-- Get Havet client ID
WITH havet_client AS (
  SELECT id, name
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
),
current_periods AS (
  SELECT 
    TO_CHAR(CURRENT_DATE, 'YYYY-MM') as month_period,
    TO_CHAR(CURRENT_DATE, 'IYYY') || '-W' || LPAD(TO_CHAR(CURRENT_DATE, 'IW'), 2, '0') as week_period
)
SELECT 
  'HAVET CURRENT PERIOD DATA SUMMARY' as report_type,
  '' as separator
UNION ALL
SELECT 
  '=' || REPEAT('=', 70),
  ''
UNION ALL
SELECT 
  'Client: ' || (SELECT name FROM havet_client),
  ''
UNION ALL
SELECT 
  'Current Month Period: ' || (SELECT month_period FROM current_periods),
  ''
UNION ALL
SELECT 
  'Current Week Period: ' || (SELECT week_period FROM current_periods),
  ''
UNION ALL
SELECT 
  '',
  ''
UNION ALL
SELECT 
  '1. GOOGLE ADS CURRENT MONTH CACHE',
  ''
UNION ALL
SELECT 
  '   Period ID: ' || COALESCE(gm.period_id, 'NULL'),
  '   Last Updated: ' || COALESCE(gm.last_updated::text, 'NULL')
FROM google_ads_current_month_cache gm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE gm.client_id = hc.id
  AND gm.period_id = cp.month_period
UNION ALL
SELECT 
  '   Booking Step 1: ' || COALESCE((gm.cache_data->'conversionMetrics'->>'booking_step_1'), '0'),
  '   Booking Step 2: ' || COALESCE((gm.cache_data->'conversionMetrics'->>'booking_step_2'), '0')
FROM google_ads_current_month_cache gm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE gm.client_id = hc.id
  AND gm.period_id = cp.month_period
UNION ALL
SELECT 
  '   Booking Step 3: ' || COALESCE((gm.cache_data->'conversionMetrics'->>'booking_step_3'), '0'),
  '   Reservations: ' || COALESCE((gm.cache_data->'conversionMetrics'->>'reservations'), '0')
FROM google_ads_current_month_cache gm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE gm.client_id = hc.id
  AND gm.period_id = cp.month_period
UNION ALL
SELECT 
  '   Reservation Value: ' || COALESCE((gm.cache_data->'conversionMetrics'->>'reservation_value'), '0'),
  '   Total Spend: ' || COALESCE((gm.cache_data->'stats'->>'totalSpend'), '0')
FROM google_ads_current_month_cache gm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE gm.client_id = hc.id
  AND gm.period_id = cp.month_period
UNION ALL
SELECT 
  '   Campaigns Count: ' || COALESCE(jsonb_array_length(gm.cache_data->'campaigns')::text, '0'),
  ''
FROM google_ads_current_month_cache gm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE gm.client_id = hc.id
  AND gm.period_id = cp.month_period
UNION ALL
SELECT 
  '',
  ''
UNION ALL
SELECT 
  '2. META CURRENT MONTH CACHE',
  ''
UNION ALL
SELECT 
  '   Period ID: ' || COALESCE(mm.period_id, 'NULL'),
  '   Last Updated: ' || COALESCE(mm.last_updated::text, 'NULL')
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  '   Booking Step 1: ' || COALESCE((mm.cache_data->'conversionMetrics'->>'booking_step_1'), '0'),
  '   Booking Step 2: ' || COALESCE((mm.cache_data->'conversionMetrics'->>'booking_step_2'), '0')
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  '   Booking Step 3: ' || COALESCE((mm.cache_data->'conversionMetrics'->>'booking_step_3'), '0'),
  '   Reservations: ' || COALESCE((mm.cache_data->'conversionMetrics'->>'reservations'), '0')
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  '   Total Spend: ' || COALESCE((mm.cache_data->'stats'->>'totalSpend'), '0'),
  '   Campaigns Count: ' || COALESCE(jsonb_array_length(mm.cache_data->'campaigns')::text, '0')
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  '',
  ''
UNION ALL
SELECT 
  '3. GOOGLE ADS CURRENT WEEK CACHE',
  ''
UNION ALL
SELECT 
  '   Period ID: ' || COALESCE(gw.period_id, 'NULL'),
  '   Last Updated: ' || COALESCE(gw.last_updated::text, 'NULL')
FROM google_ads_current_week_cache gw
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE gw.client_id = hc.id
  AND gw.period_id = cp.week_period
UNION ALL
SELECT 
  '   Booking Step 1: ' || COALESCE((gw.cache_data->'conversionMetrics'->>'booking_step_1'), '0'),
  '   Booking Step 2: ' || COALESCE((gw.cache_data->'conversionMetrics'->>'booking_step_2'), '0')
FROM google_ads_current_week_cache gw
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE gw.client_id = hc.id
  AND gw.period_id = cp.week_period
UNION ALL
SELECT 
  '   Booking Step 3: ' || COALESCE((gw.cache_data->'conversionMetrics'->>'booking_step_3'), '0'),
  '   Total Spend: ' || COALESCE((gw.cache_data->'stats'->>'totalSpend'), '0')
FROM google_ads_current_week_cache gw
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE gw.client_id = hc.id
  AND gw.period_id = cp.week_period
UNION ALL
SELECT 
  '',
  ''
UNION ALL
SELECT 
  '4. META CURRENT WEEK CACHE',
  ''
UNION ALL
SELECT 
  '   Period ID: ' || COALESCE(mw.period_id, 'NULL'),
  '   Last Updated: ' || COALESCE(mw.last_updated::text, 'NULL')
FROM current_week_cache mw
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mw.client_id = hc.id
  AND mw.period_id = cp.week_period
UNION ALL
SELECT 
  '   Booking Step 1: ' || COALESCE((mw.cache_data->'conversionMetrics'->>'booking_step_1'), '0'),
  '   Booking Step 2: ' || COALESCE((mw.cache_data->'conversionMetrics'->>'booking_step_2'), '0')
FROM current_week_cache mw
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mw.client_id = hc.id
  AND mw.period_id = cp.week_period
UNION ALL
SELECT 
  '   Booking Step 3: ' || COALESCE((mw.cache_data->'conversionMetrics'->>'booking_step_3'), '0'),
  '   Total Spend: ' || COALESCE((mw.cache_data->'stats'->>'totalSpend'), '0')
FROM current_week_cache mw
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mw.client_id = hc.id
  AND mw.period_id = cp.week_period;

-- ============================================================================
-- DETAILED VIEW: Individual Campaigns in Google Ads Cache
-- ============================================================================
WITH havet_client AS (
  SELECT id, name
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
),
current_periods AS (
  SELECT 
    TO_CHAR(CURRENT_DATE, 'YYYY-MM') as month_period,
    TO_CHAR(CURRENT_DATE, 'IYYY') || '-W' || LPAD(TO_CHAR(CURRENT_DATE, 'IW'), 2, '0') as week_period
),
campaign_data AS (
  SELECT 
    c->>'campaignName' as campaign_name,
    COALESCE((c->>'booking_step_1')::int, 0) as step1,
    COALESCE((c->>'booking_step_2')::int, 0) as step2,
    COALESCE((c->>'booking_step_3')::int, 0) as step3,
    COALESCE((c->>'reservations')::int, 0) as reservations
  FROM google_ads_current_month_cache gm
  CROSS JOIN havet_client hc
  CROSS JOIN current_periods cp,
  LATERAL jsonb_array_elements(gm.cache_data->'campaigns') as c
  WHERE gm.client_id = hc.id
    AND gm.period_id = cp.month_period
    AND (COALESCE((c->>'booking_step_1')::int, 0) > 0 
         OR COALESCE((c->>'booking_step_2')::int, 0) > 0 
         OR COALESCE((c->>'booking_step_3')::int, 0) > 0)
)
SELECT 
  'DETAILED: GOOGLE ADS CAMPAIGNS IN CACHE' as report_type,
  '' as separator
UNION ALL
SELECT 
  '=' || REPEAT('=', 70),
  ''
UNION ALL
SELECT 
  'Campaign Name',
  'Step 1 | Step 2 | Step 3 | Reservations'
UNION ALL
SELECT 
  REPEAT('-', 50),
  REPEAT('-', 40)
UNION ALL
SELECT 
  campaign_name,
  step1::text || ' | ' || step2::text || ' | ' || step3::text || ' | ' || reservations::text as metrics
FROM campaign_data
ORDER BY step1 DESC
LIMIT 20;

-- ============================================================================
-- COMPARISON: Cache vs Database (campaign_summaries)
-- ============================================================================
WITH havet_client AS (
  SELECT id, name
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
),
current_periods AS (
  SELECT 
    TO_CHAR(CURRENT_DATE, 'YYYY-MM') as month_period,
    TO_CHAR(CURRENT_DATE, 'IYYY') || '-W' || LPAD(TO_CHAR(CURRENT_DATE, 'IW'), 2, '0') as week_period
)
SELECT 
  'COMPARISON: CACHE vs DATABASE' as report_type,
  '' as separator
UNION ALL
SELECT 
  '=' || REPEAT('=', 70),
  ''
UNION ALL
SELECT 
  'Source',
  'Step 1 | Step 2 | Step 3 | Reservations'
UNION ALL
SELECT 
  REPEAT('-', 30),
  REPEAT('-', 40)
UNION ALL
SELECT 
  'Google Ads Cache',
  COALESCE((gm.cache_data->'conversionMetrics'->>'booking_step_1'), '0') || ' | ' || 
  COALESCE((gm.cache_data->'conversionMetrics'->>'booking_step_2'), '0') || ' | ' || 
  COALESCE((gm.cache_data->'conversionMetrics'->>'booking_step_3'), '0') || ' | ' || 
  COALESCE((gm.cache_data->'conversionMetrics'->>'reservations'), '0')
FROM google_ads_current_month_cache gm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE gm.client_id = hc.id
  AND gm.period_id = cp.month_period
UNION ALL
SELECT 
  'Database (campaign_summaries)',
  COALESCE(SUM((c->>'booking_step_1')::numeric)::text, '0') || ' | ' || 
  COALESCE(SUM((c->>'booking_step_2')::numeric)::text, '0') || ' | ' || 
  COALESCE(SUM((c->>'booking_step_3')::numeric)::text, '0') || ' | ' || 
  COALESCE(SUM((c->>'reservations')::numeric)::text, '0')
FROM campaign_summaries cs
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp,
LATERAL jsonb_array_elements(cs.campaign_data) as c
WHERE cs.client_id = hc.id
  AND cs.platform = 'google'
  AND cs.summary_date >= (SELECT TO_DATE(cp.month_period || '-01', 'YYYY-MM-DD') FROM current_periods LIMIT 1)
  AND cs.summary_date < (SELECT TO_DATE(cp.month_period || '-01', 'YYYY-MM-DD') + INTERVAL '1 month' FROM current_periods LIMIT 1)
GROUP BY cs.client_id;

