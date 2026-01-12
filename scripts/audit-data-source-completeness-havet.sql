-- ============================================================================
-- DATA SOURCE COMPLETENESS AUDIT - HAVET
-- ============================================================================
-- Checks if sources exist AND have actual records with data
-- ============================================================================
-- Change dates: 2026-01, 2026-01-01, 2025-01-01
-- ============================================================================

-- ============================================================================
-- CURRENT PERIOD AUDIT
-- ============================================================================

-- 1. Smart Cache - Check if exists and has data
SELECT 
  'CURRENT - SMART CACHE' as source,
  CASE WHEN EXISTS (
    SELECT 1 FROM current_month_cache
    WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
      AND period_id = '2026-01'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as exists_status,
  COUNT(*) as record_count,
  COUNT(CASE WHEN cache_data IS NOT NULL THEN 1 END) as records_with_data,
  COUNT(CASE WHEN (cache_data->'stats'->>'totalSpend')::numeric > 0 THEN 1 END) as records_with_spend,
  COUNT(CASE WHEN (cache_data->'conversionMetrics'->>'booking_step_1')::numeric > 0 THEN 1 END) as records_with_step1,
  MAX(last_updated) as latest_update,
  MIN(last_updated) as earliest_update
FROM current_month_cache
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND period_id = '2026-01';

-- 2. campaign_summaries - Current Period
SELECT 
  'CURRENT - CAMPAIGN_SUMMARIES' as source,
  CASE WHEN EXISTS (
    SELECT 1 FROM campaign_summaries
    WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
      AND platform = 'meta'
      AND summary_date >= '2026-01-01'
      AND summary_date <= '2026-01-31'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as exists_status,
  COUNT(*) as record_count,
  COUNT(CASE WHEN total_spend > 0 THEN 1 END) as records_with_spend,
  COUNT(CASE WHEN booking_step_1 > 0 THEN 1 END) as records_with_step1,
  COUNT(CASE WHEN reservations > 0 THEN 1 END) as records_with_reservations,
  COUNT(CASE WHEN booking_step_1 IS NULL THEN 1 END) as records_null_step1,
  COUNT(CASE WHEN reservations IS NULL THEN 1 END) as records_null_reservations,
  MIN(summary_date) as earliest_date,
  MAX(summary_date) as latest_date,
  MAX(last_updated) as latest_update
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND platform = 'meta'
  AND summary_date >= '2026-01-01'
  AND summary_date <= '2026-01-31';

-- 3. daily_kpi_data - Current Period
SELECT 
  'CURRENT - DAILY_KPI_DATA' as source,
  CASE WHEN EXISTS (
    SELECT 1 FROM daily_kpi_data
    WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
      AND data_source = 'meta_api'
      AND date >= '2026-01-01'
      AND date <= '2026-01-31'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as exists_status,
  COUNT(*) as record_count,
  COUNT(DISTINCT date) as unique_dates,
  COUNT(CASE WHEN total_spend > 0 THEN 1 END) as records_with_spend,
  COUNT(CASE WHEN booking_step_1 > 0 THEN 1 END) as records_with_step1,
  COUNT(CASE WHEN reservations > 0 THEN 1 END) as records_with_reservations,
  COUNT(CASE WHEN booking_step_1 IS NULL THEN 1 END) as records_null_step1,
  COUNT(CASE WHEN reservations IS NULL THEN 1 END) as records_null_reservations,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  MAX(updated_at) as latest_update,
  -- Check for gaps
  (DATE '2026-01-31' - DATE '2026-01-01' + 1) - COUNT(DISTINCT date) as missing_days
FROM daily_kpi_data
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND data_source = 'meta_api'
  AND date >= '2026-01-01'
  AND date <= '2026-01-31';

-- ============================================================================
-- PREVIOUS YEAR AUDIT
-- ============================================================================

-- 4. campaign_summaries - Previous Year
SELECT 
  'PREVIOUS YEAR - CAMPAIGN_SUMMARIES' as source,
  CASE WHEN EXISTS (
    SELECT 1 FROM campaign_summaries
    WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
      AND platform = 'meta'
      AND summary_date >= '2025-01-01'
      AND summary_date <= '2025-01-31'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as exists_status,
  COUNT(*) as record_count,
  COUNT(CASE WHEN total_spend > 0 THEN 1 END) as records_with_spend,
  COUNT(CASE WHEN booking_step_1 > 0 THEN 1 END) as records_with_step1,
  COUNT(CASE WHEN reservations > 0 THEN 1 END) as records_with_reservations,
  COUNT(CASE WHEN booking_step_1 IS NULL THEN 1 END) as records_null_step1,
  COUNT(CASE WHEN reservations IS NULL THEN 1 END) as records_null_reservations,
  COUNT(CASE WHEN booking_step_1 = 0 AND total_spend > 0 THEN 1 END) as records_zero_step1_but_has_spend,
  MIN(summary_date) as earliest_date,
  MAX(summary_date) as latest_date,
  MAX(last_updated) as latest_update,
  -- Show all summary dates found
  STRING_AGG(DISTINCT summary_date::text, ', ' ORDER BY summary_date::text) as all_summary_dates
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND platform = 'meta'
  AND summary_date >= '2025-01-01'
  AND summary_date <= '2025-01-31';

-- 5. daily_kpi_data - Previous Year
SELECT 
  'PREVIOUS YEAR - DAILY_KPI_DATA' as source,
  CASE WHEN EXISTS (
    SELECT 1 FROM daily_kpi_data
    WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
      AND data_source = 'meta_api'
      AND date >= '2025-01-01'
      AND date <= '2025-01-31'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as exists_status,
  COUNT(*) as record_count,
  COUNT(DISTINCT date) as unique_dates,
  COUNT(CASE WHEN total_spend > 0 THEN 1 END) as records_with_spend,
  COUNT(CASE WHEN booking_step_1 > 0 THEN 1 END) as records_with_step1,
  COUNT(CASE WHEN reservations > 0 THEN 1 END) as records_with_reservations,
  COUNT(CASE WHEN booking_step_1 IS NULL THEN 1 END) as records_null_step1,
  COUNT(CASE WHEN reservations IS NULL THEN 1 END) as records_null_reservations,
  COUNT(CASE WHEN booking_step_1 = 0 AND total_spend > 0 THEN 1 END) as records_zero_step1_but_has_spend,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  MAX(updated_at) as latest_update,
  -- Check for gaps
  (DATE '2025-01-31' - DATE '2025-01-01' + 1) - COUNT(DISTINCT date) as missing_days,
  -- Show date range coverage
  CASE 
    WHEN COUNT(DISTINCT date) = 0 THEN '❌ NO DATA'
    WHEN COUNT(DISTINCT date) < (DATE '2025-01-31' - DATE '2025-01-01' + 1) THEN '⚠️ INCOMPLETE'
    ELSE '✅ COMPLETE'
  END as coverage_status
FROM daily_kpi_data
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND data_source = 'meta_api'
  AND date >= '2025-01-01'
  AND date <= '2025-01-31';

-- ============================================================================
-- SUMMARY - All Sources Status
-- ============================================================================

SELECT 
  'SUMMARY - ALL SOURCES' as audit_type,
  'CURRENT PERIOD' as period,
  CASE WHEN EXISTS (
    SELECT 1 FROM current_month_cache
    WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
      AND period_id = '2026-01'
  ) THEN '✅' ELSE '❌' END as smart_cache,
  CASE WHEN EXISTS (
    SELECT 1 FROM campaign_summaries
    WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
      AND platform = 'meta'
      AND summary_date >= '2026-01-01'
      AND summary_date <= '2026-01-31'
  ) THEN '✅' ELSE '❌' END as summaries,
  CASE WHEN EXISTS (
    SELECT 1 FROM daily_kpi_data
    WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
      AND data_source = 'meta_api'
      AND date >= '2026-01-01'
      AND date <= '2026-01-31'
  ) THEN '✅' ELSE '❌' END as daily_kpi,
  (SELECT COUNT(*) FROM current_month_cache
   WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
     AND period_id = '2026-01') as smart_cache_count,
  (SELECT COUNT(*) FROM campaign_summaries
   WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
     AND platform = 'meta'
     AND summary_date >= '2026-01-01'
     AND summary_date <= '2026-01-31') as summaries_count,
  (SELECT COUNT(*) FROM daily_kpi_data
   WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
     AND data_source = 'meta_api'
     AND date >= '2026-01-01'
     AND date <= '2026-01-31') as daily_kpi_count
UNION ALL
SELECT 
  'SUMMARY - ALL SOURCES' as audit_type,
  'PREVIOUS YEAR' as period,
  'N/A' as smart_cache,
  CASE WHEN EXISTS (
    SELECT 1 FROM campaign_summaries
    WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
      AND platform = 'meta'
      AND summary_date >= '2025-01-01'
      AND summary_date <= '2025-01-31'
  ) THEN '✅' ELSE '❌' END as summaries,
  CASE WHEN EXISTS (
    SELECT 1 FROM daily_kpi_data
    WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
      AND data_source = 'meta_api'
      AND date >= '2025-01-01'
      AND date <= '2025-01-31'
  ) THEN '✅' ELSE '❌' END as daily_kpi,
  0 as smart_cache_count,
  (SELECT COUNT(*) FROM campaign_summaries
   WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
     AND platform = 'meta'
     AND summary_date >= '2025-01-01'
     AND summary_date <= '2025-01-31') as summaries_count,
  (SELECT COUNT(*) FROM daily_kpi_data
   WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
     AND data_source = 'meta_api'
     AND date >= '2025-01-01'
     AND date <= '2025-01-31') as daily_kpi_count;

-- ============================================================================
-- DATA QUALITY CHECK - Records with NULL or Zero Values
-- ============================================================================

-- Check for records that exist but have NULL or zero values when they shouldn't
SELECT 
  'DATA QUALITY - NULL/ZERO CHECK' as audit_type,
  'CURRENT - CAMPAIGN_SUMMARIES' as source,
  COUNT(*) as total_records,
  COUNT(CASE WHEN booking_step_1 IS NULL THEN 1 END) as null_step1,
  COUNT(CASE WHEN booking_step_1 = 0 AND total_spend > 0 THEN 1 END) as zero_step1_but_has_spend,
  COUNT(CASE WHEN reservations IS NULL THEN 1 END) as null_reservations,
  COUNT(CASE WHEN reservations = 0 AND total_spend > 0 THEN 1 END) as zero_reservations_but_has_spend,
  COUNT(CASE WHEN booking_step_1 IS NULL AND booking_step_2 IS NULL AND booking_step_3 IS NULL THEN 1 END) as all_steps_null
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND platform = 'meta'
  AND summary_date >= '2026-01-01'
  AND summary_date <= '2026-01-31'
UNION ALL
SELECT 
  'DATA QUALITY - NULL/ZERO CHECK' as audit_type,
  'PREVIOUS YEAR - CAMPAIGN_SUMMARIES' as source,
  COUNT(*) as total_records,
  COUNT(CASE WHEN booking_step_1 IS NULL THEN 1 END) as null_step1,
  COUNT(CASE WHEN booking_step_1 = 0 AND total_spend > 0 THEN 1 END) as zero_step1_but_has_spend,
  COUNT(CASE WHEN reservations IS NULL THEN 1 END) as null_reservations,
  COUNT(CASE WHEN reservations = 0 AND total_spend > 0 THEN 1 END) as zero_reservations_but_has_spend,
  COUNT(CASE WHEN booking_step_1 IS NULL AND booking_step_2 IS NULL AND booking_step_3 IS NULL THEN 1 END) as all_steps_null
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND platform = 'meta'
  AND summary_date >= '2025-01-01'
  AND summary_date <= '2025-01-31'
UNION ALL
SELECT 
  'DATA QUALITY - NULL/ZERO CHECK' as audit_type,
  'CURRENT - DAILY_KPI_DATA' as source,
  COUNT(*) as total_records,
  COUNT(CASE WHEN booking_step_1 IS NULL THEN 1 END) as null_step1,
  COUNT(CASE WHEN booking_step_1 = 0 AND total_spend > 0 THEN 1 END) as zero_step1_but_has_spend,
  COUNT(CASE WHEN reservations IS NULL THEN 1 END) as null_reservations,
  COUNT(CASE WHEN reservations = 0 AND total_spend > 0 THEN 1 END) as zero_reservations_but_has_spend,
  COUNT(CASE WHEN booking_step_1 IS NULL AND booking_step_2 IS NULL AND booking_step_3 IS NULL THEN 1 END) as all_steps_null
FROM daily_kpi_data
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND data_source = 'meta_api'
  AND date >= '2026-01-01'
  AND date <= '2026-01-31'
UNION ALL
SELECT 
  'DATA QUALITY - NULL/ZERO CHECK' as audit_type,
  'PREVIOUS YEAR - DAILY_KPI_DATA' as source,
  COUNT(*) as total_records,
  COUNT(CASE WHEN booking_step_1 IS NULL THEN 1 END) as null_step1,
  COUNT(CASE WHEN booking_step_1 = 0 AND total_spend > 0 THEN 1 END) as zero_step1_but_has_spend,
  COUNT(CASE WHEN reservations IS NULL THEN 1 END) as null_reservations,
  COUNT(CASE WHEN reservations = 0 AND total_spend > 0 THEN 1 END) as zero_reservations_but_has_spend,
  COUNT(CASE WHEN booking_step_1 IS NULL AND booking_step_2 IS NULL AND booking_step_3 IS NULL THEN 1 END) as all_steps_null
FROM daily_kpi_data
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND data_source = 'meta_api'
  AND date >= '2025-01-01'
  AND date <= '2025-01-31';

