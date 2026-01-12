-- ============================================================================
-- MINIMAL DATA SOURCE AUDIT TEST - HAVET
-- ============================================================================
-- Simple test to see what data sources exist and their values
-- ============================================================================
-- Change dates here:
-- ============================================================================

-- PART 1: Current Period - Smart Cache
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

-- PART 2: Current Period - campaign_summaries
SELECT 
  'CURRENT - CAMPAIGN_SUMMARIES' as source,
  summary_date::text as period_id,
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

-- PART 3: Current Period - daily_kpi_data (Aggregated)
SELECT 
  'CURRENT - DAILY_KPI_DATA' as source,
  COUNT(*)::text as period_id,
  MAX(updated_at) as last_updated,
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

-- PART 4: Previous Year - campaign_summaries
SELECT 
  'PREVIOUS YEAR - CAMPAIGN_SUMMARIES' as source,
  summary_date::text as period_id,
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

-- PART 5: Previous Year - daily_kpi_data (Aggregated)
SELECT 
  'PREVIOUS YEAR - DAILY_KPI_DATA' as source,
  COUNT(*)::text as period_id,
  MAX(updated_at) as last_updated,
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

-- ============================================================================
-- PART 6: COMPARISON - All Sources Side by Side
-- ============================================================================

WITH current_smart_cache AS (
  SELECT 
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
  LIMIT 1
),
current_summaries AS (
  SELECT 
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
  LIMIT 1
),
current_daily_kpi AS (
  SELECT 
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
    AND date <= '2026-01-31'
),
previous_summaries AS (
  SELECT 
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
  LIMIT 1
),
previous_daily_kpi AS (
  SELECT 
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
    AND date <= '2025-01-31'
)
SELECT 
  'SMART_CACHE' as source_type,
  'CURRENT' as period,
  COALESCE(total_spend, 0) as total_spend,
  COALESCE(booking_step_1, 0) as booking_step_1,
  COALESCE(booking_step_2, 0) as booking_step_2,
  COALESCE(booking_step_3, 0) as booking_step_3,
  COALESCE(reservations, 0) as reservations,
  COALESCE(reservation_value, 0) as reservation_value
FROM current_smart_cache
UNION ALL
SELECT 
  'CAMPAIGN_SUMMARIES' as source_type,
  'CURRENT' as period,
  COALESCE(total_spend, 0),
  COALESCE(booking_step_1, 0),
  COALESCE(booking_step_2, 0),
  COALESCE(booking_step_3, 0),
  COALESCE(reservations, 0),
  COALESCE(reservation_value, 0)
FROM current_summaries
UNION ALL
SELECT 
  'DAILY_KPI_DATA' as source_type,
  'CURRENT' as period,
  COALESCE(total_spend, 0),
  COALESCE(booking_step_1, 0),
  COALESCE(booking_step_2, 0),
  COALESCE(booking_step_3, 0),
  COALESCE(reservations, 0),
  COALESCE(reservation_value, 0)
FROM current_daily_kpi
UNION ALL
SELECT 
  'CAMPAIGN_SUMMARIES' as source_type,
  'PREVIOUS_YEAR' as period,
  COALESCE(total_spend, 0),
  COALESCE(booking_step_1, 0),
  COALESCE(booking_step_2, 0),
  COALESCE(booking_step_3, 0),
  COALESCE(reservations, 0),
  COALESCE(reservation_value, 0)
FROM previous_summaries
UNION ALL
SELECT 
  'DAILY_KPI_DATA' as source_type,
  'PREVIOUS_YEAR' as period,
  COALESCE(total_spend, 0),
  COALESCE(booking_step_1, 0),
  COALESCE(booking_step_2, 0),
  COALESCE(booking_step_3, 0),
  COALESCE(reservations, 0),
  COALESCE(reservation_value, 0)
FROM previous_daily_kpi
ORDER BY 
  CASE period WHEN 'CURRENT' THEN 0 ELSE 1 END,
  CASE source_type 
    WHEN 'SMART_CACHE' THEN 0
    WHEN 'CAMPAIGN_SUMMARIES' THEN 1
    WHEN 'DAILY_KPI_DATA' THEN 2
    ELSE 3
  END;

-- ============================================================================
-- PART 7: YEAR-OVER-YEAR COMPARISON
-- ============================================================================

WITH current_smart_cache AS (
  SELECT 
    (cache_data->'stats'->>'totalSpend')::numeric as total_spend,
    (cache_data->'conversionMetrics'->>'booking_step_1')::numeric as booking_step_1,
    (cache_data->'conversionMetrics'->>'reservations')::numeric as reservations
  FROM current_month_cache
  WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
    AND period_id = '2026-01'
  LIMIT 1
),
current_summaries AS (
  SELECT 
    total_spend,
    booking_step_1,
    reservations
  FROM campaign_summaries
  WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
    AND platform = 'meta'
    AND summary_date >= '2026-01-01'
    AND summary_date <= '2026-01-31'
  ORDER BY summary_date DESC
  LIMIT 1
),
previous_summaries AS (
  SELECT 
    total_spend,
    booking_step_1,
    reservations
  FROM campaign_summaries
  WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
    AND platform = 'meta'
    AND summary_date >= '2025-01-01'
    AND summary_date <= '2025-01-31'
  ORDER BY 
    CASE WHEN summary_date = '2025-01-01' THEN 0 ELSE 1 END,
    summary_date DESC
  LIMIT 1
)
SELECT 
  'SMART_CACHE vs CAMPAIGN_SUMMARIES' as comparison_type,
  COALESCE((SELECT booking_step_1 FROM current_smart_cache), 0) as current_step1,
  COALESCE((SELECT booking_step_1 FROM previous_summaries), 0) as previous_step1,
  CASE 
    WHEN COALESCE((SELECT booking_step_1 FROM previous_summaries), 0) > 0 THEN
      ROUND(((COALESCE((SELECT booking_step_1 FROM current_smart_cache), 0) - 
              COALESCE((SELECT booking_step_1 FROM previous_summaries), 0)) / 
             COALESCE((SELECT booking_step_1 FROM previous_summaries), 0)::numeric * 100), 2)
    ELSE NULL
  END as step1_yoy_change_percent,
  COALESCE((SELECT reservations FROM current_smart_cache), 0) as current_reservations,
  COALESCE((SELECT reservations FROM previous_summaries), 0) as previous_reservations,
  CASE 
    WHEN COALESCE((SELECT reservations FROM previous_summaries), 0) > 0 THEN
      ROUND(((COALESCE((SELECT reservations FROM current_smart_cache), 0) - 
              COALESCE((SELECT reservations FROM previous_summaries), 0)) / 
             COALESCE((SELECT reservations FROM previous_summaries), 0)::numeric * 100), 2)
    ELSE NULL
  END as reservations_yoy_change_percent
UNION ALL
SELECT 
  'CAMPAIGN_SUMMARIES vs CAMPAIGN_SUMMARIES' as comparison_type,
  COALESCE((SELECT booking_step_1 FROM current_summaries), 0),
  COALESCE((SELECT booking_step_1 FROM previous_summaries), 0),
  CASE 
    WHEN COALESCE((SELECT booking_step_1 FROM previous_summaries), 0) > 0 THEN
      ROUND(((COALESCE((SELECT booking_step_1 FROM current_summaries), 0) - 
              COALESCE((SELECT booking_step_1 FROM previous_summaries), 0)) / 
             COALESCE((SELECT booking_step_1 FROM previous_summaries), 0)::numeric * 100), 2)
    ELSE NULL
  END,
  COALESCE((SELECT reservations FROM current_summaries), 0),
  COALESCE((SELECT reservations FROM previous_summaries), 0),
  CASE 
    WHEN COALESCE((SELECT reservations FROM previous_summaries), 0) > 0 THEN
      ROUND(((COALESCE((SELECT reservations FROM current_summaries), 0) - 
              COALESCE((SELECT reservations FROM previous_summaries), 0)) / 
             COALESCE((SELECT reservations FROM previous_summaries), 0)::numeric * 100), 2)
    ELSE NULL
  END;

