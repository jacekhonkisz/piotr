-- ============================================================================
-- COMPREHENSIVE DATA SOURCE AUDIT - ALL METRICS
-- ============================================================================
-- Purpose: Audit all data sources to identify the REAL source of truth
--          for current period vs previous year comparisons
-- ============================================================================
-- Usage: Replace CLIENT_ID, DATE_RANGE_START, DATE_RANGE_END, and PLATFORM
-- ============================================================================

-- ============================================================================
-- CONFIGURATION - REPLACE THESE VALUES
-- ============================================================================
\set CLIENT_ID 'PASTE_CLIENT_ID_HERE'  -- e.g., '123e4567-e89b-12d3-a456-426614174000'
\set CURRENT_START_DATE '2026-01-01'   -- Current period start
\set CURRENT_END_DATE '2026-01-31'     -- Current period end
\set PLATFORM 'meta'                    -- 'meta' or 'google'
\set PREVIOUS_YEAR_START '2025-01-01'  -- Previous year start (auto-calculated below)
\set PREVIOUS_YEAR_END '2025-01-31'    -- Previous year end (auto-calculated below)

-- ============================================================================
-- PART 1: CURRENT PERIOD DATA SOURCES AUDIT
-- ============================================================================
-- This shows ALL possible sources for current period data

-- 1.1: Smart Cache (current_month_cache / current_week_cache)
-- ============================================================================
SELECT 
  'CURRENT PERIOD - SMART CACHE' as data_source,
  'current_month_cache' as table_name,
  period_id,
  last_updated,
  (cache_data->>'stats')::jsonb->>'totalSpend' as total_spend,
  (cache_data->>'stats')::jsonb->>'totalImpressions' as total_impressions,
  (cache_data->>'stats')::jsonb->>'totalClicks' as total_clicks,
  (cache_data->>'conversionMetrics')::jsonb->>'booking_step_1' as booking_step_1,
  (cache_data->>'conversionMetrics')::jsonb->>'booking_step_2' as booking_step_2,
  (cache_data->>'conversionMetrics')::jsonb->>'booking_step_3' as booking_step_3,
  (cache_data->>'conversionMetrics')::jsonb->>'reservations' as reservations,
  (cache_data->>'conversionMetrics')::jsonb->>'reservation_value' as reservation_value,
  (cache_data->>'conversionMetrics')::jsonb->>'click_to_call' as click_to_call,
  (cache_data->>'conversionMetrics')::jsonb->>'email_contacts' as email_contacts,
  (cache_data->>'fromCache')::boolean as from_cache,
  EXTRACT(EPOCH FROM (NOW() - last_updated)) / 3600 as cache_age_hours
FROM current_month_cache
WHERE client_id = :'CLIENT_ID'
  AND period_id = TO_CHAR(TO_DATE(:'CURRENT_START_DATE', 'YYYY-MM-DD'), 'YYYY-MM')
ORDER BY last_updated DESC
LIMIT 1;

-- 1.2: Weekly Smart Cache (if weekly period)
-- ============================================================================
SELECT 
  'CURRENT PERIOD - WEEKLY SMART CACHE' as data_source,
  'current_week_cache' as table_name,
  period_id,
  last_updated,
  (cache_data->>'stats')::jsonb->>'totalSpend' as total_spend,
  (cache_data->>'stats')::jsonb->>'totalImpressions' as total_impressions,
  (cache_data->>'stats')::jsonb->>'totalClicks' as total_clicks,
  (cache_data->>'conversionMetrics')::jsonb->>'booking_step_1' as booking_step_1,
  (cache_data->>'conversionMetrics')::jsonb->>'booking_step_2' as booking_step_2,
  (cache_data->>'conversionMetrics')::jsonb->>'booking_step_3' as booking_step_3,
  (cache_data->>'conversionMetrics')::jsonb->>'reservations' as reservations,
  (cache_data->>'conversionMetrics')::jsonb->>'reservation_value' as reservation_value,
  (cache_data->>'conversionMetrics')::jsonb->>'click_to_call' as click_to_call,
  (cache_data->>'conversionMetrics')::jsonb->>'email_contacts' as email_contacts,
  (cache_data->>'fromCache')::boolean as from_cache,
  EXTRACT(EPOCH FROM (NOW() - last_updated)) / 3600 as cache_age_hours
FROM current_week_cache
WHERE client_id = :'CLIENT_ID'
  AND period_id LIKE TO_CHAR(TO_DATE(:'CURRENT_START_DATE', 'YYYY-MM-DD'), 'YYYY') || '-W%'
ORDER BY last_updated DESC
LIMIT 1;

-- 1.3: campaign_summaries (Historical Database)
-- ============================================================================
SELECT 
  'CURRENT PERIOD - CAMPAIGN_SUMMARIES' as data_source,
  'campaign_summaries' as table_name,
  summary_type,
  summary_date,
  platform,
  last_updated,
  total_spend,
  total_impressions,
  total_clicks,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  click_to_call,
  email_contacts,
  data_source as stored_data_source,
  CASE 
    WHEN summary_date >= DATE_TRUNC('month', CURRENT_DATE) THEN 'CURRENT_MONTH'
    WHEN summary_date >= DATE_TRUNC('week', CURRENT_DATE) THEN 'CURRENT_WEEK'
    ELSE 'HISTORICAL'
  END as period_type
FROM campaign_summaries
WHERE client_id = :'CLIENT_ID'
  AND platform = :'PLATFORM'
  AND summary_date >= :'CURRENT_START_DATE'
  AND summary_date <= :'CURRENT_END_DATE'
ORDER BY summary_date DESC, last_updated DESC;

-- 1.4: daily_kpi_data (Most Granular Source)
-- ============================================================================
SELECT 
  'CURRENT PERIOD - DAILY_KPI_DATA' as data_source,
  'daily_kpi_data' as table_name,
  COUNT(*) as days_count,
  MIN(date) as first_date,
  MAX(date) as last_date,
  SUM(total_spend) as total_spend,
  SUM(total_impressions) as total_impressions,
  SUM(total_clicks) as total_clicks,
  SUM(booking_step_1) as booking_step_1,
  SUM(booking_step_2) as booking_step_2,
  SUM(booking_step_3) as booking_step_3,
  SUM(reservations) as reservations,
  SUM(reservation_value) as reservation_value,
  SUM(click_to_call) as click_to_call,
  SUM(email_contacts) as email_contacts,
  MIN(date) as earliest_record,
  MAX(date) as latest_record,
  MAX(updated_at) as last_updated
FROM daily_kpi_data
WHERE client_id = :'CLIENT_ID'
  AND data_source = CASE 
    WHEN :'PLATFORM' = 'meta' THEN 'meta_api'
    WHEN :'PLATFORM' = 'google' THEN 'google_ads_api'
    ELSE :'PLATFORM'
  END
  AND date >= :'CURRENT_START_DATE'
  AND date <= :'CURRENT_END_DATE';

-- 1.5: campaigns table (Individual Campaign Data)
-- ============================================================================
SELECT 
  'CURRENT PERIOD - CAMPAIGNS TABLE' as data_source,
  'campaigns' as table_name,
  COUNT(*) as campaign_count,
  SUM(spend) as total_spend,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(conversions) as total_conversions,
  MIN(date_range_start) as earliest_campaign,
  MAX(date_range_end) as latest_campaign
FROM campaigns
WHERE client_id = :'CLIENT_ID'
  AND platform = :'PLATFORM'
  AND date_range_start >= :'CURRENT_START_DATE'
  AND date_range_end <= :'CURRENT_END_DATE';

-- ============================================================================
-- PART 2: PREVIOUS YEAR DATA SOURCES AUDIT
-- ============================================================================

-- 2.1: campaign_summaries (Previous Year)
-- ============================================================================
SELECT 
  'PREVIOUS YEAR - CAMPAIGN_SUMMARIES' as data_source,
  'campaign_summaries' as table_name,
  summary_type,
  summary_date,
  platform,
  last_updated,
  total_spend,
  total_impressions,
  total_clicks,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  click_to_call,
  email_contacts,
  data_source as stored_data_source,
  'HISTORICAL' as period_type,
  CASE 
    WHEN summary_date = DATE_TRUNC('month', TO_DATE(:'PREVIOUS_YEAR_START', 'YYYY-MM-DD'))::date THEN 'FIRST_OF_MONTH'
    ELSE 'OTHER'
  END as date_type
FROM campaign_summaries
WHERE client_id = :'CLIENT_ID'
  AND platform = :'PLATFORM'
  AND summary_date >= :'PREVIOUS_YEAR_START'
  AND summary_date <= :'PREVIOUS_YEAR_END'
ORDER BY 
  CASE WHEN summary_date = DATE_TRUNC('month', TO_DATE(:'PREVIOUS_YEAR_START', 'YYYY-MM-DD'))::date THEN 0 ELSE 1 END,
  summary_date DESC,
  last_updated DESC;

-- 2.2: daily_kpi_data (Previous Year)
-- ============================================================================
SELECT 
  'PREVIOUS YEAR - DAILY_KPI_DATA' as data_source,
  'daily_kpi_data' as table_name,
  COUNT(*) as days_count,
  MIN(date) as first_date,
  MAX(date) as last_date,
  SUM(total_spend) as total_spend,
  SUM(total_impressions) as total_impressions,
  SUM(total_clicks) as total_clicks,
  SUM(booking_step_1) as booking_step_1,
  SUM(booking_step_2) as booking_step_2,
  SUM(booking_step_3) as booking_step_3,
  SUM(reservations) as reservations,
  SUM(reservation_value) as reservation_value,
  SUM(click_to_call) as click_to_call,
  SUM(email_contacts) as email_contacts,
  MIN(date) as earliest_record,
  MAX(date) as latest_record,
  MAX(updated_at) as last_updated
FROM daily_kpi_data
WHERE client_id = :'CLIENT_ID'
  AND data_source = CASE 
    WHEN :'PLATFORM' = 'meta' THEN 'meta_api'
    WHEN :'PLATFORM' = 'google' THEN 'google_ads_api'
    ELSE :'PLATFORM'
  END
  AND date >= :'PREVIOUS_YEAR_START'
  AND date <= :'PREVIOUS_YEAR_END';

-- ============================================================================
-- PART 3: COMPREHENSIVE COMPARISON - ALL SOURCES SIDE BY SIDE
-- ============================================================================
-- This shows current period vs previous year from ALL sources

WITH current_smart_cache AS (
  SELECT 
    'SMART_CACHE' as source_type,
    'CURRENT' as period,
    (cache_data->>'stats')::jsonb->>'totalSpend'::numeric as total_spend,
    (cache_data->>'conversionMetrics')::jsonb->>'booking_step_1'::numeric as booking_step_1,
    (cache_data->>'conversionMetrics')::jsonb->>'booking_step_2'::numeric as booking_step_2,
    (cache_data->>'conversionMetrics')::jsonb->>'booking_step_3'::numeric as booking_step_3,
    (cache_data->>'conversionMetrics')::jsonb->>'reservations'::numeric as reservations,
    (cache_data->>'conversionMetrics')::jsonb->>'reservation_value'::numeric as reservation_value,
    (cache_data->>'conversionMetrics')::jsonb->>'click_to_call'::numeric as click_to_call
  FROM current_month_cache
  WHERE client_id = :'CLIENT_ID'
    AND period_id = TO_CHAR(TO_DATE(:'CURRENT_START_DATE', 'YYYY-MM-DD'), 'YYYY-MM')
  ORDER BY last_updated DESC
  LIMIT 1
),
current_summaries AS (
  SELECT 
    'CAMPAIGN_SUMMARIES' as source_type,
    'CURRENT' as period,
    total_spend,
    booking_step_1,
    booking_step_2,
    booking_step_3,
    reservations,
    reservation_value,
    click_to_call
  FROM campaign_summaries
  WHERE client_id = :'CLIENT_ID'
    AND platform = :'PLATFORM'
    AND summary_date >= :'CURRENT_START_DATE'
    AND summary_date <= :'CURRENT_END_DATE'
  ORDER BY summary_date DESC, last_updated DESC
  LIMIT 1
),
current_daily_kpi AS (
  SELECT 
    'DAILY_KPI_DATA' as source_type,
    'CURRENT' as period,
    SUM(total_spend) as total_spend,
    SUM(booking_step_1) as booking_step_1,
    SUM(booking_step_2) as booking_step_2,
    SUM(booking_step_3) as booking_step_3,
    SUM(reservations) as reservations,
    SUM(reservation_value) as reservation_value,
    SUM(click_to_call) as click_to_call
  FROM daily_kpi_data
  WHERE client_id = :'CLIENT_ID'
    AND data_source = CASE 
      WHEN :'PLATFORM' = 'meta' THEN 'meta_api'
      WHEN :'PLATFORM' = 'google' THEN 'google_ads_api'
      ELSE :'PLATFORM'
    END
    AND date >= :'CURRENT_START_DATE'
    AND date <= :'CURRENT_END_DATE'
),
previous_summaries AS (
  SELECT 
    'CAMPAIGN_SUMMARIES' as source_type,
    'PREVIOUS_YEAR' as period,
    total_spend,
    booking_step_1,
    booking_step_2,
    booking_step_3,
    reservations,
    reservation_value,
    click_to_call
  FROM campaign_summaries
  WHERE client_id = :'CLIENT_ID'
    AND platform = :'PLATFORM'
    AND summary_date >= :'PREVIOUS_YEAR_START'
    AND summary_date <= :'PREVIOUS_YEAR_END'
  ORDER BY 
    CASE WHEN summary_date = DATE_TRUNC('month', TO_DATE(:'PREVIOUS_YEAR_START', 'YYYY-MM-DD'))::date THEN 0 ELSE 1 END,
    summary_date DESC
  LIMIT 1
),
previous_daily_kpi AS (
  SELECT 
    'DAILY_KPI_DATA' as source_type,
    'PREVIOUS_YEAR' as period,
    SUM(total_spend) as total_spend,
    SUM(booking_step_1) as booking_step_1,
    SUM(booking_step_2) as booking_step_2,
    SUM(booking_step_3) as booking_step_3,
    SUM(reservations) as reservations,
    SUM(reservation_value) as reservation_value,
    SUM(click_to_call) as click_to_call
  FROM daily_kpi_data
  WHERE client_id = :'CLIENT_ID'
    AND data_source = CASE 
      WHEN :'PLATFORM' = 'meta' THEN 'meta_api'
      WHEN :'PLATFORM' = 'google' THEN 'google_ads_api'
      ELSE :'PLATFORM'
    END
    AND date >= :'PREVIOUS_YEAR_START'
    AND date <= :'PREVIOUS_YEAR_END'
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
-- Identifies differences between data sources

WITH current_sources AS (
  SELECT 
    'SMART_CACHE' as source,
    (cache_data->>'conversionMetrics')::jsonb->>'booking_step_1'::numeric as booking_step_1,
    (cache_data->>'conversionMetrics')::jsonb->>'reservations'::numeric as reservations
  FROM current_month_cache
  WHERE client_id = :'CLIENT_ID'
    AND period_id = TO_CHAR(TO_DATE(:'CURRENT_START_DATE', 'YYYY-MM-DD'), 'YYYY-MM')
  LIMIT 1
),
current_summaries AS (
  SELECT 
    'CAMPAIGN_SUMMARIES' as source,
    booking_step_1,
    reservations
  FROM campaign_summaries
  WHERE client_id = :'CLIENT_ID'
    AND platform = :'PLATFORM'
    AND summary_date >= :'CURRENT_START_DATE'
    AND summary_date <= :'CURRENT_END_DATE'
  ORDER BY summary_date DESC
  LIMIT 1
),
current_daily AS (
  SELECT 
    'DAILY_KPI_DATA' as source,
    SUM(booking_step_1) as booking_step_1,
    SUM(reservations) as reservations
  FROM daily_kpi_data
  WHERE client_id = :'CLIENT_ID'
    AND data_source = CASE 
      WHEN :'PLATFORM' = 'meta' THEN 'meta_api'
      WHEN :'PLATFORM' = 'google' THEN 'google_ads_api'
      ELSE :'PLATFORM'
    END
    AND date >= :'CURRENT_START_DATE'
    AND date <= :'CURRENT_END_DATE'
  GROUP BY source
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

WITH current_smart_cache AS (
  SELECT 
    (cache_data->>'conversionMetrics')::jsonb->>'booking_step_1'::numeric as booking_step_1,
    (cache_data->>'conversionMetrics')::jsonb->>'booking_step_2'::numeric as booking_step_2,
    (cache_data->>'conversionMetrics')::jsonb->>'booking_step_3'::numeric as booking_step_3,
    (cache_data->>'conversionMetrics')::jsonb->>'reservations'::numeric as reservations,
    (cache_data->>'conversionMetrics')::jsonb->>'reservation_value'::numeric as reservation_value
  FROM current_month_cache
  WHERE client_id = :'CLIENT_ID'
    AND period_id = TO_CHAR(TO_DATE(:'CURRENT_START_DATE', 'YYYY-MM-DD'), 'YYYY-MM')
  LIMIT 1
),
current_summaries AS (
  SELECT 
    booking_step_1,
    booking_step_2,
    booking_step_3,
    reservations,
    reservation_value
  FROM campaign_summaries
  WHERE client_id = :'CLIENT_ID'
    AND platform = :'PLATFORM'
    AND summary_date >= :'CURRENT_START_DATE'
    AND summary_date <= :'CURRENT_END_DATE'
  ORDER BY summary_date DESC
  LIMIT 1
),
previous_summaries AS (
  SELECT 
    booking_step_1,
    booking_step_2,
    booking_step_3,
    reservations,
    reservation_value
  FROM campaign_summaries
  WHERE client_id = :'CLIENT_ID'
    AND platform = :'PLATFORM'
    AND summary_date >= :'PREVIOUS_YEAR_START'
    AND summary_date <= :'PREVIOUS_YEAR_END'
  ORDER BY 
    CASE WHEN summary_date = DATE_TRUNC('month', TO_DATE(:'PREVIOUS_YEAR_START', 'YYYY-MM-DD'))::date THEN 0 ELSE 1 END,
    summary_date DESC
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
-- Verifies which sources have complete data

SELECT 
  'DATA COMPLETENESS CHECK' as audit_type,
  'CURRENT PERIOD' as period,
  CASE WHEN EXISTS (
    SELECT 1 FROM current_month_cache 
    WHERE client_id = :'CLIENT_ID'
      AND period_id = TO_CHAR(TO_DATE(:'CURRENT_START_DATE', 'YYYY-MM-DD'), 'YYYY-MM')
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as smart_cache_exists,
  CASE WHEN EXISTS (
    SELECT 1 FROM campaign_summaries 
    WHERE client_id = :'CLIENT_ID'
      AND platform = :'PLATFORM'
      AND summary_date >= :'CURRENT_START_DATE'
      AND summary_date <= :'CURRENT_END_DATE'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as summaries_exists,
  CASE WHEN EXISTS (
    SELECT 1 FROM daily_kpi_data 
    WHERE client_id = :'CLIENT_ID'
      AND data_source = CASE 
        WHEN :'PLATFORM' = 'meta' THEN 'meta_api'
        WHEN :'PLATFORM' = 'google' THEN 'google_ads_api'
        ELSE :'PLATFORM'
      END
      AND date >= :'CURRENT_START_DATE'
      AND date <= :'CURRENT_END_DATE'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as daily_kpi_exists
UNION ALL
SELECT 
  'DATA COMPLETENESS CHECK' as audit_type,
  'PREVIOUS YEAR' as period,
  'N/A' as smart_cache_exists,
  CASE WHEN EXISTS (
    SELECT 1 FROM campaign_summaries 
    WHERE client_id = :'CLIENT_ID'
      AND platform = :'PLATFORM'
      AND summary_date >= :'PREVIOUS_YEAR_START'
      AND summary_date <= :'PREVIOUS_YEAR_END'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as summaries_exists,
  CASE WHEN EXISTS (
    SELECT 1 FROM daily_kpi_data 
    WHERE client_id = :'CLIENT_ID'
      AND data_source = CASE 
        WHEN :'PLATFORM' = 'meta' THEN 'meta_api'
        WHEN :'PLATFORM' = 'google' THEN 'google_ads_api'
        ELSE :'PLATFORM'
      END
      AND date >= :'PREVIOUS_YEAR_START'
      AND date <= :'PREVIOUS_YEAR_END'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as daily_kpi_exists;

-- ============================================================================
-- PART 7: RECOMMENDED SOURCE OF TRUTH
-- ============================================================================
-- Determines which source should be used for year-over-year comparison

SELECT 
  'RECOMMENDED SOURCE OF TRUTH' as recommendation_type,
  CASE 
    -- If campaign_summaries exists for both periods, use it (most consistent)
    WHEN EXISTS (
      SELECT 1 FROM campaign_summaries 
      WHERE client_id = :'CLIENT_ID'
        AND platform = :'PLATFORM'
        AND summary_date >= :'CURRENT_START_DATE'
        AND summary_date <= :'CURRENT_END_DATE'
    ) AND EXISTS (
      SELECT 1 FROM campaign_summaries 
      WHERE client_id = :'CLIENT_ID'
        AND platform = :'PLATFORM'
        AND summary_date >= :'PREVIOUS_YEAR_START'
        AND summary_date <= :'PREVIOUS_YEAR_END'
    ) THEN '✅ USE campaign_summaries (BOTH PERIODS) - Most consistent'
    
    -- If only current period has smart cache, use it for current, summaries for previous
    WHEN EXISTS (
      SELECT 1 FROM current_month_cache 
      WHERE client_id = :'CLIENT_ID'
        AND period_id = TO_CHAR(TO_DATE(:'CURRENT_START_DATE', 'YYYY-MM-DD'), 'YYYY-MM')
    ) AND EXISTS (
      SELECT 1 FROM campaign_summaries 
      WHERE client_id = :'CLIENT_ID'
        AND platform = :'PLATFORM'
        AND summary_date >= :'PREVIOUS_YEAR_START'
        AND summary_date <= :'PREVIOUS_YEAR_END'
    ) THEN '⚠️ USE smart_cache (CURRENT) + campaign_summaries (PREVIOUS) - May have discrepancies'
    
    -- If daily_kpi_data exists for both, use it (most granular)
    WHEN EXISTS (
      SELECT 1 FROM daily_kpi_data 
      WHERE client_id = :'CLIENT_ID'
        AND data_source = CASE 
          WHEN :'PLATFORM' = 'meta' THEN 'meta_api'
          WHEN :'PLATFORM' = 'google' THEN 'google_ads_api'
          ELSE :'PLATFORM'
        END
        AND date >= :'CURRENT_START_DATE'
        AND date <= :'CURRENT_END_DATE'
    ) AND EXISTS (
      SELECT 1 FROM daily_kpi_data 
      WHERE client_id = :'CLIENT_ID'
        AND data_source = CASE 
          WHEN :'PLATFORM' = 'meta' THEN 'meta_api'
          WHEN :'PLATFORM' = 'google' THEN 'google_ads_api'
          ELSE :'PLATFORM'
        END
        AND date >= :'PREVIOUS_YEAR_START'
        AND date <= :'PREVIOUS_YEAR_END'
    ) THEN '✅ USE daily_kpi_data (BOTH PERIODS) - Most granular and accurate'
    
    ELSE '❌ INSUFFICIENT DATA - Cannot perform reliable comparison'
  END as recommendation,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM campaign_summaries 
      WHERE client_id = :'CLIENT_ID'
        AND platform = :'PLATFORM'
        AND summary_date >= :'CURRENT_START_DATE'
        AND summary_date <= :'CURRENT_END_DATE'
    ) THEN '✅'
    ELSE '❌'
  END as current_summaries_available,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM campaign_summaries 
      WHERE client_id = :'CLIENT_ID'
        AND platform = :'PLATFORM'
        AND summary_date >= :'PREVIOUS_YEAR_START'
        AND summary_date <= :'PREVIOUS_YEAR_END'
    ) THEN '✅'
    ELSE '❌'
  END as previous_summaries_available;

-- ============================================================================
-- END OF AUDIT
-- ============================================================================

