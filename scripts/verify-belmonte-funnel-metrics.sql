-- BELMONTE FUNNEL METRICS VERIFICATION QUERIES
-- Run these queries to verify the fix is working correctly

-- Query 1: Check current month cache for Belmonte
-- Expected: Should show non-zero, non-generic funnel metrics if data exists
SELECT 
  period_id,
  last_updated,
  AGE(NOW(), last_updated) as cache_age,
  cache_data->'stats'->>'totalSpend' as total_spend,
  cache_data->'stats'->>'totalClicks' as total_clicks,
  cache_data->'conversionMetrics'->>'booking_step_1' as step_1,
  cache_data->'conversionMetrics'->>'booking_step_2' as step_2,
  cache_data->'conversionMetrics'->>'booking_step_3' as step_3,
  cache_data->'conversionMetrics'->>'reservations' as reservations,
  cache_data->'conversionMetrics'->>'reservation_value' as revenue,
  -- Calculate ratio to detect generic estimates
  CASE 
    WHEN (cache_data->'stats'->>'totalClicks')::numeric > 0 THEN
      ROUND(
        (cache_data->'conversionMetrics'->>'booking_step_1')::numeric / 
        (cache_data->'stats'->>'totalClicks')::numeric * 100,
        2
      )
    ELSE 0
  END as step1_to_clicks_ratio
FROM current_month_cache
WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%belmonte%' LIMIT 1)
ORDER BY last_updated DESC
LIMIT 1;

-- Query 2: Check daily_kpi_data for current month (real collected data)
-- Expected: Should have daily records with conversion metrics
SELECT 
  date,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  total_spend,
  total_clicks,
  data_source,
  CASE 
    WHEN booking_step_1 > 0 OR reservations > 0 THEN '✅ Has funnel data'
    WHEN total_spend > 0 THEN '⚠️  Has spend but no funnel'
    ELSE 'ℹ️  No activity'
  END as status
FROM daily_kpi_data
WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%belmonte%' LIMIT 1)
  AND date >= DATE_TRUNC('month', CURRENT_DATE)
ORDER BY date DESC;

-- Query 3: Compare current cache vs daily_kpi_data totals
-- Expected: Should be similar if both are using real data
WITH cache_metrics AS (
  SELECT 
    'cache' as source,
    (cache_data->'conversionMetrics'->>'booking_step_1')::numeric as booking_step_1,
    (cache_data->'conversionMetrics'->>'booking_step_2')::numeric as booking_step_2,
    (cache_data->'conversionMetrics'->>'booking_step_3')::numeric as booking_step_3,
    (cache_data->'conversionMetrics'->>'reservations')::numeric as reservations
  FROM current_month_cache
  WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%belmonte%' LIMIT 1)
    AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
),
daily_metrics AS (
  SELECT 
    'daily_kpi_data' as source,
    SUM(booking_step_1) as booking_step_1,
    SUM(booking_step_2) as booking_step_2,
    SUM(booking_step_3) as booking_step_3,
    SUM(reservations) as reservations
  FROM daily_kpi_data
  WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%belmonte%' LIMIT 1)
    AND date >= DATE_TRUNC('month', CURRENT_DATE)
)
SELECT * FROM cache_metrics
UNION ALL
SELECT * FROM daily_metrics;

-- Query 4: Check for generic estimate patterns
-- Expected: Ratios should NOT be exactly 2%, 1%, 0.5% (common estimate percentages)
WITH metrics AS (
  SELECT 
    period_id,
    (cache_data->'stats'->>'totalSpend')::numeric as spend,
    (cache_data->'stats'->>'totalClicks')::numeric as clicks,
    (cache_data->'conversionMetrics'->>'booking_step_1')::numeric as step1,
    (cache_data->'conversionMetrics'->>'reservations')::numeric as reservations
  FROM current_month_cache
  WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%belmonte%' LIMIT 1)
    AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
)
SELECT 
  period_id,
  spend,
  clicks,
  step1,
  reservations,
  CASE 
    WHEN clicks > 0 THEN ROUND((step1 / clicks) * 100, 4)
    ELSE 0
  END as step1_ratio_pct,
  CASE 
    WHEN clicks > 0 THEN ROUND((reservations / clicks) * 100, 4)
    ELSE 0
  END as reservations_ratio_pct,
  CASE 
    WHEN spend > 0 AND (step1 = 0 AND reservations = 0) THEN '❌ ZERO FUNNEL (possible estimate bug)'
    WHEN clicks > 0 AND ABS((step1 / clicks) - 0.02) < 0.0001 THEN '⚠️  EXACTLY 2% (likely generic estimate)'
    WHEN clicks > 0 AND ABS((reservations / clicks) - 0.005) < 0.0001 THEN '⚠️  EXACTLY 0.5% (likely generic estimate)'
    WHEN step1 > 0 THEN '✅ REAL DATA (natural variation)'
    ELSE 'ℹ️  No data yet'
  END as assessment
FROM metrics;

-- Query 5: Check campaign data in current_month_cache
-- Expected: Campaigns should have conversion metrics populated
SELECT 
  period_id,
  jsonb_array_length(cache_data->'campaigns') as campaign_count,
  (
    SELECT COUNT(*) 
    FROM jsonb_array_elements(cache_data->'campaigns') as campaign 
    WHERE (campaign->>'booking_step_1')::numeric > 0 
       OR (campaign->>'reservations')::numeric > 0
  ) as campaigns_with_funnel_data,
  (
    SELECT AVG((campaign->>'booking_step_1')::numeric) 
    FROM jsonb_array_elements(cache_data->'campaigns') as campaign 
    WHERE (campaign->>'booking_step_1')::numeric > 0
  )::numeric(10,2) as avg_step1_per_campaign
FROM current_month_cache
WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%belmonte%' LIMIT 1)
  AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

-- INTERPRETATION GUIDE:
-- =====================
-- ✅ WORKING CORRECTLY if:
--    - Cache has non-zero funnel metrics that match daily_kpi_data
--    - Ratios are NOT exactly 2%, 1%, or 0.5%
--    - Multiple campaigns show funnel data
--    - Funnel decreases logically (step1 >= step2 >= step3 >= reservations)
--
-- ❌ BUG STILL PRESENT if:
--    - Cache has spend but ZERO funnel metrics
--    - Ratios are exactly 2% or other round percentages
--    - No campaigns show funnel data (all zeros)
--    - Cache doesn't match daily_kpi_data (and daily data exists)

