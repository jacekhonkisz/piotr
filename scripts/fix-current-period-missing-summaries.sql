-- ============================================================================
-- FIX: Current Period Missing in campaign_summaries
-- ============================================================================
-- This query checks if current period should be archived to campaign_summaries
-- ============================================================================

-- Check if current month should have campaign_summaries entry
SELECT 
  'CURRENT PERIOD STATUS CHECK' as check_type,
  TO_CHAR(CURRENT_DATE, 'YYYY-MM') as current_month,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM campaign_summaries
      WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
        AND platform = 'meta'
        AND summary_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND summary_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING - NEEDS ARCHIVAL'
  END as campaign_summaries_status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM current_month_cache
      WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
        AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as smart_cache_status,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM daily_kpi_data
      WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
        AND data_source = 'meta_api'
        AND date >= DATE_TRUNC('month', CURRENT_DATE)
        AND date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as daily_kpi_status,
  -- Recommendation
  CASE 
    WHEN NOT EXISTS (
      SELECT 1 FROM campaign_summaries
      WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
        AND platform = 'meta'
        AND summary_date >= DATE_TRUNC('month', CURRENT_DATE)
        AND summary_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    ) THEN '⚠️ ACTION REQUIRED: Run background collection to archive current month'
    ELSE '✅ OK - Current month archived'
  END as recommendation;

-- Show what data exists that could be archived
SELECT 
  'DATA AVAILABLE FOR ARCHIVAL' as check_type,
  'Smart Cache' as source,
  period_id,
  last_updated,
  (cache_data->'stats'->>'totalSpend')::numeric as total_spend,
  (cache_data->'conversionMetrics'->>'booking_step_1')::numeric as booking_step_1,
  (cache_data->'conversionMetrics'->>'reservations')::numeric as reservations
FROM current_month_cache
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
ORDER BY last_updated DESC
LIMIT 1

UNION ALL

SELECT 
  'DATA AVAILABLE FOR ARCHIVAL' as check_type,
  'Daily KPI Data (Aggregated)' as source,
  TO_CHAR(CURRENT_DATE, 'YYYY-MM') as period_id,
  MAX(updated_at) as last_updated,
  SUM(total_spend) as total_spend,
  SUM(booking_step_1) as booking_step_1,
  SUM(reservations) as reservations
FROM daily_kpi_data
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND data_source = 'meta_api'
  AND date >= DATE_TRUNC('month', CURRENT_DATE)
  AND date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
GROUP BY client_id;

