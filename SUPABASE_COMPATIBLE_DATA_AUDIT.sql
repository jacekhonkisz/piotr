-- ============================================================================
-- COMPREHENSIVE DATA AUDIT FOR ALL CLIENTS - SUPABASE COMPATIBLE
-- ============================================================================
-- Purpose: Audit all client data across all months to identify gaps
-- Date: October 1, 2025
-- Safety: 100% safe - read-only queries only
-- Compatible with: Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. CLIENT OVERVIEW
-- ============================================================================
SELECT 
  '📊 CLIENT OVERVIEW' as report_section,
  id as client_id,
  name as client_name,
  email,
  api_status,
  CASE 
    WHEN meta_access_token IS NOT NULL THEN '✅ Has Meta Token'
    ELSE '❌ No Meta Token'
  END as meta_status,
  CASE 
    WHEN google_ads_access_token IS NOT NULL THEN '✅ Has Google Token'
    ELSE '❌ No Google Token'
  END as google_status,
  created_at::date as client_since
FROM clients
ORDER BY name;

-- ============================================================================
-- 2. MONTHLY DATA AVAILABILITY (Last 12 Months)
-- ============================================================================
WITH months AS (
  SELECT 
    generate_series(
      DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')::date,
      DATE_TRUNC('month', CURRENT_DATE)::date,
      '1 month'::interval
    )::date as month_date
),
client_list AS (
  SELECT id, name FROM clients ORDER BY name
)
SELECT 
  '📅 MONTHLY DATA AVAILABILITY' as report_section,
  c.name as client_name,
  TO_CHAR(m.month_date, 'YYYY-MM') as month,
  CASE 
    WHEN cs.id IS NOT NULL THEN '✅ Has Data'
    ELSE '❌ Missing'
  END as status,
  COALESCE(cs.total_spend, 0) as total_spend,
  COALESCE(cs.total_impressions, 0) as impressions,
  COALESCE(cs.total_conversions, 0) as conversions
FROM months m
CROSS JOIN client_list c
LEFT JOIN campaign_summaries cs 
  ON cs.client_id = c.id 
  AND cs.summary_date = m.month_date
  AND cs.summary_type = 'monthly'
ORDER BY c.name, m.month_date DESC;

-- ============================================================================
-- 3. DATA COMPLETENESS SCORE PER CLIENT
-- ============================================================================
WITH last_12_months AS (
  SELECT 
    generate_series(
      DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')::date,
      DATE_TRUNC('month', CURRENT_DATE)::date,
      '1 month'::interval
    )::date as month_date
),
client_months AS (
  SELECT 
    c.id as client_id,
    c.name as client_name,
    m.month_date
  FROM clients c
  CROSS JOIN last_12_months m
),
data_check AS (
  SELECT 
    cm.client_id,
    cm.client_name,
    cm.month_date,
    CASE WHEN cs.id IS NOT NULL THEN 1 ELSE 0 END as has_summary,
    CASE WHEN dkd_check.has_daily THEN 1 ELSE 0 END as has_daily
  FROM client_months cm
  LEFT JOIN campaign_summaries cs 
    ON cs.client_id = cm.client_id 
    AND cs.summary_date = cm.month_date
    AND cs.summary_type = 'monthly'
  LEFT JOIN LATERAL (
    SELECT EXISTS (
      SELECT 1 FROM daily_kpi_data 
      WHERE client_id = cm.client_id 
        AND date >= cm.month_date 
        AND date < cm.month_date + INTERVAL '1 month'
      LIMIT 1
    ) as has_daily
  ) dkd_check ON true
)
SELECT 
  '📊 DATA COMPLETENESS SCORE' as report_section,
  client_name,
  COUNT(*) as total_months_checked,
  SUM(has_summary) as months_with_summary,
  SUM(has_daily) as months_with_daily_data,
  ROUND(
    (SUM(has_summary)::numeric / COUNT(*)::numeric * 100),
    1
  ) as summary_completeness_percent,
  ROUND(
    (SUM(has_daily)::numeric / COUNT(*)::numeric * 100),
    1
  ) as daily_completeness_percent,
  CASE 
    WHEN SUM(has_summary) = COUNT(*) THEN '✅ Complete'
    WHEN SUM(has_summary) >= COUNT(*) * 0.8 THEN '🟡 Mostly Complete'
    WHEN SUM(has_summary) >= COUNT(*) * 0.5 THEN '🟠 Partial'
    ELSE '🔴 Critical Gaps'
  END as data_health
FROM data_check
GROUP BY client_name
ORDER BY summary_completeness_percent DESC, client_name;

-- ============================================================================
-- 4. MISSING MONTHS - DETAILED REPORT
-- ============================================================================
WITH last_12_months AS (
  SELECT 
    generate_series(
      DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')::date,
      DATE_TRUNC('month', CURRENT_DATE)::date,
      '1 month'::interval
    )::date as month_date
),
client_months AS (
  SELECT 
    c.id as client_id,
    c.name as client_name,
    m.month_date
  FROM clients c
  CROSS JOIN last_12_months m
)
SELECT 
  '❌ MISSING MONTHS' as report_section,
  cm.client_id,
  cm.client_name,
  TO_CHAR(cm.month_date, 'YYYY-MM (Month)') as missing_month,
  TO_CHAR(cm.month_date, 'YYYY-MM-DD') as start_date_for_backfill,
  TO_CHAR(
    (cm.month_date + INTERVAL '1 month' - INTERVAL '1 day')::date, 
    'YYYY-MM-DD'
  ) as end_date_for_backfill,
  CASE 
    WHEN cm.month_date >= DATE_TRUNC('month', CURRENT_DATE) THEN 'Current Month'
    WHEN cm.month_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') THEN 'Last Month'
    ELSE 'Historical'
  END as period_type,
  '🔴 NEEDS BACKFILL' as action_required
FROM client_months cm
LEFT JOIN campaign_summaries cs 
  ON cs.client_id = cm.client_id 
  AND cs.summary_date = cm.month_date
  AND cs.summary_type = 'monthly'
WHERE cs.id IS NULL
ORDER BY cm.client_name, cm.month_date DESC;

-- ============================================================================
-- 5. CURRENT MONTH CACHE STATUS
-- ============================================================================
SELECT 
  '💾 CURRENT MONTH CACHE' as report_section,
  c.name as client_name,
  CASE 
    WHEN cmc.id IS NOT NULL THEN '✅ Has Cache'
    ELSE '❌ No Cache'
  END as cache_status,
  cmc.period_id as cached_period,
  cmc.last_updated,
  CASE 
    WHEN cmc.last_updated IS NOT NULL THEN
      ROUND(EXTRACT(EPOCH FROM (NOW() - cmc.last_updated)) / 3600, 1)
    ELSE NULL
  END as hours_since_refresh,
  CASE 
    WHEN cmc.last_updated IS NULL THEN '❌ Never Refreshed'
    WHEN EXTRACT(EPOCH FROM (NOW() - cmc.last_updated)) / 3600 > 3 THEN '⚠️ Stale (>3h)'
    ELSE '✅ Fresh'
  END as freshness
FROM clients c
LEFT JOIN current_month_cache cmc ON cmc.client_id = c.id
  AND cmc.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
ORDER BY c.name;

-- ============================================================================
-- 6. DATA SOURCE ANALYSIS
-- ============================================================================
SELECT 
  '📊 DATA SOURCE ANALYSIS' as report_section,
  'campaign_summaries' as data_source,
  COUNT(*) as total_records,
  COUNT(DISTINCT client_id) as clients_count,
  MIN(summary_date) as earliest_date,
  MAX(summary_date) as latest_date,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend_all_time
FROM campaign_summaries
WHERE summary_type = 'monthly'
UNION ALL
SELECT 
  '📊 DATA SOURCE ANALYSIS' as report_section,
  'daily_kpi_data' as data_source,
  COUNT(*) as total_records,
  COUNT(DISTINCT client_id) as clients_count,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend_all_time
FROM daily_kpi_data
UNION ALL
SELECT 
  '📊 DATA SOURCE ANALYSIS' as report_section,
  'current_month_cache' as data_source,
  COUNT(*) as total_records,
  COUNT(DISTINCT client_id) as clients_count,
  MIN(created_at::date) as earliest_date,
  MAX(created_at::date) as latest_date,
  NULL as total_spend_all_time
FROM current_month_cache;

-- ============================================================================
-- 7. BACKFILL PRIORITY RECOMMENDATIONS
-- ============================================================================
WITH last_12_months AS (
  SELECT 
    generate_series(
      DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')::date,
      DATE_TRUNC('month', CURRENT_DATE)::date,
      '1 month'::interval
    )::date as month_date
),
missing_data AS (
  SELECT 
    c.id as client_id,
    c.name as client_name,
    c.api_status,
    m.month_date,
    TO_CHAR(m.month_date, 'YYYY-MM') as month_str
  FROM clients c
  CROSS JOIN last_12_months m
  LEFT JOIN campaign_summaries cs 
    ON cs.client_id = c.id 
    AND cs.summary_date = m.month_date
    AND cs.summary_type = 'monthly'
  WHERE cs.id IS NULL
    AND c.api_status = 'valid'
)
SELECT 
  '🎯 BACKFILL PRIORITIES' as report_section,
  month_str as missing_month,
  COUNT(*) as clients_missing_data,
  STRING_AGG(client_name, ', ' ORDER BY client_name) as affected_clients,
  CASE 
    WHEN month_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') THEN '🔴 HIGH PRIORITY'
    WHEN month_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months') THEN '🟡 MEDIUM PRIORITY'
    ELSE '🟢 LOW PRIORITY'
  END as priority,
  '👉 Run backfill for this month' as recommended_action
FROM missing_data
GROUP BY month_str, month_date
ORDER BY month_date DESC;

-- ============================================================================
-- 8. EXECUTIVE SUMMARY
-- ============================================================================
WITH summary_stats AS (
  SELECT 
    (SELECT COUNT(*) FROM clients WHERE api_status = 'valid') as total_clients,
    (SELECT COUNT(DISTINCT client_id) FROM campaign_summaries WHERE summary_type = 'monthly') as clients_with_data,
    (SELECT COUNT(*) FROM clients WHERE api_status = 'valid') * 12 as total_months_expected,
    (SELECT COUNT(*) FROM campaign_summaries cs
     WHERE cs.summary_type = 'monthly'
       AND cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')) as total_months_available
)
SELECT 
  '📋 EXECUTIVE SUMMARY' as report_section,
  total_clients as "Total Active Clients",
  clients_with_data as "Clients with Historical Data",
  total_months_expected as "Expected Month Records",
  total_months_available as "Available Month Records",
  CASE 
    WHEN total_months_expected > 0 THEN
      ROUND((total_months_available::numeric / total_months_expected::numeric * 100), 1)
    ELSE 0
  END as "Data Completeness %",
  CASE 
    WHEN total_months_expected = 0 THEN '⚠️ NO CLIENTS'
    WHEN total_months_available = 0 THEN '🔴 CRITICAL: No historical data'
    WHEN (total_months_available::numeric / total_months_expected::numeric * 100) >= 90 THEN '✅ EXCELLENT'
    WHEN (total_months_available::numeric / total_months_expected::numeric * 100) >= 70 THEN '🟡 GOOD: Minor gaps'
    WHEN (total_months_available::numeric / total_months_expected::numeric * 100) >= 50 THEN '🟠 FAIR: Significant gaps'
    ELSE '🔴 CRITICAL: Major gaps'
  END as "Status & Recommendation"
FROM summary_stats;

-- ============================================================================
-- 9. NEXT STEPS
-- ============================================================================
SELECT 
  '🎯 RECOMMENDED NEXT STEPS' as section,
  'Step 1' as step_number,
  'Run the backfill API endpoint' as action,
  'POST /api/backfill-all-client-data with {"monthsToBackfill": 12}' as command
UNION ALL
SELECT 
  '🎯 RECOMMENDED NEXT STEPS',
  'Step 2',
  'Monitor the backfill progress',
  'Check the API response for success/failure counts'
UNION ALL
SELECT 
  '🎯 RECOMMENDED NEXT STEPS',
  'Step 3',
  'Verify data in Reports page',
  'Visit /reports and check all months display correctly'
UNION ALL
SELECT 
  '🎯 RECOMMENDED NEXT STEPS',
  'Step 4',
  'Set up automated monitoring',
  'Enable cron jobs and alerts for future data gaps'
ORDER BY step_number;

-- ============================================================================
-- END OF AUDIT
-- ============================================================================

