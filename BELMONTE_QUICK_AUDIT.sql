-- ============================================================================
-- BELMONTE QUICK AUDIT - For Supabase SQL Editor
-- ============================================================================
-- Copy and paste these queries ONE AT A TIME into Supabase SQL Editor
-- ============================================================================

-- QUERY 1: CLIENT INFO & TOKEN STATUS
-- ============================================================================
SELECT 
  '🏨 BELMONTE CLIENT INFO' as audit_section,
  id,
  name,
  email,
  CASE 
    WHEN system_user_token IS NOT NULL THEN '✅ PERMANENT TOKEN (System User)'
    WHEN meta_access_token IS NOT NULL THEN '⚠️ TEMPORARY TOKEN (60-day)'
    ELSE '❌ NO TOKEN'
  END as token_status,
  google_ads_enabled,
  created_at
FROM clients
WHERE id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

-- ============================================================================
-- QUERY 2: EXECUTIVE SUMMARY (MOST IMPORTANT!)
-- ============================================================================
SELECT 
  '📊 EXECUTIVE SUMMARY' as audit_section,
  '🏨 Belmonte Hotel' as client,
  (SELECT COUNT(DISTINCT summary_date) 
   FROM campaign_summaries 
   WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa' 
     AND summary_type = 'monthly' 
     AND platform = 'meta') as meta_months_stored,
  (SELECT COUNT(DISTINCT summary_date) 
   FROM campaign_summaries 
   WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa' 
     AND summary_type = 'monthly' 
     AND platform = 'google') as google_months_stored,
  (SELECT MIN(summary_date) 
   FROM campaign_summaries 
   WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa') as earliest_data,
  (SELECT MAX(summary_date) 
   FROM campaign_summaries 
   WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa') as latest_data,
  (SELECT COUNT(*) 
   FROM campaign_summaries 
   WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa' 
     AND total_spend = 0) as zero_spend_records,
  (SELECT COUNT(*) 
   FROM campaign_summaries 
   WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa' 
     AND (campaign_data IS NULL OR jsonb_array_length(campaign_data) = 0)) as empty_campaign_data_records;

-- ============================================================================
-- QUERY 3: MONTHLY DATA (META) - LAST 12 MONTHS
-- ============================================================================
SELECT 
  '📅 MONTHLY DATA (META)' as audit_section,
  summary_date,
  platform,
  total_spend,
  total_impressions,
  total_clicks,
  total_conversions,
  reservations,
  reservation_value,
  CASE 
    WHEN campaign_data IS NULL THEN '❌ NULL'
    WHEN jsonb_array_length(campaign_data) = 0 THEN '⚠️ EMPTY'
    ELSE '✅ ' || jsonb_array_length(campaign_data)::text || ' campaigns'
  END as campaign_data_status,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI') as last_updated
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'monthly'
  AND platform = 'meta'
  AND summary_date >= CURRENT_DATE - INTERVAL '12 months'
ORDER BY summary_date DESC;

-- ============================================================================
-- QUERY 4: MONTHLY DATA (GOOGLE) - LAST 12 MONTHS
-- ============================================================================
SELECT 
  '📅 MONTHLY DATA (GOOGLE)' as audit_section,
  summary_date,
  platform,
  total_spend,
  total_impressions,
  total_clicks,
  total_conversions,
  reservations,
  reservation_value,
  CASE 
    WHEN campaign_data IS NULL THEN '❌ NULL'
    WHEN jsonb_array_length(campaign_data) = 0 THEN '⚠️ EMPTY'
    ELSE '✅ ' || jsonb_array_length(campaign_data)::text || ' campaigns'
  END as campaign_data_status,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI') as last_updated
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'monthly'
  AND platform = 'google'
  AND summary_date >= CURRENT_DATE - INTERVAL '12 months'
ORDER BY summary_date DESC;

-- ============================================================================
-- QUERY 5: DATA QUALITY - PROBLEMS
-- ============================================================================
SELECT 
  '⚠️ DATA QUALITY ISSUES' as audit_section,
  summary_date,
  platform,
  summary_type,
  total_spend,
  total_conversions,
  CASE 
    WHEN total_spend = 0 AND total_impressions = 0 THEN '❌ ALL ZEROS'
    WHEN campaign_data IS NULL THEN '❌ NULL campaign_data'
    WHEN jsonb_array_length(campaign_data) = 0 THEN '❌ EMPTY campaign_data'
    WHEN reservations = 0 AND reservation_value = 0 THEN '⚠️ NO CONVERSIONS'
    ELSE '✅ OK'
  END as issue_type
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND (
    total_spend = 0 
    OR campaign_data IS NULL 
    OR jsonb_array_length(campaign_data) = 0
    OR (reservations = 0 AND reservation_value = 0)
  )
ORDER BY summary_date DESC
LIMIT 20;

-- ============================================================================
-- QUERY 6: YEAR-OVER-YEAR CHECK (2024 vs 2025)
-- ============================================================================
SELECT 
  '📊 YEAR-OVER-YEAR DATA' as audit_section,
  DATE_PART('year', summary_date) as year,
  DATE_PART('month', summary_date) as month,
  TO_CHAR(summary_date, 'Month YYYY') as period_name,
  platform,
  COUNT(*) as periods_available,
  SUM(total_spend) as total_spend,
  SUM(reservations) as total_reservations
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'monthly'
  AND summary_date >= '2024-01-01'
GROUP BY year, month, period_name, platform
ORDER BY year DESC, month DESC, platform;

-- ============================================================================
-- QUERY 7: MISSING PERIODS ANALYSIS
-- ============================================================================
WITH expected_months AS (
  SELECT 
    DATE_TRUNC('month', CURRENT_DATE - (n || ' months')::interval)::date as expected_date
  FROM generate_series(0, 11) n
),
actual_months_meta AS (
  SELECT DISTINCT summary_date
  FROM campaign_summaries
  WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
    AND summary_type = 'monthly'
    AND platform = 'meta'
),
actual_months_google AS (
  SELECT DISTINCT summary_date
  FROM campaign_summaries
  WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
    AND summary_type = 'monthly'
    AND platform = 'google'
)
SELECT 
  '📊 MISSING PERIODS' as audit_section,
  TO_CHAR(em.expected_date, 'Month YYYY') as period,
  em.expected_date,
  CASE 
    WHEN am.summary_date IS NOT NULL THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as meta_status,
  CASE 
    WHEN ag.summary_date IS NOT NULL THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as google_status
FROM expected_months em
LEFT JOIN actual_months_meta am ON em.expected_date = am.summary_date
LEFT JOIN actual_months_google ag ON em.expected_date = ag.summary_date
ORDER BY em.expected_date DESC;

-- ============================================================================
-- QUERY 8: CURRENT CACHE STATUS
-- ============================================================================
SELECT 
  '🔄 CURRENT CACHE STATUS' as audit_section,
  'Current Month' as cache_type,
  period_id,
  TO_CHAR(cached_at, 'YYYY-MM-DD HH24:MI') as cached_at,
  TO_CHAR(expires_at, 'YYYY-MM-DD HH24:MI') as expires_at,
  CASE 
    WHEN expires_at > NOW() THEN '✅ FRESH'
    WHEN expires_at > NOW() - INTERVAL '3 hours' THEN '⚠️ STALE'
    ELSE '❌ EXPIRED'
  END as status,
  ROUND(EXTRACT(EPOCH FROM (NOW() - cached_at)) / 3600, 1) as hours_old
FROM current_month_cache
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
ORDER BY cached_at DESC
LIMIT 5;

-- ============================================================================
-- INTERPRETATION GUIDE
-- ============================================================================
/*

HOW TO INTERPRET RESULTS:

✅ HEALTHY SYSTEM:
- meta_months_stored: 12-13
- google_months_stored: 12-13
- earliest_data: 2024-XX-XX or earlier
- zero_spend_records: 0
- empty_campaign_data_records: 0
- All periods show "✅ EXISTS"
- No data quality issues

⚠️ NEEDS ATTENTION:
- meta_months_stored: 6-11 (incomplete)
- Some "❌ MISSING" periods
- 1-5 zero_spend_records
- 1-5 empty_campaign_data_records

🔴 CRITICAL PROBLEMS:
- meta_months_stored: 0-5 (severe gap)
- Many "❌ MISSING" periods
- Many zero_spend_records
- All campaign_data empty
- No 2024 data

NEXT STEPS:
1. Focus on QUERY 2 (Executive Summary) first
2. If problems found, check QUERY 5 (Data Quality Issues)
3. For YoY issues, check QUERY 6 (Year-over-Year Data)
4. For missing periods, check QUERY 7 (Missing Periods)

*/

