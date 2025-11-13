-- COMPREHENSIVE AUDIT: Verify proper data separation for Belmonte
-- Checks: Periods (weekly/monthly), Platforms (Meta/Google), Past Year Coverage

-- 1. OVERVIEW: Total records by period and platform
SELECT 
  '1️⃣ OVERVIEW BY PERIOD & PLATFORM' as audit_check,
  summary_type,
  platform,
  COUNT(*) as total_records,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend,
  MIN(summary_date) as earliest_date,
  MAX(summary_date) as latest_date,
  COUNT(DISTINCT TO_CHAR(summary_date, 'YYYY-MM')) as unique_months
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
GROUP BY summary_type, platform
ORDER BY summary_type, platform;

-- 2. MONTHLY COVERAGE: Check which months have both platforms
  SELECT 
  '2️⃣ MONTHLY - PLATFORM COVERAGE' as audit_check,
  TO_CHAR(summary_date, 'YYYY-MM') as month,
  ARRAY_AGG(DISTINCT platform ORDER BY platform) as platforms,
  COUNT(DISTINCT platform) as platform_count,
  STRING_AGG(DISTINCT data_source, ', ' ORDER BY data_source) as data_sources,
  SUM(CASE WHEN platform = 'meta' THEN total_spend ELSE 0 END)::numeric(10,2) as meta_spend,
  SUM(CASE WHEN platform = 'google' THEN total_spend ELSE 0 END)::numeric(10,2) as google_spend,
  SUM(total_spend)::numeric(10,2) as combined_spend
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'monthly'
  AND summary_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY TO_CHAR(summary_date, 'YYYY-MM')
ORDER BY month DESC;

-- 3. WEEKLY COVERAGE: Sample of weeks with platform breakdown
SELECT 
  '3️⃣ WEEKLY - PLATFORM COVERAGE (RECENT)' as audit_check,
  TO_CHAR(summary_date, 'YYYY-MM') as month,
  COUNT(*) as week_records,
  ARRAY_AGG(DISTINCT platform ORDER BY platform) as platforms,
  COUNT(DISTINCT platform) as platform_count,
  SUM(total_spend)::numeric(10,2) as total_spend
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'weekly'
  AND summary_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY TO_CHAR(summary_date, 'YYYY-MM')
ORDER BY month DESC;

-- 4. DATA SOURCE VERIFICATION: Ensure correct sources per platform
SELECT 
  '4️⃣ DATA SOURCE CORRECTNESS' as audit_check,
  platform,
  data_source,
  summary_type,
  COUNT(*) as records,
  CASE 
    WHEN platform = 'google' AND data_source LIKE '%google%' THEN '✅ Correct'
    WHEN platform = 'meta' AND data_source LIKE '%meta%' THEN '✅ Correct'
    WHEN data_source LIKE '%archive%' THEN '✅ Archive'
    ELSE '❌ WRONG SOURCE'
  END as status
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY platform, data_source, summary_type
ORDER BY platform, summary_type, data_source;

-- 5. GAPS ANALYSIS: Months missing either platform
SELECT 
  '5️⃣ GAPS - MONTHS MISSING A PLATFORM' as audit_check,
  TO_CHAR(summary_date, 'YYYY-MM') as month,
  summary_type,
  ARRAY_AGG(DISTINCT platform ORDER BY platform) as existing_platforms,
  CASE 
    WHEN COUNT(DISTINCT platform) = 2 THEN '✅ Both platforms'
    WHEN 'google' = ANY(ARRAY_AGG(DISTINCT platform)) THEN '⚠️ Missing Meta'
    WHEN 'meta' = ANY(ARRAY_AGG(DISTINCT platform)) THEN '⚠️ Missing Google'
    ELSE '❌ Unknown platform'
  END as status
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY TO_CHAR(summary_date, 'YYYY-MM'), summary_type
HAVING COUNT(DISTINCT platform) < 2
ORDER BY month DESC, summary_type;

-- 6. CURRENT MONTH STATUS: Most important data
SELECT 
  '6️⃣ CURRENT MONTH STATUS' as audit_check,
  TO_CHAR(CURRENT_DATE, 'YYYY-MM') as current_month,
  summary_type,
  platform,
  total_spend,
  active_campaigns,
  data_source,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI') as last_updated
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND TO_CHAR(summary_date, 'YYYY-MM') = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
ORDER BY summary_type, platform;

-- 7. OCTOBER 2025 DETAILED CHECK (the problematic month)
SELECT 
  '7️⃣ OCTOBER 2025 DETAILED' as audit_check,
  summary_type,
  platform,
  data_source,
  total_spend,
  total_impressions,
  total_clicks,
  active_campaigns,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_date >= '2025-10-01'
  AND summary_date <= '2025-10-31'
ORDER BY summary_type, platform;

-- 8. SUMMARY STATISTICS
SELECT 
  '8️⃣ FINAL STATISTICS' as audit_check,
  COUNT(*) as total_records,
  COUNT(DISTINCT platform) as platforms_used,
  COUNT(DISTINCT summary_type) as summary_types,
  COUNT(DISTINCT TO_CHAR(summary_date, 'YYYY-MM')) as months_covered,
  MIN(summary_date) as earliest_data,
  MAX(summary_date) as latest_data,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend_all_time,
  SUM(CASE WHEN platform = 'google' THEN 1 ELSE 0 END) as google_records,
  SUM(CASE WHEN platform = 'meta' THEN 1 ELSE 0 END) as meta_records
  FROM campaign_summaries 
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_date >= CURRENT_DATE - INTERVAL '12 months';
