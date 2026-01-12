-- ============================================================================
-- SIMPLE DATA SOURCE CHECK - HAVET
-- ============================================================================
-- Run each query separately - no UNIONs, no complex CTEs
-- Change dates as needed: 2026-01, 2026-01-01, 2025-01-01
-- ============================================================================

-- Query 1: Current Period - Smart Cache
SELECT 
  'CURRENT - SMART CACHE' as source,
  period_id,
  last_updated,
  (cache_data->'stats'->>'totalSpend')::numeric as total_spend,
  (cache_data->'conversionMetrics'->>'booking_step_1')::numeric as booking_step_1,
  (cache_data->'conversionMetrics'->>'booking_step_2')::numeric as booking_step_2,
  (cache_data->'conversionMetrics'->>'booking_step_3')::numeric as booking_step_3,
  (cache_data->'conversionMetrics'->>'reservations')::numeric as reservations,
  (cache_data->'conversionMetrics'->>'reservation_value')::numeric as reservation_value
FROM current_month_cache
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND period_id = '2026-01'
ORDER BY last_updated DESC
LIMIT 1;

-- Query 2: Current Period - campaign_summaries
SELECT 
  'CURRENT - CAMPAIGN_SUMMARIES' as source,
  summary_date,
  last_updated,
  total_spend,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND platform = 'meta'
  AND summary_date >= '2026-01-01'
  AND summary_date <= '2026-01-31'
ORDER BY summary_date DESC
LIMIT 1;

-- Query 3: Current Period - daily_kpi_data
SELECT 
  'CURRENT - DAILY_KPI_DATA' as source,
  COUNT(*) as days_count,
  MIN(date) as first_date,
  MAX(date) as last_date,
  SUM(total_spend) as total_spend,
  SUM(booking_step_1) as booking_step_1,
  SUM(booking_step_2) as booking_step_2,
  SUM(booking_step_3) as booking_step_3,
  SUM(reservations) as reservations,
  SUM(reservation_value) as reservation_value
FROM daily_kpi_data
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND data_source = 'meta_api'
  AND date >= '2026-01-01'
  AND date <= '2026-01-31';

-- Query 4: Previous Year - campaign_summaries
SELECT 
  'PREVIOUS YEAR - CAMPAIGN_SUMMARIES' as source,
  summary_date,
  last_updated,
  total_spend,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND platform = 'meta'
  AND summary_date >= '2025-01-01'
  AND summary_date <= '2025-01-31'
ORDER BY 
  CASE WHEN summary_date = '2025-01-01' THEN 0 ELSE 1 END,
  summary_date DESC
LIMIT 1;

-- Query 5: Previous Year - daily_kpi_data
SELECT 
  'PREVIOUS YEAR - DAILY_KPI_DATA' as source,
  COUNT(*) as days_count,
  MIN(date) as first_date,
  MAX(date) as last_date,
  SUM(total_spend) as total_spend,
  SUM(booking_step_1) as booking_step_1,
  SUM(booking_step_2) as booking_step_2,
  SUM(booking_step_3) as booking_step_3,
  SUM(reservations) as reservations,
  SUM(reservation_value) as reservation_value
FROM daily_kpi_data
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND data_source = 'meta_api'
  AND date >= '2025-01-01'
  AND date <= '2025-01-31';

