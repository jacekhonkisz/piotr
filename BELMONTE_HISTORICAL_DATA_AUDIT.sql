-- ============================================================================
-- BELMONTE HISTORICAL DATA AUDIT - PAST PERIOD STORAGE INVESTIGATION
-- ============================================================================
-- Date: November 6, 2025
-- Client: Belmonte Hotel (Only client with permanent token)
-- Client ID: ab0b4c7e-2bf0-46bc-b455-b18ef6942baa
-- Purpose: Audit why past period data is not being fetched from database
-- ============================================================================

-- ============================================================================
-- 1. CLIENT INFORMATION & TOKEN STATUS
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
  ad_account_id,
  google_ads_enabled,
  google_ads_customer_id,
  created_at
FROM clients
WHERE id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

-- ============================================================================
-- 2. CAMPAIGN_SUMMARIES TABLE - HISTORICAL DATA STORAGE
-- ============================================================================

-- 2.1 Overview: All stored periods for Belmonte
SELECT 
  '📊 STORED HISTORICAL PERIODS' as audit_section,
  platform,
  summary_type,
  COUNT(*) as total_periods,
  MIN(summary_date) as earliest_period,
  MAX(summary_date) as latest_period,
  SUM(total_spend) as total_spend_all_periods,
  SUM(total_conversions) as total_conversions_all_periods
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
GROUP BY platform, summary_type
ORDER BY platform, summary_type;

-- 2.2 Detailed: Last 12 months of MONTHLY data (Meta)
SELECT 
  '📅 MONTHLY DATA (META) - LAST 12 MONTHS' as audit_section,
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
    WHEN jsonb_array_length(campaign_data) = 0 THEN '⚠️ EMPTY ARRAY'
    ELSE '✅ ' || jsonb_array_length(campaign_data)::text || ' campaigns'
  END as campaign_data_status,
  last_updated,
  created_at
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'monthly'
  AND platform = 'meta'
  AND summary_date >= CURRENT_DATE - INTERVAL '12 months'
ORDER BY summary_date DESC;

-- 2.3 Detailed: Last 12 months of MONTHLY data (Google Ads)
SELECT 
  '📅 MONTHLY DATA (GOOGLE ADS) - LAST 12 MONTHS' as audit_section,
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
    WHEN jsonb_array_length(campaign_data) = 0 THEN '⚠️ EMPTY ARRAY'
    ELSE '✅ ' || jsonb_array_length(campaign_data)::text || ' campaigns'
  END as campaign_data_status,
  last_updated,
  created_at
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'monthly'
  AND platform = 'google'
  AND summary_date >= CURRENT_DATE - INTERVAL '12 months'
ORDER BY summary_date DESC;

-- 2.4 Detailed: Weekly data for last 3 months
SELECT 
  '📅 WEEKLY DATA - LAST 3 MONTHS' as audit_section,
  summary_date,
  platform,
  summary_type,
  total_spend,
  total_conversions,
  reservations,
  CASE 
    WHEN campaign_data IS NULL THEN '❌ NULL'
    WHEN jsonb_array_length(campaign_data) = 0 THEN '⚠️ EMPTY ARRAY'
    ELSE '✅ ' || jsonb_array_length(campaign_data)::text || ' campaigns'
  END as campaign_data_status,
  last_updated
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'weekly'
  AND summary_date >= CURRENT_DATE - INTERVAL '3 months'
ORDER BY platform, summary_date DESC;

-- ============================================================================
-- 3. PAST YEAR DATA - YEAR-OVER-YEAR COMPARISON AVAILABILITY
-- ============================================================================

-- 3.1 Check if we have data from 2024 (for 2024 vs 2025 comparisons)
SELECT 
  '📊 PAST YEAR DATA (2024)' as audit_section,
  DATE_PART('year', summary_date) as year,
  DATE_PART('month', summary_date) as month,
  platform,
  summary_type,
  COUNT(*) as periods_available,
  SUM(total_spend) as total_spend,
  SUM(total_conversions) as total_conversions
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_date >= '2024-01-01'
  AND summary_date < '2025-01-01'
GROUP BY year, month, platform, summary_type
ORDER BY year DESC, month DESC, platform, summary_type;

-- 3.2 Check if we have data from previous months of 2025
SELECT 
  '📊 YEAR 2025 DATA BY MONTH' as audit_section,
  DATE_PART('month', summary_date) as month,
  TO_CHAR(summary_date, 'Month YYYY') as period_name,
  platform,
  summary_type,
  COUNT(*) as periods_count,
  SUM(total_spend) as total_spend,
  SUM(reservations) as total_reservations
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_date >= '2025-01-01'
GROUP BY month, period_name, platform, summary_type
ORDER BY month DESC, platform, summary_type;

-- ============================================================================
-- 4. DATA QUALITY AUDIT - CHECKING FOR EMPTY OR INCOMPLETE RECORDS
-- ============================================================================

-- 4.1 Records with ZERO spend (potential data collection issues)
SELECT 
  '⚠️ ZERO SPEND RECORDS' as audit_section,
  summary_date,
  platform,
  summary_type,
  total_spend,
  total_impressions,
  total_clicks,
  CASE 
    WHEN campaign_data IS NULL THEN 'NULL campaign_data'
    WHEN jsonb_array_length(campaign_data) = 0 THEN 'EMPTY campaign_data'
    ELSE jsonb_array_length(campaign_data)::text || ' campaigns'
  END as issue,
  last_updated
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND total_spend = 0
ORDER BY summary_date DESC
LIMIT 20;

-- 4.2 Records with NO conversion data (incomplete funnel metrics)
SELECT 
  '⚠️ MISSING CONVERSION DATA' as audit_section,
  summary_date,
  platform,
  summary_type,
  total_spend,
  total_conversions,
  reservations,
  reservation_value,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  CASE 
    WHEN reservations = 0 AND reservation_value = 0 AND booking_step_1 = 0 THEN '❌ ALL CONVERSIONS ZERO'
    WHEN reservations IS NULL AND reservation_value IS NULL THEN '❌ CONVERSIONS NULL'
    ELSE '⚠️ PARTIAL DATA'
  END as issue
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND (
    (reservations = 0 AND reservation_value = 0 AND booking_step_1 = 0)
    OR (reservations IS NULL AND reservation_value IS NULL)
  )
ORDER BY summary_date DESC
LIMIT 20;

-- 4.3 Records with NULL or EMPTY campaign_data
SELECT 
  '⚠️ EMPTY CAMPAIGN DATA' as audit_section,
  summary_date,
  platform,
  summary_type,
  total_spend,
  total_conversions,
  CASE 
    WHEN campaign_data IS NULL THEN '❌ NULL'
    WHEN jsonb_array_length(campaign_data) = 0 THEN '❌ EMPTY ARRAY'
    ELSE '✅ Has campaigns'
  END as campaign_data_status,
  last_updated
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND (campaign_data IS NULL OR jsonb_array_length(campaign_data) = 0)
ORDER BY summary_date DESC
LIMIT 20;

-- ============================================================================
-- 5. DAILY_KPI_DATA TABLE - GRANULAR DAILY METRICS
-- ============================================================================

-- 5.1 Daily data availability for last 90 days
SELECT 
  '📊 DAILY KPI DATA AVAILABILITY' as audit_section,
  data_source,
  COUNT(DISTINCT date) as days_with_data,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  SUM(total_spend) as total_spend,
  SUM(total_conversions) as total_conversions,
  SUM(reservations) as total_reservations
FROM daily_kpi_data
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY data_source
ORDER BY data_source;

-- 5.2 Sample of recent daily data (last 10 days)
SELECT 
  '📅 RECENT DAILY DATA SAMPLE' as audit_section,
  date,
  data_source,
  total_spend,
  total_impressions,
  total_clicks,
  total_conversions,
  reservations,
  reservation_value,
  booking_step_1,
  booking_step_2,
  booking_step_3
FROM daily_kpi_data
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND date >= CURRENT_DATE - INTERVAL '10 days'
ORDER BY date DESC, data_source;

-- ============================================================================
-- 6. CURRENT MONTH/WEEK CACHE STATUS
-- ============================================================================

-- 6.1 Current month cache
SELECT 
  '🔄 CURRENT MONTH CACHE' as audit_section,
  period_id,
  platform,
  cached_at,
  expires_at,
  CASE 
    WHEN expires_at > NOW() THEN '✅ FRESH (Valid)'
    WHEN expires_at > NOW() - INTERVAL '3 hours' THEN '⚠️ STALE (Needs refresh)'
    ELSE '❌ EXPIRED'
  END as cache_status,
  EXTRACT(EPOCH FROM (NOW() - cached_at)) / 3600 as hours_old,
  (data->>'totalSpend')::numeric as total_spend,
  (data->'campaigns')::jsonb as campaigns_count
FROM current_month_cache
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
ORDER BY cached_at DESC
LIMIT 5;

-- 6.2 Current week cache
SELECT 
  '🔄 CURRENT WEEK CACHE' as audit_section,
  period_id,
  platform,
  cached_at,
  expires_at,
  CASE 
    WHEN expires_at > NOW() THEN '✅ FRESH (Valid)'
    WHEN expires_at > NOW() - INTERVAL '3 hours' THEN '⚠️ STALE (Needs refresh)'
    ELSE '❌ EXPIRED'
  END as cache_status,
  EXTRACT(EPOCH FROM (NOW() - cached_at)) / 3600 as hours_old
FROM current_week_cache
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
ORDER BY cached_at DESC
LIMIT 5;

-- ============================================================================
-- 7. DATA GAPS ANALYSIS - IDENTIFYING MISSING PERIODS
-- ============================================================================

-- 7.1 Generate expected months for last 12 months and check which are missing
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
  '📊 MISSING PERIODS ANALYSIS' as audit_section,
  TO_CHAR(em.expected_date, 'Month YYYY') as period,
  em.expected_date,
  CASE 
    WHEN am.summary_date IS NOT NULL THEN '✅ Meta data exists'
    ELSE '❌ Meta data MISSING'
  END as meta_status,
  CASE 
    WHEN ag.summary_date IS NOT NULL THEN '✅ Google data exists'
    ELSE '❌ Google data MISSING'
  END as google_status
FROM expected_months em
LEFT JOIN actual_months_meta am ON em.expected_date = am.summary_date
LEFT JOIN actual_months_google ag ON em.expected_date = ag.summary_date
ORDER BY em.expected_date DESC;

-- ============================================================================
-- 8. BACKGROUND DATA COLLECTOR AUDIT
-- ============================================================================

-- 8.1 Check when data was last collected/updated
SELECT 
  '⏰ DATA FRESHNESS' as audit_section,
  summary_type,
  platform,
  MAX(last_updated) as most_recent_update,
  MAX(created_at) as most_recent_creation,
  EXTRACT(EPOCH FROM (NOW() - MAX(last_updated))) / 3600 as hours_since_update,
  COUNT(*) as total_records
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
GROUP BY summary_type, platform
ORDER BY summary_type, platform;

-- ============================================================================
-- 9. EXAMPLE QUERY: HOW SYSTEM SHOULD FETCH OCTOBER 2024 DATA
-- ============================================================================

-- 9.1 Simulate database query for October 2024 (historical period)
SELECT 
  '🔍 TEST QUERY: October 2024 Data Fetch' as audit_section,
  summary_date,
  platform,
  summary_type,
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
  END as campaigns_status,
  last_updated
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'monthly'
  AND summary_date = '2024-10-01'
ORDER BY platform;

-- 9.2 Simulate database query for current month (November 2025)
SELECT 
  '🔍 TEST QUERY: November 2025 Data Fetch' as audit_section,
  summary_date,
  platform,
  summary_type,
  total_spend,
  total_conversions,
  reservations,
  CASE 
    WHEN campaign_data IS NULL THEN '❌ NULL'
    WHEN jsonb_array_length(campaign_data) = 0 THEN '⚠️ EMPTY'
    ELSE '✅ ' || jsonb_array_length(campaign_data)::text || ' campaigns'
  END as campaigns_status
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'monthly'
  AND summary_date = '2025-11-01'
ORDER BY platform;

-- ============================================================================
-- 10. EXECUTIVE SUMMARY - KEY METRICS
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
-- END OF AUDIT
-- ============================================================================

/*
EXPECTED RESULTS ANALYSIS:

✅ HEALTHY DATABASE:
- Meta months stored: 12-13 months
- Google months stored: 12-13 months (if Google Ads enabled)
- Earliest data: ~12 months ago
- Latest data: Current month (November 2025)
- Zero spend records: 0 (or very few test records)
- Empty campaign_data: 0 (should all have campaign details)

❌ PROBLEMATIC ISSUES TO LOOK FOR:
1. Missing periods (gaps in monthly/weekly data)
2. Zero spend records (data collection failures)
3. NULL or empty campaign_data (incomplete storage)
4. No data before 2025 (can't do year-over-year comparisons)
5. Outdated last_updated timestamps (background collector not running)
6. All conversion metrics = 0 (funnel data not being collected)

🔍 NEXT STEPS BASED ON FINDINGS:
- If missing periods → Run background data collector manually
- If zero spend → Check Meta API credentials and permissions
- If empty campaign_data → Fix data storage logic in collector
- If no 2024 data → Backfill historical data or disable YoY comparisons
- If outdated timestamps → Restart/fix background collector service
*/








