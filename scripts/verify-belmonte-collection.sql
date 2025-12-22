-- ═══════════════════════════════════════════════════════════════════
-- ✅ VERIFY BELMONTE COLLECTION SUCCESS
-- ═══════════════════════════════════════════════════════════════════

-- STEP 1: Overall Summary
SELECT 
  '📊 BELMONTE WEEKLY DATA SUMMARY' as section,
  COUNT(*) as total_weekly_records,
  MIN(summary_date) as earliest_week,
  MAX(summary_date) as latest_week,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend,
  SUM(total_impressions) as total_impressions,
  SUM(reservations) as total_reservations,
  SUM(booking_step_1) as total_booking_step_1,
  COUNT(CASE WHEN reservations > 0 OR booking_step_1 > 0 THEN 1 END) as records_with_conversions,
  ROUND(100.0 * COUNT(CASE WHEN reservations > 0 OR booking_step_1 > 0 THEN 1 END) / NULLIF(COUNT(*), 0), 1) || '%' as conversion_data_rate,
  CASE 
    WHEN COUNT(*) >= 50 THEN '✅ EXCELLENT (50+ weeks)'
    WHEN COUNT(*) >= 40 THEN '✅ GOOD (40+ weeks)'
    WHEN COUNT(*) >= 30 THEN '⚠️ FAIR (30+ weeks)'
    ELSE '❌ INCOMPLETE (<30 weeks)'
  END as coverage_status,
  CASE 
    WHEN COUNT(CASE WHEN reservations > 0 OR booking_step_1 > 0 THEN 1 END) > 0 
    THEN '✅ CONVERSIONS WORKING'
    ELSE '❌ NO CONVERSIONS (BUG!)'
  END as conversion_status
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta';

-- STEP 2: Weekly Breakdown (Last 20 weeks)
SELECT 
  '📅 WEEKLY BREAKDOWN (Last 20 Weeks)' as section,
  cs.summary_date,
  TO_CHAR(cs.summary_date, 'Day') as day_name,
  EXTRACT(DOW FROM cs.summary_date) as day_of_week,
  ROUND(cs.total_spend::numeric, 2) as spend,
  cs.total_impressions as impressions,
  cs.total_clicks as clicks,
  cs.reservations,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  TO_CHAR(cs.created_at, 'MM-DD HH24:MI') as created_at,
  CASE 
    WHEN EXTRACT(DOW FROM cs.summary_date) != 1 THEN '❌ NOT MONDAY!'
    WHEN cs.reservations > 0 OR cs.booking_step_1 > 0 THEN '✅ HAS CONVERSIONS'
    WHEN cs.total_spend > 0 THEN '⚪ SPEND ONLY'
    ELSE '⚪ NO DATA'
  END as status
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
ORDER BY cs.summary_date DESC
LIMIT 20;

-- STEP 3: Check for Data Quality Issues
SELECT 
  '🔍 DATA QUALITY CHECKS' as section,
  COUNT(*) as total_records,
  COUNT(CASE WHEN EXTRACT(DOW FROM summary_date) = 1 THEN 1 END) as monday_weeks,
  COUNT(CASE WHEN EXTRACT(DOW FROM summary_date) != 1 THEN 1 END) as non_monday_weeks,
  COUNT(CASE WHEN total_spend = 0 THEN 1 END) as zero_spend_weeks,
  COUNT(CASE WHEN total_spend > 0 AND reservations = 0 AND booking_step_1 = 0 THEN 1 END) as spend_no_conversions,
  COUNT(CASE WHEN reservations > 0 OR booking_step_1 > 0 THEN 1 END) as weeks_with_conversions,
  CASE 
    WHEN COUNT(CASE WHEN EXTRACT(DOW FROM summary_date) != 1 THEN 1 END) > 0 
    THEN '❌ HAS NON-MONDAY WEEKS'
    ELSE '✅ ALL MONDAYS'
  END as monday_check,
  CASE 
    WHEN COUNT(CASE WHEN reservations > 0 OR booking_step_1 > 0 THEN 1 END) > 0 
    THEN '✅ CONVERSIONS WORKING'
    ELSE '❌ NO CONVERSIONS'
  END as conversion_check
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta';

-- STEP 4: Compare with November weeks (from your earlier query)
SELECT 
  '📊 NOVEMBER COMPARISON' as section,
  COUNT(*) as november_weeks,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend,
  SUM(reservations) as reservations,
  SUM(booking_step_1) as booking_step_1,
  CASE 
    WHEN SUM(total_spend) BETWEEN 40000 AND 60000 THEN '✅ LOOKS REALISTIC'
    WHEN SUM(total_spend) > 100000 THEN '⚠️ POSSIBLY DOUBLED'
    WHEN SUM(total_spend) < 1000 THEN '⚠️ TOO LOW'
    ELSE '⚪ NEEDS REVIEW'
  END as spend_check
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND cs.summary_date >= '2025-11-01'
  AND cs.summary_date < '2025-12-01';

-- STEP 5: Recent Collection Activity
SELECT 
  '🕐 COLLECTION TIMELINE' as section,
  DATE(created_at) as collection_date,
  COUNT(*) as records_created,
  MIN(summary_date) as earliest_week,
  MAX(summary_date) as latest_week,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC
LIMIT 5;

-- ═══════════════════════════════════════════════════════════════════
-- SUCCESS CRITERIA:
-- ═══════════════════════════════════════════════════════════════════
-- ✅ total_weekly_records >= 45
-- ✅ conversion_data_rate > 0%
-- ✅ monday_weeks = total_records (all Mondays)
-- ✅ conversion_status = '✅ CONVERSIONS WORKING'
-- ✅ November spend between 40k-60k (realistic, not doubled)
-- ═══════════════════════════════════════════════════════════════════



