-- ============================================================================
-- COMPREHENSIVE DATA SOURCE AUDIT - HAVET CLIENT
-- ============================================================================
-- Purpose: Audit all data sources to identify the REAL source of truth
--          for current period vs previous year comparisons
-- ============================================================================
-- This version uses standard SQL (no psql variables) - works in any SQL client
-- ============================================================================

-- Configuration: Set date ranges here
WITH config AS (
  SELECT 
    '2026-01-01'::date as current_start_date,
    '2026-01-31'::date as current_end_date,
    '2025-01-01'::date as previous_year_start,
    '2025-01-31'::date as previous_year_end,
    'meta'::text as platform  -- Change to 'google' for Google Ads
),
havet_client AS (
  SELECT id, name
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
),
current_period_info AS (
  SELECT 
    TO_CHAR(c.current_start_date, 'YYYY-MM') as month_period_id,
    c.current_start_date,
    c.current_end_date,
    c.platform
  FROM config c
),
previous_period_info AS (
  SELECT 
    TO_CHAR(p.previous_year_start, 'YYYY-MM') as month_period_id,
    p.previous_year_start,
    p.previous_year_end,
    p.platform
  FROM config p
)

-- ============================================================================
-- PART 1: CURRENT PERIOD DATA SOURCES AUDIT
-- ============================================================================
-- Run each query separately (1.1, 1.2, 1.3)

-- 1.1: Smart Cache (current_month_cache)
SELECT 
  'CURRENT PERIOD - SMART CACHE' as data_source,
  'current_month_cache' as table_name,
  cmc.period_id,
  cmc.last_updated,
  (cmc.cache_data->>'stats')::jsonb->>'totalSpend' as total_spend,
  (cmc.cache_data->>'stats')::jsonb->>'totalImpressions' as total_impressions,
  (cmc.cache_data->>'stats')::jsonb->>'totalClicks' as total_clicks,
  (cmc.cache_data->>'conversionMetrics')::jsonb->>'booking_step_1' as booking_step_1,
  (cmc.cache_data->>'conversionMetrics')::jsonb->>'booking_step_2' as booking_step_2,
  (cmc.cache_data->>'conversionMetrics')::jsonb->>'booking_step_3' as booking_step_3,
  (cmc.cache_data->>'conversionMetrics')::jsonb->>'reservations' as reservations,
  (cmc.cache_data->>'conversionMetrics')::jsonb->>'reservation_value' as reservation_value,
  (cmc.cache_data->>'conversionMetrics')::jsonb->>'click_to_call' as click_to_call,
  (cmc.cache_data->>'conversionMetrics')::jsonb->>'email_contacts' as email_contacts,
  (cmc.cache_data->>'fromCache')::boolean as from_cache,
  EXTRACT(EPOCH FROM (NOW() - cmc.last_updated)) / 3600 as cache_age_hours
FROM current_month_cache cmc
CROSS JOIN (
  SELECT id, name
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
) hc
CROSS JOIN (
  SELECT 
    '2026-01-01'::date as current_start_date,
    '2026-01-31'::date as current_end_date,
    'meta'::text as platform
) cpi
WHERE cmc.client_id = hc.id
  AND cmc.period_id = TO_CHAR(cpi.current_start_date, 'YYYY-MM')
ORDER BY cmc.last_updated DESC
LIMIT 1;

-- 1.2: campaign_summaries (Current Period)
SELECT 
  'CURRENT PERIOD - CAMPAIGN_SUMMARIES' as data_source,
  'campaign_summaries' as table_name,
  cs.summary_date::text as period_id,
  cs.last_updated,
  cs.total_spend::text as total_spend,
  cs.total_impressions::text as total_impressions,
  cs.total_clicks::text as total_clicks,
  cs.booking_step_1::text as booking_step_1,
  cs.booking_step_2::text as booking_step_2,
  cs.booking_step_3::text as booking_step_3,
  cs.reservations::text as reservations,
  cs.reservation_value::text as reservation_value,
  cs.click_to_call::text as click_to_call,
  cs.email_contacts::text as email_contacts
FROM campaign_summaries cs
CROSS JOIN (
  SELECT id
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
) hc
CROSS JOIN (
  SELECT 
    '2026-01-01'::date as current_start_date,
    '2026-01-31'::date as current_end_date,
    'meta'::text as platform
) cpi
WHERE cs.client_id = hc.id
  AND cs.platform = cpi.platform
  AND cs.summary_date >= cpi.current_start_date
  AND cs.summary_date <= cpi.current_end_date
ORDER BY cs.summary_date DESC, cs.last_updated DESC
LIMIT 1;

-- 1.3: daily_kpi_data (Current Period - Aggregated)
SELECT 
  'CURRENT PERIOD - DAILY_KPI_DATA' as data_source,
  'daily_kpi_data' as table_name,
  COUNT(*)::text as days_count,
  MIN(dkd.date) as first_date,
  MAX(dkd.date) as last_date,
  MAX(dkd.updated_at) as last_updated,
  SUM(dkd.total_spend)::text as total_spend,
  SUM(dkd.total_impressions)::text as total_impressions,
  SUM(dkd.total_clicks)::text as total_clicks,
  SUM(dkd.booking_step_1)::text as booking_step_1,
  SUM(dkd.booking_step_2)::text as booking_step_2,
  SUM(dkd.booking_step_3)::text as booking_step_3,
  SUM(dkd.reservations)::text as reservations,
  SUM(dkd.reservation_value)::text as reservation_value,
  SUM(dkd.click_to_call)::text as click_to_call,
  SUM(dkd.email_contacts)::text as email_contacts
FROM daily_kpi_data dkd
CROSS JOIN (
  SELECT id
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
) hc
CROSS JOIN (
  SELECT 
    '2026-01-01'::date as current_start_date,
    '2026-01-31'::date as current_end_date,
    'meta'::text as platform
) cpi
WHERE dkd.client_id = hc.id
  AND dkd.data_source = CASE 
    WHEN cpi.platform = 'meta' THEN 'meta_api'
    WHEN cpi.platform = 'google' THEN 'google_ads_api'
    ELSE cpi.platform
  END
  AND dkd.date >= cpi.current_start_date
  AND dkd.date <= cpi.current_end_date
GROUP BY dkd.client_id;

-- ============================================================================
-- PART 2: PREVIOUS YEAR DATA SOURCES AUDIT
-- ============================================================================
-- Run each query separately (2.1, 2.2)

-- 2.1: campaign_summaries (Previous Year)
SELECT 
  'PREVIOUS YEAR - CAMPAIGN_SUMMARIES' as data_source,
  'campaign_summaries' as table_name,
  cs.summary_date::text as period_id,
  cs.last_updated,
  cs.total_spend::text as total_spend,
  cs.total_impressions::text as total_impressions,
  cs.total_clicks::text as total_clicks,
  cs.booking_step_1::text as booking_step_1,
  cs.booking_step_2::text as booking_step_2,
  cs.booking_step_3::text as booking_step_3,
  cs.reservations::text as reservations,
  cs.reservation_value::text as reservation_value,
  cs.click_to_call::text as click_to_call,
  cs.email_contacts::text as email_contacts
FROM campaign_summaries cs
CROSS JOIN (
  SELECT id
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
) hc
CROSS JOIN (
  SELECT 
    '2025-01-01'::date as previous_year_start,
    '2025-01-31'::date as previous_year_end,
    'meta'::text as platform
) c
WHERE cs.client_id = hc.id
  AND cs.platform = c.platform
  AND cs.summary_date >= c.previous_year_start
  AND cs.summary_date <= c.previous_year_end
ORDER BY 
  CASE WHEN cs.summary_date = DATE_TRUNC('month', c.previous_year_start)::date THEN 0 ELSE 1 END,
  cs.summary_date DESC,
  cs.last_updated DESC
LIMIT 1;

-- 2.2: daily_kpi_data (Previous Year - Aggregated)
SELECT 
  'PREVIOUS YEAR - DAILY_KPI_DATA' as data_source,
  'daily_kpi_data' as table_name,
  COUNT(*)::text as days_count,
  MIN(dkd.date) as first_date,
  MAX(dkd.date) as last_date,
  MAX(dkd.updated_at) as last_updated,
  SUM(dkd.total_spend)::text as total_spend,
  SUM(dkd.total_impressions)::text as total_impressions,
  SUM(dkd.total_clicks)::text as total_clicks,
  SUM(dkd.booking_step_1)::text as booking_step_1,
  SUM(dkd.booking_step_2)::text as booking_step_2,
  SUM(dkd.booking_step_3)::text as booking_step_3,
  SUM(dkd.reservations)::text as reservations,
  SUM(dkd.reservation_value)::text as reservation_value,
  SUM(dkd.click_to_call)::text as click_to_call,
  SUM(dkd.email_contacts)::text as email_contacts
FROM daily_kpi_data dkd
CROSS JOIN (
  SELECT id
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
) hc
CROSS JOIN (
  SELECT 
    '2025-01-01'::date as previous_year_start,
    '2025-01-31'::date as previous_year_end,
    'meta'::text as platform
) c
WHERE dkd.client_id = hc.id
  AND dkd.data_source = CASE 
    WHEN c.platform = 'meta' THEN 'meta_api'
    WHEN c.platform = 'google' THEN 'google_ads_api'
    ELSE c.platform
  END
  AND dkd.date >= c.previous_year_start
  AND dkd.date <= c.previous_year_end
GROUP BY dkd.client_id;

-- ============================================================================
-- PART 3: COMPREHENSIVE COMPARISON - ALL SOURCES SIDE BY SIDE
-- ============================================================================

WITH config AS (
  SELECT 
    '2026-01-01'::date as current_start_date,
    '2026-01-31'::date as current_end_date,
    '2025-01-01'::date as previous_year_start,
    '2025-01-31'::date as previous_year_end,
    'meta'::text as platform
),
havet_client AS (
  SELECT id, name
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
),
current_smart_cache AS (
  SELECT 
    'SMART_CACHE' as source_type,
    'CURRENT' as period,
    (cmc.cache_data->>'stats')::jsonb->>'totalSpend'::numeric as total_spend,
    (cmc.cache_data->>'conversionMetrics')::jsonb->>'booking_step_1'::numeric as booking_step_1,
    (cmc.cache_data->>'conversionMetrics')::jsonb->>'booking_step_2'::numeric as booking_step_2,
    (cmc.cache_data->>'conversionMetrics')::jsonb->>'booking_step_3'::numeric as booking_step_3,
    (cmc.cache_data->>'conversionMetrics')::jsonb->>'reservations'::numeric as reservations,
    (cmc.cache_data->>'conversionMetrics')::jsonb->>'reservation_value'::numeric as reservation_value,
    (cmc.cache_data->>'conversionMetrics')::jsonb->>'click_to_call'::numeric as click_to_call
  FROM current_month_cache cmc
  CROSS JOIN havet_client hc
  CROSS JOIN config c
  WHERE cmc.client_id = hc.id
    AND cmc.period_id = TO_CHAR(c.current_start_date, 'YYYY-MM')
  ORDER BY cmc.last_updated DESC
  LIMIT 1
),
current_summaries AS (
  SELECT 
    'CAMPAIGN_SUMMARIES' as source_type,
    'CURRENT' as period,
    cs.total_spend,
    cs.booking_step_1,
    cs.booking_step_2,
    cs.booking_step_3,
    cs.reservations,
    cs.reservation_value,
    cs.click_to_call
  FROM campaign_summaries cs
  CROSS JOIN havet_client hc
  CROSS JOIN config c
  WHERE cs.client_id = hc.id
    AND cs.platform = c.platform
    AND cs.summary_date >= c.current_start_date
    AND cs.summary_date <= c.current_end_date
  ORDER BY cs.summary_date DESC, cs.last_updated DESC
  LIMIT 1
),
current_daily_kpi AS (
  SELECT 
    'DAILY_KPI_DATA' as source_type,
    'CURRENT' as period,
    SUM(dkd.total_spend) as total_spend,
    SUM(dkd.booking_step_1) as booking_step_1,
    SUM(dkd.booking_step_2) as booking_step_2,
    SUM(dkd.booking_step_3) as booking_step_3,
    SUM(dkd.reservations) as reservations,
    SUM(dkd.reservation_value) as reservation_value,
    SUM(dkd.click_to_call) as click_to_call
  FROM daily_kpi_data dkd
  CROSS JOIN havet_client hc
  CROSS JOIN config c
  WHERE dkd.client_id = hc.id
    AND dkd.data_source = CASE 
      WHEN c.platform = 'meta' THEN 'meta_api'
      WHEN c.platform = 'google' THEN 'google_ads_api'
      ELSE c.platform
    END
    AND dkd.date >= c.current_start_date
    AND dkd.date <= c.current_end_date
  GROUP BY dkd.client_id
),
previous_summaries AS (
  SELECT 
    'CAMPAIGN_SUMMARIES' as source_type,
    'PREVIOUS_YEAR' as period,
    cs.total_spend,
    cs.booking_step_1,
    cs.booking_step_2,
    cs.booking_step_3,
    cs.reservations,
    cs.reservation_value,
    cs.click_to_call
  FROM campaign_summaries cs
  CROSS JOIN havet_client hc
  CROSS JOIN config c
  WHERE cs.client_id = hc.id
    AND cs.platform = c.platform
    AND cs.summary_date >= c.previous_year_start
    AND cs.summary_date <= c.previous_year_end
  ORDER BY 
    CASE WHEN cs.summary_date = DATE_TRUNC('month', c.previous_year_start)::date THEN 0 ELSE 1 END,
    cs.summary_date DESC
  LIMIT 1
),
previous_daily_kpi AS (
  SELECT 
    'DAILY_KPI_DATA' as source_type,
    'PREVIOUS_YEAR' as period,
    SUM(dkd.total_spend) as total_spend,
    SUM(dkd.booking_step_1) as booking_step_1,
    SUM(dkd.booking_step_2) as booking_step_2,
    SUM(dkd.booking_step_3) as booking_step_3,
    SUM(dkd.reservations) as reservations,
    SUM(dkd.reservation_value) as reservation_value,
    SUM(dkd.click_to_call) as click_to_call
  FROM daily_kpi_data dkd
  CROSS JOIN havet_client hc
  CROSS JOIN config c
  WHERE dkd.client_id = hc.id
    AND dkd.data_source = CASE 
      WHEN c.platform = 'meta' THEN 'meta_api'
      WHEN c.platform = 'google' THEN 'google_ads_api'
      ELSE c.platform
    END
    AND dkd.date >= c.previous_year_start
    AND dkd.date <= c.previous_year_end
  GROUP BY dkd.client_id
)
SELECT 
  source_type,
  period,
  COALESCE(total_spend, 0) as total_spend,
  COALESCE(booking_step_1, 0) as booking_step_1,
  COALESCE(booking_step_2, 0) as booking_step_2,
  COALESCE(booking_step_3, 0) as booking_step_3,
  COALESCE(reservations, 0) as reservations,
  COALESCE(reservation_value, 0) as reservation_value,
  COALESCE(click_to_call, 0) as click_to_call
FROM (
  SELECT * FROM current_smart_cache
  UNION ALL
  SELECT * FROM current_summaries
  UNION ALL
  SELECT * FROM current_daily_kpi
  UNION ALL
  SELECT * FROM previous_summaries
  UNION ALL
  SELECT * FROM previous_daily_kpi
) all_sources
ORDER BY 
  CASE period WHEN 'CURRENT' THEN 0 ELSE 1 END,
  CASE source_type 
    WHEN 'SMART_CACHE' THEN 0
    WHEN 'CAMPAIGN_SUMMARIES' THEN 1
    WHEN 'DAILY_KPI_DATA' THEN 2
    ELSE 3
  END;

-- ============================================================================
-- PART 4: DISCREPANCY DETECTION
-- ============================================================================

WITH config AS (
  SELECT 
    '2026-01-01'::date as current_start_date,
    '2026-01-31'::date as current_end_date,
    'meta'::text as platform
),
havet_client AS (
  SELECT id
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
),
current_sources AS (
  SELECT 
    'SMART_CACHE' as source,
    (cmc.cache_data->>'conversionMetrics')::jsonb->>'booking_step_1'::numeric as booking_step_1,
    (cmc.cache_data->>'conversionMetrics')::jsonb->>'reservations'::numeric as reservations
  FROM current_month_cache cmc
  CROSS JOIN havet_client hc
  CROSS JOIN config c
  WHERE cmc.client_id = hc.id
    AND cmc.period_id = TO_CHAR(c.current_start_date, 'YYYY-MM')
  LIMIT 1
),
current_summaries AS (
  SELECT 
    'CAMPAIGN_SUMMARIES' as source,
    cs.booking_step_1,
    cs.reservations
  FROM campaign_summaries cs
  CROSS JOIN havet_client hc
  CROSS JOIN config c
  WHERE cs.client_id = hc.id
    AND cs.platform = c.platform
    AND cs.summary_date >= c.current_start_date
    AND cs.summary_date <= c.current_end_date
  ORDER BY cs.summary_date DESC
  LIMIT 1
),
current_daily AS (
  SELECT 
    'DAILY_KPI_DATA' as source,
    SUM(dkd.booking_step_1) as booking_step_1,
    SUM(dkd.reservations) as reservations
  FROM daily_kpi_data dkd
  CROSS JOIN havet_client hc
  CROSS JOIN config c
  WHERE dkd.client_id = hc.id
    AND dkd.data_source = CASE 
      WHEN c.platform = 'meta' THEN 'meta_api'
      WHEN c.platform = 'google' THEN 'google_ads_api'
      ELSE c.platform
    END
    AND dkd.date >= c.current_start_date
    AND dkd.date <= c.current_end_date
  GROUP BY dkd.client_id
)
SELECT 
  'DISCREPANCY DETECTION' as audit_type,
  CASE 
    WHEN ABS(COALESCE((SELECT booking_step_1 FROM current_sources WHERE source = 'SMART_CACHE'), 0) - 
             COALESCE((SELECT booking_step_1 FROM current_summaries), 0)) > 0.01 THEN '⚠️ MISMATCH'
    ELSE '✅ MATCH'
  END as booking_step_1_status,
  CASE 
    WHEN ABS(COALESCE((SELECT booking_step_1 FROM current_sources WHERE source = 'SMART_CACHE'), 0) - 
             COALESCE((SELECT booking_step_1 FROM current_daily), 0)) > 0.01 THEN '⚠️ MISMATCH'
    ELSE '✅ MATCH'
  END as booking_step_1_vs_daily,
  CASE 
    WHEN ABS(COALESCE((SELECT reservations FROM current_sources WHERE source = 'SMART_CACHE'), 0) - 
             COALESCE((SELECT reservations FROM current_summaries), 0)) > 0.01 THEN '⚠️ MISMATCH'
    ELSE '✅ MATCH'
  END as reservations_status,
  CASE 
    WHEN ABS(COALESCE((SELECT reservations FROM current_sources WHERE source = 'SMART_CACHE'), 0) - 
             COALESCE((SELECT reservations FROM current_daily), 0)) > 0.01 THEN '⚠️ MISMATCH'
    ELSE '✅ MATCH'
  END as reservations_vs_daily,
  COALESCE((SELECT booking_step_1 FROM current_sources WHERE source = 'SMART_CACHE'), 0) as smart_cache_step1,
  COALESCE((SELECT booking_step_1 FROM current_summaries), 0) as summaries_step1,
  COALESCE((SELECT booking_step_1 FROM current_daily), 0) as daily_step1,
  COALESCE((SELECT reservations FROM current_sources WHERE source = 'SMART_CACHE'), 0) as smart_cache_reservations,
  COALESCE((SELECT reservations FROM current_summaries), 0) as summaries_reservations,
  COALESCE((SELECT reservations FROM current_daily), 0) as daily_reservations;

-- ============================================================================
-- PART 5: YEAR-OVER-YEAR COMPARISON FROM EACH SOURCE
-- ============================================================================

WITH config AS (
  SELECT 
    '2026-01-01'::date as current_start_date,
    '2026-01-31'::date as current_end_date,
    '2025-01-01'::date as previous_year_start,
    '2025-01-31'::date as previous_year_end,
    'meta'::text as platform
),
havet_client AS (
  SELECT id
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
),
current_smart_cache AS (
  SELECT 
    (cmc.cache_data->>'conversionMetrics')::jsonb->>'booking_step_1'::numeric as booking_step_1,
    (cmc.cache_data->>'conversionMetrics')::jsonb->>'booking_step_2'::numeric as booking_step_2,
    (cmc.cache_data->>'conversionMetrics')::jsonb->>'booking_step_3'::numeric as booking_step_3,
    (cmc.cache_data->>'conversionMetrics')::jsonb->>'reservations'::numeric as reservations,
    (cmc.cache_data->>'conversionMetrics')::jsonb->>'reservation_value'::numeric as reservation_value
  FROM current_month_cache cmc
  CROSS JOIN havet_client hc
  CROSS JOIN config c
  WHERE cmc.client_id = hc.id
    AND cmc.period_id = TO_CHAR(c.current_start_date, 'YYYY-MM')
  LIMIT 1
),
current_summaries AS (
  SELECT 
    cs.booking_step_1,
    cs.booking_step_2,
    cs.booking_step_3,
    cs.reservations,
    cs.reservation_value
  FROM campaign_summaries cs
  CROSS JOIN havet_client hc
  CROSS JOIN config c
  WHERE cs.client_id = hc.id
    AND cs.platform = c.platform
    AND cs.summary_date >= c.current_start_date
    AND cs.summary_date <= c.current_end_date
  ORDER BY cs.summary_date DESC
  LIMIT 1
),
previous_summaries AS (
  SELECT 
    cs.booking_step_1,
    cs.booking_step_2,
    cs.booking_step_3,
    cs.reservations,
    cs.reservation_value
  FROM campaign_summaries cs
  CROSS JOIN havet_client hc
  CROSS JOIN config c
  WHERE cs.client_id = hc.id
    AND cs.platform = c.platform
    AND cs.summary_date >= c.previous_year_start
    AND cs.summary_date <= c.previous_year_end
  ORDER BY 
    CASE WHEN cs.summary_date = DATE_TRUNC('month', c.previous_year_start)::date THEN 0 ELSE 1 END,
    cs.summary_date DESC
  LIMIT 1
)
SELECT 
  'YEAR-OVER-YEAR COMPARISON' as comparison_type,
  'SMART_CACHE vs CAMPAIGN_SUMMARIES' as source_comparison,
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
  'YEAR-OVER-YEAR COMPARISON' as comparison_type,
  'CAMPAIGN_SUMMARIES vs CAMPAIGN_SUMMARIES' as source_comparison,
  COALESCE((SELECT booking_step_1 FROM current_summaries), 0) as current_step1,
  COALESCE((SELECT booking_step_1 FROM previous_summaries), 0) as previous_step1,
  CASE 
    WHEN COALESCE((SELECT booking_step_1 FROM previous_summaries), 0) > 0 THEN
      ROUND(((COALESCE((SELECT booking_step_1 FROM current_summaries), 0) - 
              COALESCE((SELECT booking_step_1 FROM previous_summaries), 0)) / 
             COALESCE((SELECT booking_step_1 FROM previous_summaries), 0)::numeric * 100), 2)
    ELSE NULL
  END as step1_yoy_change_percent,
  COALESCE((SELECT reservations FROM current_summaries), 0) as current_reservations,
  COALESCE((SELECT reservations FROM previous_summaries), 0) as previous_reservations,
  CASE 
    WHEN COALESCE((SELECT reservations FROM previous_summaries), 0) > 0 THEN
      ROUND(((COALESCE((SELECT reservations FROM current_summaries), 0) - 
              COALESCE((SELECT reservations FROM previous_summaries), 0)) / 
             COALESCE((SELECT reservations FROM previous_summaries), 0)::numeric * 100), 2)
    ELSE NULL
  END as reservations_yoy_change_percent;

-- ============================================================================
-- PART 6: DATA COMPLETENESS CHECK
-- ============================================================================

WITH config AS (
  SELECT 
    '2026-01-01'::date as current_start_date,
    '2026-01-31'::date as current_end_date,
    '2025-01-01'::date as previous_year_start,
    '2025-01-31'::date as previous_year_end,
    'meta'::text as platform
),
havet_client AS (
  SELECT id
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
)
SELECT 
  'DATA COMPLETENESS CHECK' as audit_type,
  'CURRENT PERIOD' as period,
  CASE WHEN EXISTS (
    SELECT 1 FROM current_month_cache cmc
    CROSS JOIN config c
    WHERE cmc.client_id = (SELECT id FROM havet_client)
      AND cmc.period_id = TO_CHAR(c.current_start_date, 'YYYY-MM')
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as smart_cache_exists,
  CASE WHEN EXISTS (
    SELECT 1 FROM campaign_summaries cs
    CROSS JOIN config c
    WHERE cs.client_id = (SELECT id FROM havet_client)
      AND cs.platform = c.platform
      AND cs.summary_date >= c.current_start_date
      AND cs.summary_date <= c.current_end_date
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as summaries_exists,
  CASE WHEN EXISTS (
    SELECT 1 FROM daily_kpi_data dkd
    CROSS JOIN config c
    WHERE dkd.client_id = (SELECT id FROM havet_client)
      AND dkd.data_source = CASE 
        WHEN c.platform = 'meta' THEN 'meta_api'
        WHEN c.platform = 'google' THEN 'google_ads_api'
        ELSE c.platform
      END
      AND dkd.date >= c.current_start_date
      AND dkd.date <= c.current_end_date
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as daily_kpi_exists
UNION ALL
SELECT 
  'DATA COMPLETENESS CHECK' as audit_type,
  'PREVIOUS YEAR' as period,
  'N/A' as smart_cache_exists,
  CASE WHEN EXISTS (
    SELECT 1 FROM campaign_summaries cs
    CROSS JOIN config c
    WHERE cs.client_id = (SELECT id FROM havet_client)
      AND cs.platform = c.platform
      AND cs.summary_date >= c.previous_year_start
      AND cs.summary_date <= c.previous_year_end
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as summaries_exists,
  CASE WHEN EXISTS (
    SELECT 1 FROM daily_kpi_data dkd
    CROSS JOIN config c
    WHERE dkd.client_id = (SELECT id FROM havet_client)
      AND dkd.data_source = CASE 
        WHEN c.platform = 'meta' THEN 'meta_api'
        WHEN c.platform = 'google' THEN 'google_ads_api'
        ELSE c.platform
      END
      AND dkd.date >= c.previous_year_start
      AND dkd.date <= c.previous_year_end
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as daily_kpi_exists;

-- ============================================================================
-- PART 7: RECOMMENDED SOURCE OF TRUTH
-- ============================================================================

WITH config AS (
  SELECT 
    '2026-01-01'::date as current_start_date,
    '2026-01-31'::date as current_end_date,
    '2025-01-01'::date as previous_year_start,
    '2025-01-31'::date as previous_year_end,
    'meta'::text as platform
),
havet_client AS (
  SELECT id
  FROM clients
  WHERE LOWER(name) LIKE '%havet%'
  LIMIT 1
)
SELECT 
  'RECOMMENDED SOURCE OF TRUTH' as recommendation_type,
  CASE 
    -- If campaign_summaries exists for both periods, use it (most consistent)
    WHEN EXISTS (
      SELECT 1 FROM campaign_summaries cs
      CROSS JOIN config c
      WHERE cs.client_id = (SELECT id FROM havet_client)
        AND cs.platform = c.platform
        AND cs.summary_date >= c.current_start_date
        AND cs.summary_date <= c.current_end_date
    ) AND EXISTS (
      SELECT 1 FROM campaign_summaries cs
      CROSS JOIN config c
      WHERE cs.client_id = (SELECT id FROM havet_client)
        AND cs.platform = c.platform
        AND cs.summary_date >= c.previous_year_start
        AND cs.summary_date <= c.previous_year_end
    ) THEN '✅ USE campaign_summaries (BOTH PERIODS) - Most consistent'
    
    -- If only current period has smart cache, use it for current, summaries for previous
    WHEN EXISTS (
      SELECT 1 FROM current_month_cache cmc
      CROSS JOIN config c
      WHERE cmc.client_id = (SELECT id FROM havet_client)
        AND cmc.period_id = TO_CHAR(c.current_start_date, 'YYYY-MM')
    ) AND EXISTS (
      SELECT 1 FROM campaign_summaries cs
      CROSS JOIN config c
      WHERE cs.client_id = (SELECT id FROM havet_client)
        AND cs.platform = c.platform
        AND cs.summary_date >= c.previous_year_start
        AND cs.summary_date <= c.previous_year_end
    ) THEN '⚠️ USE smart_cache (CURRENT) + campaign_summaries (PREVIOUS) - May have discrepancies'
    
    -- If daily_kpi_data exists for both, use it (most granular)
    WHEN EXISTS (
      SELECT 1 FROM daily_kpi_data dkd
      CROSS JOIN config c
      WHERE dkd.client_id = (SELECT id FROM havet_client)
        AND dkd.data_source = CASE 
          WHEN c.platform = 'meta' THEN 'meta_api'
          WHEN c.platform = 'google' THEN 'google_ads_api'
          ELSE c.platform
        END
        AND dkd.date >= c.current_start_date
        AND dkd.date <= c.current_end_date
    ) AND EXISTS (
      SELECT 1 FROM daily_kpi_data dkd
      CROSS JOIN config c
      WHERE dkd.client_id = (SELECT id FROM havet_client)
        AND dkd.data_source = CASE 
          WHEN c.platform = 'meta' THEN 'meta_api'
          WHEN c.platform = 'google' THEN 'google_ads_api'
          ELSE c.platform
        END
        AND dkd.date >= c.previous_year_start
        AND dkd.date <= c.previous_year_end
    ) THEN '✅ USE daily_kpi_data (BOTH PERIODS) - Most granular and accurate'
    
    ELSE '❌ INSUFFICIENT DATA - Cannot perform reliable comparison'
  END as recommendation,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM campaign_summaries cs
      CROSS JOIN config c
      WHERE cs.client_id = (SELECT id FROM havet_client)
        AND cs.platform = c.platform
        AND cs.summary_date >= c.current_start_date
        AND cs.summary_date <= c.current_end_date
    ) THEN '✅'
    ELSE '❌'
  END as current_summaries_available,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM campaign_summaries cs
      CROSS JOIN config c
      WHERE cs.client_id = (SELECT id FROM havet_client)
        AND cs.platform = c.platform
        AND cs.summary_date >= c.previous_year_start
        AND cs.summary_date <= c.previous_year_end
    ) THEN '✅'
    ELSE '❌'
  END as previous_summaries_available;

