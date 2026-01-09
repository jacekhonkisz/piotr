-- ============================================================================
-- HAVET META ADS - SIMPLE ALL DATA CHECK
-- ============================================================================
-- Quick view of ALL Meta Ads data for Havet current period
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

-- Meta Month Cache - All Data
SELECT 
  'Meta Month Cache' as cache_type,
  mm.period_id,
  mm.last_updated,
  -- Stats
  COALESCE((mm.cache_data->'stats'->>'totalSpend')::numeric, 0) as total_spend,
  COALESCE((mm.cache_data->'stats'->>'totalImpressions')::numeric, 0) as total_impressions,
  COALESCE((mm.cache_data->'stats'->>'totalClicks')::numeric, 0) as total_clicks,
  COALESCE((mm.cache_data->'stats'->>'totalConversions')::numeric, 0) as total_conversions,
  COALESCE((mm.cache_data->'stats'->>'averageCtr')::numeric, 0) as average_ctr,
  COALESCE((mm.cache_data->'stats'->>'averageCpc')::numeric, 0) as average_cpc,
  -- Conversion Metrics
  COALESCE((mm.cache_data->'conversionMetrics'->>'booking_step_1')::numeric, 0) as booking_step_1,
  COALESCE((mm.cache_data->'conversionMetrics'->>'booking_step_2')::numeric, 0) as booking_step_2,
  COALESCE((mm.cache_data->'conversionMetrics'->>'booking_step_3')::numeric, 0) as booking_step_3,
  COALESCE((mm.cache_data->'conversionMetrics'->>'reservations')::numeric, 0) as reservations,
  COALESCE((mm.cache_data->'conversionMetrics'->>'reservation_value')::numeric, 0) as reservation_value,
  COALESCE((mm.cache_data->'conversionMetrics'->>'click_to_call')::numeric, 0) as click_to_call,
  COALESCE((mm.cache_data->'conversionMetrics'->>'email_contacts')::numeric, 0) as email_contacts,
  COALESCE((mm.cache_data->'conversionMetrics'->>'form_submissions')::numeric, 0) as form_submissions,
  COALESCE((mm.cache_data->'conversionMetrics'->>'phone_calls')::numeric, 0) as phone_calls,
  COALESCE((mm.cache_data->'conversionMetrics'->>'conversion_value')::numeric, 0) as conversion_value,
  COALESCE((mm.cache_data->'conversionMetrics'->>'total_conversion_value')::numeric, 0) as total_conversion_value,
  COALESCE((mm.cache_data->'conversionMetrics'->>'roas')::numeric, 0) as roas,
  COALESCE((mm.cache_data->'conversionMetrics'->>'cost_per_reservation')::numeric, 0) as cost_per_reservation,
  -- Campaigns
  COALESCE(jsonb_array_length(mm.cache_data->'campaigns'), 0) as campaigns_count
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period

UNION ALL

-- Meta Week Cache - All Data
SELECT 
  'Meta Week Cache' as cache_type,
  mw.period_id,
  mw.last_updated,
  -- Stats
  COALESCE((mw.cache_data->'stats'->>'totalSpend')::numeric, 0) as total_spend,
  COALESCE((mw.cache_data->'stats'->>'totalImpressions')::numeric, 0) as total_impressions,
  COALESCE((mw.cache_data->'stats'->>'totalClicks')::numeric, 0) as total_clicks,
  COALESCE((mw.cache_data->'stats'->>'totalConversions')::numeric, 0) as total_conversions,
  COALESCE((mw.cache_data->'stats'->>'averageCtr')::numeric, 0) as average_ctr,
  COALESCE((mw.cache_data->'stats'->>'averageCpc')::numeric, 0) as average_cpc,
  -- Conversion Metrics
  COALESCE((mw.cache_data->'conversionMetrics'->>'booking_step_1')::numeric, 0) as booking_step_1,
  COALESCE((mw.cache_data->'conversionMetrics'->>'booking_step_2')::numeric, 0) as booking_step_2,
  COALESCE((mw.cache_data->'conversionMetrics'->>'booking_step_3')::numeric, 0) as booking_step_3,
  COALESCE((mw.cache_data->'conversionMetrics'->>'reservations')::numeric, 0) as reservations,
  COALESCE((mw.cache_data->'conversionMetrics'->>'reservation_value')::numeric, 0) as reservation_value,
  COALESCE((mw.cache_data->'conversionMetrics'->>'click_to_call')::numeric, 0) as click_to_call,
  COALESCE((mw.cache_data->'conversionMetrics'->>'email_contacts')::numeric, 0) as email_contacts,
  COALESCE((mw.cache_data->'conversionMetrics'->>'form_submissions')::numeric, 0) as form_submissions,
  COALESCE((mw.cache_data->'conversionMetrics'->>'phone_calls')::numeric, 0) as phone_calls,
  COALESCE((mw.cache_data->'conversionMetrics'->>'conversion_value')::numeric, 0) as conversion_value,
  COALESCE((mw.cache_data->'conversionMetrics'->>'total_conversion_value')::numeric, 0) as total_conversion_value,
  COALESCE((mw.cache_data->'conversionMetrics'->>'roas')::numeric, 0) as roas,
  COALESCE((mw.cache_data->'conversionMetrics'->>'cost_per_reservation')::numeric, 0) as cost_per_reservation,
  -- Campaigns
  COALESCE(jsonb_array_length(mw.cache_data->'campaigns'), 0) as campaigns_count
FROM current_week_cache mw
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp
WHERE mw.client_id = hc.id
  AND mw.period_id = cp.week_period;

-- ============================================================================
-- Individual Campaigns Detail
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
  COALESCE((c->>'email_contacts')::numeric, 0) as email_contacts,
  COALESCE((c->>'form_submissions')::numeric, 0) as form_submissions,
  COALESCE((c->>'phone_calls')::numeric, 0) as phone_calls
FROM current_month_cache mm
CROSS JOIN havet_client hc
CROSS JOIN current_periods cp,
LATERAL jsonb_array_elements(mm.cache_data->'campaigns') as c
WHERE mm.client_id = hc.id
  AND mm.period_id = cp.month_period
ORDER BY COALESCE((c->>'spend')::numeric, 0) DESC
LIMIT 20;

