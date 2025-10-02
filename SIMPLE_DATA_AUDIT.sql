-- ============================================================================
-- SIMPLE DATA AUDIT - SUPABASE COMPATIBLE (SAFE VERSION)
-- ============================================================================
-- Purpose: Basic audit that works even if some tables don't exist
-- Date: October 1, 2025
-- Safety: 100% safe - handles missing tables gracefully
-- ============================================================================

-- ============================================================================
-- 1. CHECK WHICH TABLES EXIST
-- ============================================================================
SELECT 
  '📋 TABLE EXISTENCE CHECK' as report_section,
  table_name,
  CASE 
    WHEN table_name IN ('clients', 'profiles') THEN '🔴 CRITICAL CORE'
    WHEN table_name IN ('campaign_summaries', 'current_month_cache', 'daily_kpi_data') THEN '🟡 REPORTS SYSTEM'
    WHEN table_name IN ('reports', 'campaigns', 'email_logs') THEN '🟠 IMPORTANT'
    ELSE '🟢 OTHER'
  END as category,
  'Exists' as status
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY 
  CASE 
    WHEN table_name IN ('clients', 'profiles') THEN 1
    WHEN table_name IN ('campaign_summaries', 'current_month_cache', 'daily_kpi_data') THEN 2
    WHEN table_name IN ('reports', 'campaigns', 'email_logs') THEN 3
    ELSE 4
  END,
  table_name;

-- ============================================================================
-- 2. CLIENT OVERVIEW (if clients table exists)
-- ============================================================================
SELECT 
  '👥 CLIENT OVERVIEW' as report_section,
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
-- 3. CAMPAIGN SUMMARIES DATA (if table exists)
-- ============================================================================
SELECT 
  '📊 CAMPAIGN SUMMARIES OVERVIEW' as report_section,
  COUNT(*) as total_records,
  COUNT(DISTINCT client_id) as clients_with_data,
  MIN(summary_date) as earliest_date,
  MAX(summary_date) as latest_date,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend_all_time,
  COUNT(CASE WHEN summary_type = 'monthly' THEN 1 END) as monthly_records,
  COUNT(CASE WHEN summary_type = 'weekly' THEN 1 END) as weekly_records
FROM campaign_summaries;

-- ============================================================================
-- 4. MONTHLY DATA BY CLIENT (if campaign_summaries exists)
-- ============================================================================
SELECT 
  '📅 MONTHLY DATA BY CLIENT' as report_section,
  c.name as client_name,
  COUNT(cs.id) as months_with_data,
  MIN(cs.summary_date) as earliest_month,
  MAX(cs.summary_date) as latest_month,
  ROUND(SUM(cs.total_spend)::numeric, 2) as total_spend,
  ROUND(AVG(cs.total_spend)::numeric, 2) as avg_monthly_spend
FROM clients c
LEFT JOIN campaign_summaries cs 
  ON cs.client_id = c.id 
  AND cs.summary_type = 'monthly'
GROUP BY c.id, c.name
ORDER BY months_with_data DESC, c.name;

-- ============================================================================
-- 5. MISSING MONTHS ANALYSIS (if campaign_summaries exists)
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
  '❌ MISSING MONTHS SUMMARY' as report_section,
  cm.client_name,
  COUNT(*) as total_months_expected,
  COUNT(cs.id) as months_with_data,
  (COUNT(*) - COUNT(cs.id)) as missing_months,
  ROUND(
    (COUNT(cs.id)::numeric / COUNT(*)::numeric * 100),
    1
  ) as completeness_percent,
  CASE 
    WHEN COUNT(cs.id) = COUNT(*) THEN '✅ Complete'
    WHEN COUNT(cs.id) >= COUNT(*) * 0.8 THEN '🟡 Mostly Complete'
    WHEN COUNT(cs.id) >= COUNT(*) * 0.5 THEN '🟠 Partial'
    ELSE '🔴 Critical Gaps'
  END as status
FROM client_months cm
LEFT JOIN campaign_summaries cs 
  ON cs.client_id = cm.client_id 
  AND cs.summary_date = cm.month_date
  AND cs.summary_type = 'monthly'
GROUP BY cm.client_id, cm.client_name
ORDER BY completeness_percent ASC, cm.client_name;

-- ============================================================================
-- 6. CURRENT MONTH CACHE STATUS (if table exists)
-- ============================================================================
SELECT 
  '💾 CURRENT MONTH CACHE STATUS' as report_section,
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
-- 7. DAILY KPI DATA OVERVIEW (if table exists)
-- ============================================================================
SELECT 
  '📈 DAILY KPI DATA OVERVIEW' as report_section,
  COUNT(*) as total_daily_records,
  COUNT(DISTINCT client_id) as clients_with_daily_data,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend,
  ROUND(AVG(total_spend)::numeric, 2) as avg_daily_spend
FROM daily_kpi_data;

-- ============================================================================
-- 8. EXECUTIVE SUMMARY
-- ============================================================================
WITH summary_stats AS (
  SELECT 
    (SELECT COUNT(*) FROM clients WHERE api_status = 'valid') as total_clients,
    (SELECT COUNT(DISTINCT client_id) FROM campaign_summaries WHERE summary_type = 'monthly') as clients_with_monthly_data,
    (SELECT COUNT(*) FROM clients WHERE api_status = 'valid') * 12 as total_months_expected,
    (SELECT COUNT(*) FROM campaign_summaries cs
     WHERE cs.summary_type = 'monthly'
       AND cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')) as total_months_available
)
SELECT 
  '📋 EXECUTIVE SUMMARY' as report_section,
  total_clients as "Total Active Clients",
  clients_with_monthly_data as "Clients with Monthly Data",
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
-- 9. NEXT STEPS RECOMMENDATIONS
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

