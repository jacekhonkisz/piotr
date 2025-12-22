-- ═══════════════════════════════════════════════════════════════════
-- 📊 HISTORICAL DATA COVERAGE AUDIT
-- ═══════════════════════════════════════════════════════════════════
-- Purpose: Verify historical data is properly stored for past year
-- Tables: campaign_summaries, clients
-- Date: November 18, 2025
-- ═══════════════════════════════════════════════════════════════════

-- SECTION 1: OVERVIEW - What data exists?
-- ═══════════════════════════════════════════════════════════════════

SELECT 
  '📊 DATA OVERVIEW' as section,
  summary_type,
  platform,
  COUNT(*) as total_records,
  COUNT(DISTINCT client_id) as clients_count,
  MIN(summary_date) as earliest_date,
  MAX(summary_date) as latest_date,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend_sum,
  SUM(reservations) as total_reservations
FROM campaign_summaries
GROUP BY summary_type, platform
ORDER BY summary_type, platform;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 2: MONTHLY DATA COVERAGE (Past Year)
-- ═══════════════════════════════════════════════════════════════════

WITH last_12_months AS (
  SELECT 
    TO_CHAR(DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month' * generate_series), 'YYYY-MM') as year_month,
    DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month' * generate_series)::date as month_start
  FROM generate_series(0, 11) -- Last 12 months including current
),
monthly_data AS (
  SELECT 
    TO_CHAR(summary_date, 'YYYY-MM') as year_month,
    c.name as client_name,
    cs.platform,
    cs.total_spend,
    cs.reservations,
    cs.booking_step_1,
    cs.created_at
  FROM campaign_summaries cs
  JOIN clients c ON c.id = cs.client_id
  WHERE cs.summary_type = 'monthly'
    AND cs.summary_date >= CURRENT_DATE - INTERVAL '12 months'
)
SELECT 
  '📅 MONTHLY COVERAGE (Past 12 Months)' as section,
  lm.year_month,
  lm.month_start,
  COUNT(DISTINCT md.client_name) as clients_with_data,
  COUNT(md.*) as total_records,
  COALESCE(ROUND(SUM(md.total_spend)::numeric, 2), 0) as total_spend,
  COALESCE(SUM(md.reservations), 0) as total_reservations,
  CASE 
    WHEN COUNT(md.*) = 0 THEN '❌ MISSING'
    WHEN COUNT(md.*) < 10 THEN '⚠️ INCOMPLETE'
    ELSE '✅ COMPLETE'
  END as status
FROM last_12_months lm
LEFT JOIN monthly_data md ON md.year_month = lm.year_month
GROUP BY lm.year_month, lm.month_start
ORDER BY lm.month_start DESC;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 3: WEEKLY DATA COVERAGE (Past Year = ~52 weeks)
-- ═══════════════════════════════════════════════════════════════════

WITH last_52_weeks AS (
  SELECT 
    DATE_TRUNC('week', CURRENT_DATE - INTERVAL '1 week' * generate_series)::date + INTERVAL '1 day' as week_monday,
    EXTRACT(WEEK FROM CURRENT_DATE - INTERVAL '1 week' * generate_series) as week_number,
    EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 week' * generate_series) as week_year
  FROM generate_series(0, 51) -- Last 52 weeks
),
weekly_data AS (
  SELECT 
    cs.summary_date,
    c.name as client_name,
    cs.platform,
    cs.total_spend,
    cs.reservations,
    cs.booking_step_1,
    EXTRACT(DOW FROM cs.summary_date) as day_of_week,
    cs.created_at
  FROM campaign_summaries cs
  JOIN clients c ON c.id = cs.client_id
  WHERE cs.summary_type = 'weekly'
    AND cs.summary_date >= CURRENT_DATE - INTERVAL '52 weeks'
)
SELECT 
  '📅 WEEKLY COVERAGE (Past 52 Weeks)' as section,
  lw.week_year || '-W' || LPAD(lw.week_number::text, 2, '0') as iso_week,
  lw.week_monday as expected_monday,
  COUNT(DISTINCT wd.client_name) as clients_with_data,
  COUNT(wd.*) as total_records,
  COALESCE(ROUND(SUM(wd.total_spend)::numeric, 2), 0) as total_spend,
  COALESCE(SUM(wd.reservations), 0) as total_reservations,
  COUNT(CASE WHEN wd.day_of_week != 1 THEN 1 END) as non_monday_records,
  CASE 
    WHEN COUNT(wd.*) = 0 THEN '❌ MISSING'
    WHEN COUNT(wd.*) < 5 THEN '⚠️ INCOMPLETE'
    WHEN COUNT(CASE WHEN wd.day_of_week != 1 THEN 1 END) > 0 THEN '⚠️ BAD DATES'
    ELSE '✅ COMPLETE'
  END as status
FROM last_52_weeks lw
LEFT JOIN weekly_data wd ON wd.summary_date = lw.week_monday
GROUP BY lw.week_year, lw.week_number, lw.week_monday
ORDER BY lw.week_monday DESC
LIMIT 20; -- Show last 20 weeks

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 4: CLIENT-BY-CLIENT COVERAGE
-- ═══════════════════════════════════════════════════════════════════

SELECT 
  '👥 CLIENT COVERAGE' as section,
  c.name as client_name,
  c.api_status,
  COUNT(CASE WHEN cs.summary_type = 'monthly' THEN 1 END) as monthly_records,
  COUNT(CASE WHEN cs.summary_type = 'weekly' THEN 1 END) as weekly_records,
  MIN(CASE WHEN cs.summary_type = 'monthly' THEN cs.summary_date END) as earliest_month,
  MAX(CASE WHEN cs.summary_type = 'monthly' THEN cs.summary_date END) as latest_month,
  MIN(CASE WHEN cs.summary_type = 'weekly' THEN cs.summary_date END) as earliest_week,
  MAX(CASE WHEN cs.summary_type = 'weekly' THEN cs.summary_date END) as latest_week,
  CASE 
    WHEN COUNT(CASE WHEN cs.summary_type = 'monthly' THEN 1 END) >= 12 
     AND COUNT(CASE WHEN cs.summary_type = 'weekly' THEN 1 END) >= 40 
    THEN '✅ COMPLETE'
    WHEN COUNT(CASE WHEN cs.summary_type = 'monthly' THEN 1 END) >= 6 
     AND COUNT(CASE WHEN cs.summary_type = 'weekly' THEN 1 END) >= 20 
    THEN '⚠️ PARTIAL'
    ELSE '❌ MISSING'
  END as data_status
FROM clients c
LEFT JOIN campaign_summaries cs ON cs.client_id = c.id
WHERE c.api_status = 'valid'
GROUP BY c.name, c.api_status
ORDER BY c.name;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 5: DATA QUALITY CHECKS
-- ═══════════════════════════════════════════════════════════════════

-- Check for non-Monday weeks
SELECT 
  '🔍 NON-MONDAY WEEKLY RECORDS' as section,
  c.name as client_name,
  cs.summary_date,
  TO_CHAR(cs.summary_date, 'Day') as day_name,
  EXTRACT(DOW FROM cs.summary_date) as day_of_week,
  cs.total_spend,
  cs.reservations
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
  AND EXTRACT(DOW FROM cs.summary_date) != 1 -- Monday = 1
ORDER BY cs.summary_date DESC
LIMIT 10;

-- Check for weeks with zero data
SELECT 
  '⚠️ WEEKS WITH ZERO SPEND' as section,
  c.name as client_name,
  cs.summary_date,
  cs.platform,
  cs.total_spend,
  cs.total_impressions,
  cs.total_clicks,
  cs.reservations,
  TO_CHAR(cs.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
  AND cs.total_spend = 0
  AND cs.summary_date >= CURRENT_DATE - INTERVAL '52 weeks'
ORDER BY cs.summary_date DESC
LIMIT 10;

-- Check for duplicate weeks (same client, same week, same platform)
SELECT 
  '🔍 DUPLICATE WEEKLY RECORDS' as section,
  c.name as client_name,
  cs.summary_date,
  cs.platform,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(TO_CHAR(cs.created_at, 'YYYY-MM-DD HH24:MI:SS')) as created_dates,
  ARRAY_AGG(ROUND(cs.total_spend::numeric, 2)) as spend_values
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
GROUP BY c.name, cs.summary_date, cs.platform
HAVING COUNT(*) > 1
ORDER BY cs.summary_date DESC;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 6: RECENT DATA CHECK (Last 4 weeks + Last 3 months)
-- ═══════════════════════════════════════════════════════════════════

SELECT 
  '📆 RECENT WEEKLY DATA (Last 4 Weeks)' as section,
  cs.summary_date,
  TO_CHAR(cs.summary_date, 'Day') as day_name,
  COUNT(DISTINCT cs.client_id) as clients,
  COUNT(*) as records,
  ROUND(SUM(cs.total_spend)::numeric, 2) as total_spend,
  SUM(cs.reservations) as total_reservations,
  SUM(cs.booking_step_1) as total_booking_step_1
FROM campaign_summaries cs
WHERE cs.summary_type = 'weekly'
  AND cs.summary_date >= CURRENT_DATE - INTERVAL '4 weeks'
GROUP BY cs.summary_date
ORDER BY cs.summary_date DESC;

SELECT 
  '📆 RECENT MONTHLY DATA (Last 3 Months)' as section,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as year_month,
  cs.summary_date,
  COUNT(DISTINCT cs.client_id) as clients,
  COUNT(*) as records,
  ROUND(SUM(cs.total_spend)::numeric, 2) as total_spend,
  SUM(cs.reservations) as total_reservations,
  SUM(cs.booking_step_1) as total_booking_step_1
FROM campaign_summaries cs
WHERE cs.summary_type = 'monthly'
  AND cs.summary_date >= CURRENT_DATE - INTERVAL '3 months'
GROUP BY TO_CHAR(cs.summary_date, 'YYYY-MM'), cs.summary_date
ORDER BY cs.summary_date DESC;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 7: GAP ANALYSIS - Missing Weeks/Months per Client
-- ═══════════════════════════════════════════════════════════════════

WITH expected_weeks AS (
  SELECT 
    c.id as client_id,
    c.name as client_name,
    DATE_TRUNC('week', CURRENT_DATE - INTERVAL '1 week' * generate_series)::date + INTERVAL '1 day' as week_monday
  FROM clients c
  CROSS JOIN generate_series(1, 52) -- Last 52 weeks (excluding current)
  WHERE c.api_status = 'valid'
),
actual_weeks AS (
  SELECT 
    cs.client_id,
    cs.summary_date,
    cs.platform
  FROM campaign_summaries cs
  WHERE cs.summary_type = 'weekly'
    AND cs.summary_date >= CURRENT_DATE - INTERVAL '52 weeks'
)
SELECT 
  '🔍 MISSING WEEKS PER CLIENT' as section,
  ew.client_name,
  COUNT(*) as expected_weeks,
  COUNT(CASE WHEN aw.summary_date IS NOT NULL THEN 1 END) as actual_weeks,
  COUNT(*) - COUNT(CASE WHEN aw.summary_date IS NOT NULL THEN 1 END) as missing_weeks,
  ROUND(100.0 * COUNT(CASE WHEN aw.summary_date IS NOT NULL THEN 1 END) / COUNT(*), 1) as coverage_percent
FROM expected_weeks ew
LEFT JOIN actual_weeks aw ON aw.client_id = ew.client_id 
  AND aw.summary_date = ew.week_monday
  AND aw.platform = 'meta' -- Check Meta platform
GROUP BY ew.client_name
ORDER BY missing_weeks DESC;

-- ═══════════════════════════════════════════════════════════════════
-- SECTION 8: SUMMARY STATISTICS
-- ═══════════════════════════════════════════════════════════════════

SELECT 
  '📊 OVERALL SUMMARY' as section,
  COUNT(DISTINCT CASE WHEN summary_type = 'weekly' THEN client_id END) as clients_with_weekly,
  COUNT(DISTINCT CASE WHEN summary_type = 'monthly' THEN client_id END) as clients_with_monthly,
  COUNT(CASE WHEN summary_type = 'weekly' THEN 1 END) as total_weekly_records,
  COUNT(CASE WHEN summary_type = 'monthly' THEN 1 END) as total_monthly_records,
  COUNT(CASE WHEN summary_type = 'weekly' AND summary_date >= CURRENT_DATE - INTERVAL '52 weeks' THEN 1 END) as weekly_last_year,
  COUNT(CASE WHEN summary_type = 'monthly' AND summary_date >= CURRENT_DATE - INTERVAL '12 months' THEN 1 END) as monthly_last_year,
  MIN(CASE WHEN summary_type = 'weekly' THEN summary_date END) as earliest_week_ever,
  MAX(CASE WHEN summary_type = 'weekly' THEN summary_date END) as latest_week_ever,
  MIN(CASE WHEN summary_type = 'monthly' THEN summary_date END) as earliest_month_ever,
  MAX(CASE WHEN summary_type = 'monthly' THEN summary_date END) as latest_month_ever
FROM campaign_summaries;

-- ═══════════════════════════════════════════════════════════════════
-- END OF AUDIT
-- ═══════════════════════════════════════════════════════════════════



