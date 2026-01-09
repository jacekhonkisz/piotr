-- ============================================================================
-- HAVET META ADS - ALL DATA FOR CURRENT PERIOD
-- ============================================================================
-- Comprehensive query showing ALL Meta Ads data for Havet (not just booking steps)
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

-- ============================================================================
-- 1. META CURRENT MONTH CACHE - SUMMARY
-- ============================================================================
SELECT 
  'META MONTH CACHE SUMMARY' as section,
  '' as field_name,
  '' as field_value
UNION ALL
SELECT 
  '=' || REPEAT('=', 70),
  '',
  ''
UNION ALL
SELECT 
  'Client',
  (SELECT name FROM havet_client),
  ''
UNION ALL
SELECT 
  'Period ID',
  mm.period_id,
  ''
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  'Last Updated',
  mm.last_updated::text,
  ''
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  '',
  '',
  ''
UNION ALL
SELECT 
  'STATS',
  '',
  ''
UNION ALL
SELECT 
  'Total Spend',
  COALESCE((mm.cache_data->'stats'->>'totalSpend')::text, '0'),
  'PLN'
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  'Total Impressions',
  COALESCE((mm.cache_data->'stats'->>'totalImpressions')::text, '0'),
  ''
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  'Total Clicks',
  COALESCE((mm.cache_data->'stats'->>'totalClicks')::text, '0'),
  ''
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  'Total Conversions',
  COALESCE((mm.cache_data->'stats'->>'totalConversions')::text, '0'),
  ''
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  'Average CTR',
  COALESCE((mm.cache_data->'stats'->>'averageCtr')::text, '0'),
  '%'
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  'Average CPC',
  COALESCE((mm.cache_data->'stats'->>'averageCpc')::text, '0'),
  'PLN'
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  '',
  '',
  ''
UNION ALL
SELECT 
  'CONVERSION METRICS',
  '',
  ''
UNION ALL
SELECT 
  'Booking Step 1',
  COALESCE((mm.cache_data->'conversionMetrics'->>'booking_step_1')::text, '0'),
  ''
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  'Booking Step 2',
  COALESCE((mm.cache_data->'conversionMetrics'->>'booking_step_2')::text, '0'),
  ''
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  'Booking Step 3',
  COALESCE((mm.cache_data->'conversionMetrics'->>'booking_step_3')::text, '0'),
  ''
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  'Reservations',
  COALESCE((mm.cache_data->'conversionMetrics'->>'reservations')::text, '0'),
  ''
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  'Reservation Value',
  COALESCE((mm.cache_data->'conversionMetrics'->>'reservation_value')::text, '0'),
  'PLN'
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  'Click to Call',
  COALESCE((mm.cache_data->'conversionMetrics'->>'click_to_call')::text, '0'),
  ''
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  'Email Contacts',
  COALESCE((mm.cache_data->'conversionMetrics'->>'email_contacts')::text, '0'),
  ''
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  'Form Submissions',
  COALESCE((mm.cache_data->'conversionMetrics'->>'form_submissions')::text, '0'),
  ''
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  'Phone Calls',
  COALESCE((mm.cache_data->'conversionMetrics'->>'phone_calls')::text, '0'),
  ''
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  'Conversion Value',
  COALESCE((mm.cache_data->'conversionMetrics'->>'conversion_value')::text, '0'),
  'PLN'
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  'Total Conversion Value',
  COALESCE((mm.cache_data->'conversionMetrics'->>'total_conversion_value')::text, '0'),
  'PLN'
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  'ROAS',
  COALESCE((mm.cache_data->'conversionMetrics'->>'roas')::text, '0'),
  'x'
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  'Cost Per Reservation',
  COALESCE((mm.cache_data->'conversionMetrics'->>'cost_per_reservation')::text, '0'),
  'PLN'
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
UNION ALL
SELECT 
  '',
  '',
  ''
UNION ALL
SELECT 
  'CAMPAIGNS',
  '',
  ''
UNION ALL
SELECT 
  'Total Campaigns',
  COALESCE(jsonb_array_length(mm.cache_data->'campaigns')::text, '0'),
  ''
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period;

-- ============================================================================
-- 2. INDIVIDUAL CAMPAIGNS IN META MONTH CACHE
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
campaigns AS (
  SELECT 
    c->>'campaign_name' as campaign_name,
    c->>'campaign_id' as campaign_id,
    COALESCE((c->>'spend')::numeric, 0) as spend,
    COALESCE((c->>'impressions')::numeric, 0) as impressions,
    COALESCE((c->>'clicks')::numeric, 0) as clicks,
    COALESCE((c->>'conversions')::numeric, 0) as conversions,
    COALESCE((c->>'ctr')::numeric, 0) as ctr,
    COALESCE((c->>'cpc')::numeric, 0) as cpc,
    COALESCE((c->>'booking_step_1')::numeric, 0) as booking_step_1,
    COALESCE((c->>'booking_step_2')::numeric, 0) as booking_step_2,
    COALESCE((c->>'booking_step_3')::numeric, 0) as booking_step_3,
    COALESCE((c->>'reservations')::numeric, 0) as reservations,
    COALESCE((c->>'reservation_value')::numeric, 0) as reservation_value,
    COALESCE((c->>'click_to_call')::numeric, 0) as click_to_call,
    COALESCE((c->>'email_contacts')::numeric, 0) as email_contacts
  FROM current_month_cache mm
  CROSS JOIN havet_client hc
  CROSS JOIN current_periods cp,
  LATERAL jsonb_array_elements(mm.cache_data->'campaigns') as c
  WHERE mm.client_id = hc.id
    AND mm.period_id = cp.month_period
)
SELECT 
  'INDIVIDUAL CAMPAIGNS' as section,
  campaign_name as field_name,
  'Spend: ' || spend::text || ' | Impressions: ' || impressions::text || ' | Clicks: ' || clicks::text || ' | Step1: ' || booking_step_1::text as field_value
FROM campaigns
ORDER BY spend DESC
LIMIT 20;

-- ============================================================================
-- 3. META WEEK CACHE SUMMARY
-- ============================================================================
WITH havet_client AS (
  SELECT id, name
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
),
current_periods AS (
  SELECT 
    TO_CHAR(CURRENT_DATE, 'IYYY') || '-W' || LPAD(TO_CHAR(CURRENT_DATE, 'IW'), 2, '0') as week_period
)
SELECT 
  'META WEEK CACHE SUMMARY' as section,
  '' as field_name,
  '' as field_value
UNION ALL
SELECT 
  '=' || REPEAT('=', 70),
  '',
  ''
UNION ALL
SELECT 
  'Period ID',
  mw.period_id,
  ''
FROM current_week_cache mw
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mw.client_id = hc.id
  AND mw.period_id = cp.week_period
UNION ALL
SELECT 
  'Last Updated',
  mw.last_updated::text,
  ''
FROM current_week_cache mw
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mw.client_id = hc.id
  AND mw.period_id = cp.week_period
UNION ALL
SELECT 
  'Total Spend',
  COALESCE((mw.cache_data->'stats'->>'totalSpend')::text, '0'),
  'PLN'
FROM current_week_cache mw
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mw.client_id = hc.id
  AND mw.period_id = cp.week_period
UNION ALL
SELECT 
  'Total Impressions',
  COALESCE((mw.cache_data->'stats'->>'totalImpressions')::text, '0'),
  ''
FROM current_week_cache mw
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mw.client_id = hc.id
  AND mw.period_id = cp.week_period
UNION ALL
SELECT 
  'Total Clicks',
  COALESCE((mw.cache_data->'stats'->>'totalClicks')::text, '0'),
  ''
FROM current_week_cache mw
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mw.client_id = hc.id
  AND mw.period_id = cp.week_period
UNION ALL
SELECT 
  'Booking Step 1',
  COALESCE((mw.cache_data->'conversionMetrics'->>'booking_step_1')::text, '0'),
  ''
FROM current_week_cache mw
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mw.client_id = hc.id
  AND mw.period_id = cp.week_period
UNION ALL
SELECT 
  'Reservations',
  COALESCE((mw.cache_data->'conversionMetrics'->>'reservations')::text, '0'),
  ''
FROM current_week_cache mw
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mw.client_id = hc.id
  AND mw.period_id = cp.week_period
UNION ALL
SELECT 
  'Campaigns Count',
  COALESCE(jsonb_array_length(mw.cache_data->'campaigns')::text, '0'),
  ''
FROM current_week_cache mw
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mw.client_id = hc.id
  AND mw.period_id = cp.week_period;

-- ============================================================================
-- 4. CHECK IF CACHE EXISTS
-- ============================================================================
SELECT 
  'CACHE EXISTENCE CHECK' as section,
  'Cache Type' as field_name,
  'Exists' as field_value
UNION ALL
SELECT 
  '=' || REPEAT('=', 70),
  '',
  ''
UNION ALL
SELECT 
  'Meta Month Cache',
  CASE WHEN EXISTS (
    SELECT 1 FROM current_month_cache mm
    CROSS JOIN (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1) hc
    WHERE mm.client_id = hc.id
      AND mm.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
  ) THEN 'YES' ELSE 'NO' END,
  ''
UNION ALL
SELECT 
  'Meta Week Cache',
  CASE WHEN EXISTS (
    SELECT 1 FROM current_week_cache mw
    CROSS JOIN (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1) hc
    WHERE mw.client_id = hc.id
      AND mw.period_id = (TO_CHAR(CURRENT_DATE, 'IYYY') || '-W' || LPAD(TO_CHAR(CURRENT_DATE, 'IW'), 2, '0'))
  ) THEN 'YES' ELSE 'NO' END,
  '';

