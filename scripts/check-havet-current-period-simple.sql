-- ============================================================================
-- SIMPLE CHECK: Havet Current Period Data
-- ============================================================================
-- Quick query to see what's stored for Havet in current period caches
-- ============================================================================

-- Get Havet client and current periods
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

-- Google Ads Current Month Cache
SELECT 
  'Google Ads Month Cache' as source,
  gm.period_id,
  gm.last_updated,
  (gm.cache_data->'conversionMetrics'->>'booking_step_1')::numeric as step1,
  (gm.cache_data->'conversionMetrics'->>'booking_step_2')::numeric as step2,
  (gm.cache_data->'conversionMetrics'->>'booking_step_3')::numeric as step3,
  (gm.cache_data->'conversionMetrics'->>'reservations')::numeric as reservations,
  (gm.cache_data->'conversionMetrics'->>'reservation_value')::numeric as reservation_value,
  (gm.cache_data->'stats'->>'totalSpend')::numeric as total_spend,
  jsonb_array_length(gm.cache_data->'campaigns') as campaigns_count
FROM google_ads_current_month_cache gm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE gm.client_id = hc.id
  AND gm.period_id = cp.month_period

UNION ALL

-- Meta Current Month Cache
SELECT 
  'Meta Month Cache' as source,
  mm.period_id,
  mm.last_updated,
  (mm.cache_data->'conversionMetrics'->>'booking_step_1')::numeric as step1,
  (mm.cache_data->'conversionMetrics'->>'booking_step_2')::numeric as step2,
  (mm.cache_data->'conversionMetrics'->>'booking_step_3')::numeric as step3,
  (mm.cache_data->'conversionMetrics'->>'reservations')::numeric as reservations,
  (mm.cache_data->'conversionMetrics'->>'reservation_value')::numeric as reservation_value,
  (mm.cache_data->'stats'->>'totalSpend')::numeric as total_spend,
  jsonb_array_length(mm.cache_data->'campaigns') as campaigns_count
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period

UNION ALL

-- Google Ads Current Week Cache
SELECT 
  'Google Ads Week Cache' as source,
  gw.period_id,
  gw.last_updated,
  (gw.cache_data->'conversionMetrics'->>'booking_step_1')::numeric as step1,
  (gw.cache_data->'conversionMetrics'->>'booking_step_2')::numeric as step2,
  (gw.cache_data->'conversionMetrics'->>'booking_step_3')::numeric as step3,
  (gw.cache_data->'conversionMetrics'->>'reservations')::numeric as reservations,
  (gw.cache_data->'conversionMetrics'->>'reservation_value')::numeric as reservation_value,
  (gw.cache_data->'stats'->>'totalSpend')::numeric as total_spend,
  jsonb_array_length(gw.cache_data->'campaigns') as campaigns_count
FROM google_ads_current_week_cache gw
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE gw.client_id = hc.id
  AND gw.period_id = cp.week_period

UNION ALL

-- Meta Current Week Cache
SELECT 
  'Meta Week Cache' as source,
  mw.period_id,
  mw.last_updated,
  (mw.cache_data->'conversionMetrics'->>'booking_step_1')::numeric as step1,
  (mw.cache_data->'conversionMetrics'->>'booking_step_2')::numeric as step2,
  (mw.cache_data->'conversionMetrics'->>'booking_step_3')::numeric as step3,
  (mw.cache_data->'conversionMetrics'->>'reservations')::numeric as reservations,
  (mw.cache_data->'conversionMetrics'->>'reservation_value')::numeric as reservation_value,
  (mw.cache_data->'stats'->>'totalSpend')::numeric as total_spend,
  jsonb_array_length(mw.cache_data->'campaigns') as campaigns_count
FROM current_week_cache mw
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mw.client_id = hc.id
  AND mw.period_id = cp.week_period

ORDER BY source;

-- ============================================================================
-- Top Campaigns with Booking Steps (Google Ads)
-- ============================================================================
SELECT 
  'Top Campaigns with Booking Steps' as report_type,
  '' as separator
UNION ALL
SELECT 
  '=' || REPEAT('=', 70),
  ''
UNION ALL
SELECT 
  c->>'campaignName' as campaign_name,
  COALESCE((c->>'booking_step_1')::numeric, 0)::text || ' | ' || 
  COALESCE((c->>'booking_step_2')::numeric, 0)::text || ' | ' || 
  COALESCE((c->>'booking_step_3')::numeric, 0)::text || ' | ' || 
  COALESCE((c->>'reservations')::numeric, 0)::text as "Step1 | Step2 | Step3 | Reservations"
FROM google_ads_current_month_cache gm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp,
LATERAL jsonb_array_elements(gm.cache_data->'campaigns') as c
WHERE gm.client_id = hc.id
  AND gm.period_id = cp.month_period
  AND (COALESCE((c->>'booking_step_1')::numeric, 0) > 0 
       OR COALESCE((c->>'booking_step_2')::numeric, 0) > 0 
       OR COALESCE((c->>'booking_step_3')::numeric, 0) > 0)
ORDER BY COALESCE((c->>'booking_step_1')::numeric, 0) DESC
LIMIT 10;

