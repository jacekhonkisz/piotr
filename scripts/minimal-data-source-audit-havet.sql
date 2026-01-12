-- ============================================================================
-- MINIMAL DATA SOURCE AUDIT - HAVET
-- ============================================================================
-- Simple queries - run each one separately
-- Change dates: 2026-01, 2026-01-01, 2025-01-01 as needed
-- ============================================================================

-- 1. CURRENT PERIOD - Smart Cache
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

-- 2. CURRENT PERIOD - campaign_summaries
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

-- 3. CURRENT PERIOD - daily_kpi_data
SELECT 
  'CURRENT - DAILY_KPI_DATA' as source,
  COUNT(*) as days_count,
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

-- 4. PREVIOUS YEAR - campaign_summaries
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

-- 5. PREVIOUS YEAR - daily_kpi_data
SELECT 
  'PREVIOUS YEAR - DAILY_KPI_DATA' as source,
  COUNT(*) as days_count,
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
-- COMPARISON - All Sources (Fixed UNION - No ORDER BY inside)
-- ============================================================================

SELECT 
  source_type,
  period_type,
  total_spend,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value
FROM (
  SELECT 
    'SMART_CACHE' as source_type,
    'CURRENT' as period_type,
    COALESCE((cache_data->'stats'->>'totalSpend')::numeric, 0) as total_spend,
    COALESCE((cache_data->'conversionMetrics'->>'booking_step_1')::numeric, 0) as booking_step_1,
    COALESCE((cache_data->'conversionMetrics'->>'booking_step_2')::numeric, 0) as booking_step_2,
    COALESCE((cache_data->'conversionMetrics'->>'booking_step_3')::numeric, 0) as booking_step_3,
    COALESCE((cache_data->'conversionMetrics'->>'reservations')::numeric, 0) as reservations,
    COALESCE((cache_data->'conversionMetrics'->>'reservation_value')::numeric, 0) as reservation_value
  FROM (
    SELECT cache_data
    FROM current_month_cache
    WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
      AND period_id = '2026-01'
    ORDER BY last_updated DESC
    LIMIT 1
  ) latest_cache
  
  UNION ALL
  
  SELECT 
    'CAMPAIGN_SUMMARIES' as source_type,
    'CURRENT' as period_type,
    COALESCE(total_spend, 0),
    COALESCE(booking_step_1, 0),
    COALESCE(booking_step_2, 0),
    COALESCE(booking_step_3, 0),
    COALESCE(reservations, 0),
    COALESCE(reservation_value, 0)
  FROM (
    SELECT total_spend, booking_step_1, booking_step_2, booking_step_3, reservations, reservation_value
    FROM campaign_summaries
    WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
      AND platform = 'meta'
      AND summary_date >= '2026-01-01'
      AND summary_date <= '2026-01-31'
    ORDER BY summary_date DESC
    LIMIT 1
  ) current_summary
  
  UNION ALL
  
  SELECT 
    'DAILY_KPI_DATA' as source_type,
    'CURRENT' as period_type,
    COALESCE(SUM(total_spend), 0),
    COALESCE(SUM(booking_step_1), 0),
    COALESCE(SUM(booking_step_2), 0),
    COALESCE(SUM(booking_step_3), 0),
    COALESCE(SUM(reservations), 0),
    COALESCE(SUM(reservation_value), 0)
  FROM daily_kpi_data
  WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
    AND data_source = 'meta_api'
    AND date >= '2026-01-01'
    AND date <= '2026-01-31'
  GROUP BY client_id
  
  UNION ALL
  
  SELECT 
    'CAMPAIGN_SUMMARIES' as source_type,
    'PREVIOUS_YEAR' as period_type,
    COALESCE(total_spend, 0),
    COALESCE(booking_step_1, 0),
    COALESCE(booking_step_2, 0),
    COALESCE(booking_step_3, 0),
    COALESCE(reservations, 0),
    COALESCE(reservation_value, 0)
  FROM (
    SELECT total_spend, booking_step_1, booking_step_2, booking_step_3, reservations, reservation_value
    FROM campaign_summaries
    WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
      AND platform = 'meta'
      AND summary_date >= '2025-01-01'
      AND summary_date <= '2025-01-31'
    ORDER BY 
      CASE WHEN summary_date = '2025-01-01' THEN 0 ELSE 1 END,
      summary_date DESC
    LIMIT 1
  ) previous_summary
  
  UNION ALL
  
  SELECT 
    'DAILY_KPI_DATA' as source_type,
    'PREVIOUS_YEAR' as period_type,
    COALESCE(SUM(total_spend), 0),
    COALESCE(SUM(booking_step_1), 0),
    COALESCE(SUM(booking_step_2), 0),
    COALESCE(SUM(booking_step_3), 0),
    COALESCE(SUM(reservations), 0),
    COALESCE(SUM(reservation_value), 0)
  FROM daily_kpi_data
  WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
    AND data_source = 'meta_api'
    AND date >= '2025-01-01'
    AND date <= '2025-01-31'
  GROUP BY client_id
) all_sources
ORDER BY 
  period_type,
  source_type;

-- ============================================================================
-- YEAR-OVER-YEAR COMPARISON
-- ============================================================================

WITH current_data AS (
  SELECT 
    COALESCE((cache_data->'stats'->>'totalSpend')::numeric, 0) as total_spend,
    COALESCE((cache_data->'conversionMetrics'->>'booking_step_1')::numeric, 0) as booking_step_1,
    COALESCE((cache_data->'conversionMetrics'->>'reservations')::numeric, 0) as reservations
  FROM current_month_cache
  WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
    AND period_id = '2026-01'
  LIMIT 1
),
previous_data AS (
  SELECT 
    COALESCE(total_spend, 0) as total_spend,
    COALESCE(booking_step_1, 0) as booking_step_1,
    COALESCE(reservations, 0) as reservations
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
  'YEAR-OVER-YEAR COMPARISON' as comparison_type,
  (SELECT booking_step_1 FROM current_data) as current_step1,
  (SELECT booking_step_1 FROM previous_data) as previous_step1,
  CASE 
    WHEN (SELECT booking_step_1 FROM previous_data) > 0 THEN
      ROUND(((SELECT booking_step_1 FROM current_data) - 
             (SELECT booking_step_1 FROM previous_data)) / 
            (SELECT booking_step_1 FROM previous_data)::numeric * 100, 2)
    ELSE NULL
  END as step1_yoy_change_percent,
  (SELECT reservations FROM current_data) as current_reservations,
  (SELECT reservations FROM previous_data) as previous_reservations,
  CASE 
    WHEN (SELECT reservations FROM previous_data) > 0 THEN
      ROUND(((SELECT reservations FROM current_data) - 
             (SELECT reservations FROM previous_data)) / 
            (SELECT reservations FROM previous_data)::numeric * 100, 2)
    ELSE NULL
  END as reservations_yoy_change_percent;

