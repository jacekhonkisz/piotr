-- ============================================================================
-- COMPREHENSIVE DATA AUDIT FOR ALL CLIENTS - OCTOBER 2025
-- ============================================================================
-- Purpose: Audit all client data across all months to identify gaps
-- Author: System Administrator
-- Date: October 1, 2025
-- Safety: 100% safe - read-only queries only
-- ============================================================================

\echo '============================================'
\echo '🔍 COMPREHENSIVE DATA AUDIT - ALL CLIENTS'
\echo '============================================'
\echo ''

-- ============================================================================
-- 1. CLIENT OVERVIEW
-- ============================================================================
\echo '📊 STEP 1: CLIENT OVERVIEW'
\echo '============================================'

SELECT 
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

\echo ''
\echo '============================================'
\echo '📊 STEP 2: MONTHLY DATA AVAILABILITY'
\echo '============================================'

-- Check which months have data in campaign_summaries
WITH months AS (
  SELECT 
    generate_series(
      DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')::date,
      DATE_TRUNC('month', CURRENT_DATE)::date,
      '1 month'::interval
    )::date as month_date
),
client_list AS (
  SELECT id, name FROM clients ORDER BY name
)
SELECT 
  c.name as client_name,
  TO_CHAR(m.month_date, 'YYYY-MM') as month,
  CASE 
    WHEN cs.id IS NOT NULL THEN '✅ Has Data'
    ELSE '❌ Missing'
  END as campaign_summaries_status,
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

\echo ''
\echo '============================================'
\echo '📊 STEP 3: DAILY KPI DATA COVERAGE'
\echo '============================================'

-- Check daily_kpi_data coverage for each client
WITH date_range AS (
  SELECT 
    generate_series(
      (CURRENT_DATE - INTERVAL '3 months')::date,
      CURRENT_DATE::date,
      '1 day'::interval
    )::date as check_date
),
client_list AS (
  SELECT id, name FROM clients ORDER BY name
)
SELECT 
  c.name as client_name,
  TO_CHAR(dr.check_date, 'YYYY-MM') as month,
  COUNT(DISTINCT dr.check_date) as total_days_in_period,
  COUNT(DISTINCT dkd.date) as days_with_data,
  ROUND(
    (COUNT(DISTINCT dkd.date)::numeric / COUNT(DISTINCT dr.check_date)::numeric * 100),
    1
  ) as coverage_percent,
  CASE 
    WHEN COUNT(DISTINCT dkd.date) = COUNT(DISTINCT dr.check_date) THEN '✅ Complete'
    WHEN COUNT(DISTINCT dkd.date) > 0 THEN '⚠️ Partial'
    ELSE '❌ No Data'
  END as status
FROM client_list c
CROSS JOIN date_range dr
LEFT JOIN daily_kpi_data dkd 
  ON dkd.client_id = c.id 
  AND dkd.date = dr.check_date
GROUP BY c.name, TO_CHAR(dr.check_date, 'YYYY-MM')
ORDER BY c.name, month DESC;

\echo ''
\echo '============================================'
\echo '📊 STEP 4: DATA COMPLETENESS SCORE'
\echo '============================================'

-- Calculate completeness score for each client
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

\echo ''
\echo '============================================'
\echo '📊 STEP 5: MISSING MONTHS DETAILED REPORT'
\echo '============================================'

-- List all missing months per client
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

\echo ''
\echo '============================================'
\echo '📊 STEP 6: CURRENT MONTH CACHE STATUS'
\echo '============================================'

-- Check current month cache for all clients
SELECT 
  c.name as client_name,
  CASE 
    WHEN cmc.id IS NOT NULL THEN '✅ Has Cache'
    ELSE '❌ No Cache'
  END as cache_status,
  cmc.period_id as cached_period,
  cmc.last_refreshed,
  CASE 
    WHEN cmc.last_refreshed IS NOT NULL THEN
      EXTRACT(EPOCH FROM (NOW() - cmc.last_refreshed)) / 3600
    ELSE NULL
  END as hours_since_refresh,
  CASE 
    WHEN cmc.last_refreshed IS NULL THEN '❌ Never Refreshed'
    WHEN EXTRACT(EPOCH FROM (NOW() - cmc.last_refreshed)) / 3600 > 3 THEN '⚠️ Stale (>3h)'
    ELSE '✅ Fresh'
  END as freshness
FROM clients c
LEFT JOIN current_month_cache cmc ON cmc.client_id = c.id
  AND cmc.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
ORDER BY c.name;

\echo ''
\echo '============================================'
\echo '📊 STEP 7: DATA SOURCE ANALYSIS'
\echo '============================================'

-- Analyze where data is coming from
SELECT 
  'campaign_summaries' as data_source,
  COUNT(*) as total_records,
  COUNT(DISTINCT client_id) as clients_count,
  MIN(summary_date) as earliest_date,
  MAX(summary_date) as latest_date,
  SUM(total_spend) as total_spend_all_time
FROM campaign_summaries
WHERE summary_type = 'monthly'
UNION ALL
SELECT 
  'daily_kpi_data' as data_source,
  COUNT(*) as total_records,
  COUNT(DISTINCT client_id) as clients_count,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  SUM(total_spend) as total_spend_all_time
FROM daily_kpi_data
UNION ALL
SELECT 
  'current_month_cache' as data_source,
  COUNT(*) as total_records,
  COUNT(DISTINCT client_id) as clients_count,
  MIN(created_at::date) as earliest_date,
  MAX(created_at::date) as latest_date,
  NULL as total_spend_all_time
FROM current_month_cache;

\echo ''
\echo '============================================'
\echo '📊 STEP 8: BACKFILL PRIORITY RECOMMENDATIONS'
\echo '============================================'

-- Prioritize which months to backfill first
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
    AND c.api_status = 'valid'  -- Only clients with valid API access
)
SELECT 
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

\echo ''
\echo '============================================'
\echo '📋 SUMMARY & ACTION PLAN'
\echo '============================================'

-- Executive summary
DO $$
DECLARE
  total_clients INTEGER;
  clients_with_data INTEGER;
  total_months_expected INTEGER;
  total_months_available INTEGER;
  completeness_percent NUMERIC;
BEGIN
  -- Count clients
  SELECT COUNT(*) INTO total_clients FROM clients WHERE api_status = 'valid';
  
  -- Count clients with any monthly data
  SELECT COUNT(DISTINCT client_id) INTO clients_with_data 
  FROM campaign_summaries 
  WHERE summary_type = 'monthly';
  
  -- Calculate expected vs available months
  total_months_expected := total_clients * 12; -- Last 12 months
  
  SELECT COUNT(*) INTO total_months_available
  FROM campaign_summaries cs
  WHERE cs.summary_type = 'monthly'
    AND cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months');
  
  IF total_months_expected > 0 THEN
    completeness_percent := (total_months_available::numeric / total_months_expected::numeric * 100);
  ELSE
    completeness_percent := 0;
  END IF;
  
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📊 EXECUTIVE SUMMARY';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '👥 Total Active Clients: %', total_clients;
  RAISE NOTICE '📈 Clients with Historical Data: %', clients_with_data;
  RAISE NOTICE '📅 Expected Month Records: %', total_months_expected;
  RAISE NOTICE '✅ Available Month Records: %', total_months_available;
  RAISE NOTICE '📊 Data Completeness: %%', ROUND(completeness_percent, 1);
  RAISE NOTICE '';
  
  IF completeness_percent >= 90 THEN
    RAISE NOTICE '✅ EXCELLENT: Data coverage is very good';
  ELSIF completeness_percent >= 70 THEN
    RAISE NOTICE '🟡 GOOD: Minor gaps, recommend backfilling missing months';
  ELSIF completeness_percent >= 50 THEN
    RAISE NOTICE '🟠 FAIR: Significant gaps, backfill recommended';
  ELSE
    RAISE NOTICE '🔴 CRITICAL: Major data gaps, immediate backfill required';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🎯 RECOMMENDED ACTIONS';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  
  IF total_clients = 0 THEN
    RAISE NOTICE '⚠️ No active clients found with valid API access';
    RAISE NOTICE '   → Check client API tokens and status';
  ELSIF clients_with_data = 0 THEN
    RAISE NOTICE '🔴 CRITICAL: No historical data found for any client';
    RAISE NOTICE '   → Run full backfill for all clients';
    RAISE NOTICE '   → Use: /api/backfill-all-client-data';
  ELSIF completeness_percent < 70 THEN
    RAISE NOTICE '🟡 ACTION REQUIRED: Backfill missing months';
    RAISE NOTICE '   → Review "MISSING MONTHS DETAILED REPORT" above';
    RAISE NOTICE '   → Run: /api/backfill-all-client-data';
    RAISE NOTICE '   → Or backfill specific months manually';
  ELSE
    RAISE NOTICE '✅ Data health is good';
    RAISE NOTICE '   → Continue normal operations';
    RAISE NOTICE '   → Monitor daily collection jobs';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📞 NEXT STEPS';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '1. Review the detailed reports above';
  RAISE NOTICE '2. Identify priority months for backfill';
  RAISE NOTICE '3. Run backfill API: POST /api/backfill-all-client-data';
  RAISE NOTICE '4. Monitor backfill progress';
  RAISE NOTICE '5. Verify data in /reports page';
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

-- ============================================================================
-- END OF COMPREHENSIVE DATA AUDIT
-- ============================================================================

