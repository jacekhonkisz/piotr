-- ═══════════════════════════════════════════════════════════════════
-- 🔍 DETAILED GAP ANALYSIS - Where is data missing?
-- ═══════════════════════════════════════════════════════════════════

-- PART 1: Weekly Timeline - Show ALL weeks and which clients have data
-- ═══════════════════════════════════════════════════════════════════

WITH all_weeks AS (
  -- Generate all Mondays for the past 53 weeks
  SELECT 
    (DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' - INTERVAL '1 week' * generate_series)::date as week_monday,
    generate_series as weeks_ago
  FROM generate_series(0, 52)
),
weekly_summary AS (
  SELECT 
    aw.week_monday,
    aw.weeks_ago,
    COUNT(DISTINCT cs.client_id) as clients_with_data,
    COUNT(cs.*) as total_records,
    ROUND(SUM(cs.total_spend)::numeric, 2) as total_spend,
    SUM(cs.reservations) as reservations,
    -- Check data quality
    COUNT(CASE WHEN cs.total_spend = 0 THEN 1 END) as zero_spend_records,
    COUNT(CASE WHEN cs.reservations > 0 OR cs.booking_step_1 > 0 THEN 1 END) as records_with_conversions
  FROM all_weeks aw
  LEFT JOIN campaign_summaries cs ON cs.summary_date = aw.week_monday 
    AND cs.summary_type = 'weekly'
    AND cs.platform = 'meta'
  GROUP BY aw.week_monday, aw.weeks_ago
)
SELECT 
  week_monday,
  weeks_ago || ' weeks ago' as period,
  clients_with_data || '/16' as client_coverage,
  total_records,
  total_spend,
  reservations,
  records_with_conversions || '/' || total_records as has_conversion_data,
  CASE 
    WHEN total_records = 0 THEN '❌ NO DATA'
    WHEN clients_with_data < 10 THEN '⚠️ MISSING CLIENTS'
    WHEN zero_spend_records > 0 THEN '⚠️ HAS ZERO SPEND'
    WHEN records_with_conversions = 0 THEN '⚠️ NO CONVERSIONS'
    ELSE '✅ LOOKS GOOD'
  END as status
FROM weekly_summary
ORDER BY week_monday DESC;

-- ═══════════════════════════════════════════════════════════════════
-- PART 2: Monthly Timeline - Show ALL months
-- ═══════════════════════════════════════════════════════════════════

WITH all_months AS (
  SELECT 
    DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month' * generate_series)::date as month_start,
    generate_series as months_ago
  FROM generate_series(1, 12) -- Last 12 months (excluding current)
),
monthly_summary AS (
  SELECT 
    am.month_start,
    am.months_ago,
    TO_CHAR(am.month_start, 'YYYY-MM') as year_month,
    COUNT(DISTINCT cs.client_id) as clients_with_data,
    COUNT(cs.*) as total_records,
    ROUND(SUM(cs.total_spend)::numeric, 2) as total_spend,
    SUM(cs.reservations) as reservations,
    COUNT(CASE WHEN cs.reservations > 0 OR cs.booking_step_1 > 0 THEN 1 END) as records_with_conversions
  FROM all_months am
  LEFT JOIN campaign_summaries cs ON cs.summary_date = am.month_start 
    AND cs.summary_type = 'monthly'
    AND cs.platform = 'meta'
  GROUP BY am.month_start, am.months_ago
)
SELECT 
  year_month,
  month_start,
  months_ago || ' months ago' as period,
  clients_with_data || '/16' as client_coverage,
  total_records,
  total_spend,
  reservations,
  records_with_conversions || '/' || total_records as has_conversion_data,
  CASE 
    WHEN total_records = 0 THEN '❌ NO DATA'
    WHEN clients_with_data < 10 THEN '⚠️ MISSING CLIENTS'
    WHEN records_with_conversions = 0 THEN '⚠️ NO CONVERSIONS'
    ELSE '✅ LOOKS GOOD'
  END as status
FROM monthly_summary
ORDER BY month_start DESC;

-- ═══════════════════════════════════════════════════════════════════
-- PART 3: Client-by-Client Weekly Coverage
-- ═══════════════════════════════════════════════════════════════════

WITH expected_weeks AS (
  SELECT 
    c.id,
    c.name,
    (DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' - INTERVAL '1 week' * generate_series)::date as week_monday
  FROM clients c
  CROSS JOIN generate_series(1, 52) -- Last 52 weeks (excluding current)
  WHERE c.api_status = 'valid'
),
actual_data AS (
  SELECT 
    cs.client_id,
    cs.summary_date,
    cs.total_spend,
    cs.reservations,
    cs.booking_step_1
  FROM campaign_summaries cs
  WHERE cs.summary_type = 'weekly'
    AND cs.platform = 'meta'
    AND cs.summary_date >= DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' - INTERVAL '52 weeks'
)
SELECT 
  ew.name as client_name,
  COUNT(*) as expected_weeks,
  COUNT(ad.summary_date) as actual_weeks,
  COUNT(*) - COUNT(ad.summary_date) as missing_weeks,
  ROUND(100.0 * COUNT(ad.summary_date) / COUNT(*), 1) as coverage_percent,
  MIN(ad.summary_date) as first_week,
  MAX(ad.summary_date) as last_week,
  ROUND(SUM(ad.total_spend)::numeric, 2) as total_spend,
  SUM(ad.reservations) as total_reservations,
  CASE 
    WHEN COUNT(ad.summary_date) = 0 THEN '❌ NO WEEKLY DATA'
    WHEN COUNT(ad.summary_date) < 10 THEN '❌ SEVERELY INCOMPLETE (<10 weeks)'
    WHEN COUNT(ad.summary_date) < 26 THEN '⚠️ INCOMPLETE (<50%)'
    WHEN COUNT(ad.summary_date) < 45 THEN '⚠️ MOSTLY COMPLETE (>50%)'
    ELSE '✅ COMPLETE (>85%)'
  END as status
FROM expected_weeks ew
LEFT JOIN actual_data ad ON ad.client_id = ew.id AND ad.summary_date = ew.week_monday
GROUP BY ew.name
ORDER BY missing_weeks DESC, ew.name;

-- ═══════════════════════════════════════════════════════════════════
-- PART 4: Client-by-Client Monthly Coverage
-- ═══════════════════════════════════════════════════════════════════

WITH expected_months AS (
  SELECT 
    c.id,
    c.name,
    DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month' * generate_series)::date as month_start
  FROM clients c
  CROSS JOIN generate_series(1, 12) -- Last 12 months (excluding current)
  WHERE c.api_status = 'valid'
),
actual_monthly AS (
  SELECT 
    cs.client_id,
    cs.summary_date,
    cs.total_spend,
    cs.reservations,
    cs.booking_step_1
  FROM campaign_summaries cs
  WHERE cs.summary_type = 'monthly'
    AND cs.platform = 'meta'
    AND cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')
)
SELECT 
  em.name as client_name,
  COUNT(*) as expected_months,
  COUNT(am.summary_date) as actual_months,
  COUNT(*) - COUNT(am.summary_date) as missing_months,
  ROUND(100.0 * COUNT(am.summary_date) / COUNT(*), 1) as coverage_percent,
  TO_CHAR(MIN(am.summary_date), 'YYYY-MM') as first_month,
  TO_CHAR(MAX(am.summary_date), 'YYYY-MM') as last_month,
  ROUND(SUM(am.total_spend)::numeric, 2) as total_spend,
  SUM(am.reservations) as total_reservations,
  CASE 
    WHEN COUNT(am.summary_date) = 0 THEN '❌ NO MONTHLY DATA'
    WHEN COUNT(am.summary_date) < 6 THEN '⚠️ INCOMPLETE (<50%)'
    WHEN COUNT(am.summary_date) < 10 THEN '⚠️ MOSTLY COMPLETE (>50%)'
    ELSE '✅ COMPLETE (>80%)'
  END as status
FROM expected_months em
LEFT JOIN actual_monthly am ON am.client_id = em.id AND am.summary_date = em.month_start
GROUP BY em.name
ORDER BY missing_months DESC, em.name;

-- ═══════════════════════════════════════════════════════════════════
-- PART 5: When was data collected? (Creation timeline)
-- ═══════════════════════════════════════════════════════════════════

SELECT 
  '📅 WEEKLY DATA COLLECTION TIMELINE' as section,
  DATE(created_at) as collection_date,
  COUNT(*) as records_created,
  COUNT(DISTINCT client_id) as clients,
  COUNT(DISTINCT summary_date) as unique_weeks,
  MIN(summary_date) as earliest_week_collected,
  MAX(summary_date) as latest_week_collected
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND platform = 'meta'
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC
LIMIT 20;

SELECT 
  '📅 MONTHLY DATA COLLECTION TIMELINE' as section,
  DATE(created_at) as collection_date,
  COUNT(*) as records_created,
  COUNT(DISTINCT client_id) as clients,
  COUNT(DISTINCT summary_date) as unique_months,
  MIN(summary_date) as earliest_month_collected,
  MAX(summary_date) as latest_month_collected
FROM campaign_summaries
WHERE summary_type = 'monthly'
  AND platform = 'meta'
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC
LIMIT 20;

-- ═══════════════════════════════════════════════════════════════════
-- PART 6: Quick Summary - What needs to be collected?
-- ═══════════════════════════════════════════════════════════════════

WITH client_count AS (
  SELECT COUNT(*) as total_clients FROM clients WHERE api_status = 'valid'
),
weekly_stats AS (
  SELECT 
    COUNT(DISTINCT client_id) as clients_with_weekly,
    COUNT(*) as total_weekly,
    (SELECT total_clients FROM client_count) * 52 as expected_weekly
  FROM campaign_summaries
  WHERE summary_type = 'weekly'
    AND platform = 'meta'
    AND summary_date >= DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' - INTERVAL '52 weeks'
),
monthly_stats AS (
  SELECT 
    COUNT(DISTINCT client_id) as clients_with_monthly,
    COUNT(*) as total_monthly,
    (SELECT total_clients FROM client_count) * 12 as expected_monthly
  FROM campaign_summaries
  WHERE summary_type = 'monthly'
    AND platform = 'meta'
    AND summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')
)
SELECT 
  '📊 COVERAGE SUMMARY' as summary,
  (SELECT total_clients FROM client_count) as total_active_clients,
  ws.clients_with_weekly as clients_with_weekly_data,
  ws.total_weekly as actual_weekly_records,
  ws.expected_weekly as expected_weekly_records,
  ws.expected_weekly - ws.total_weekly as missing_weekly_records,
  ROUND(100.0 * ws.total_weekly / ws.expected_weekly, 1) || '%' as weekly_coverage,
  ms.clients_with_monthly as clients_with_monthly_data,
  ms.total_monthly as actual_monthly_records,
  ms.expected_monthly as expected_monthly_records,
  ms.expected_monthly - ms.total_monthly as missing_monthly_records,
  ROUND(100.0 * ms.total_monthly / ms.expected_monthly, 1) || '%' as monthly_coverage
FROM weekly_stats ws, monthly_stats ms;



