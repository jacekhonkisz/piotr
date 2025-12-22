-- ============================================================================
-- COMPREHENSIVE AUDIT: Monthly Report Periods in Historical Databases
-- ============================================================================
-- Purpose: Audit what monthly report periods exist in campaign_summaries 
--          and monthly_summaries tables for all clients
-- ============================================================================

-- 1️⃣ OVERVIEW: Total monthly records by table and platform
SELECT 
  '1️⃣ OVERVIEW BY TABLE & PLATFORM' as audit_section,
  'campaign_summaries' as table_name,
  summary_type,
  platform,
  COUNT(*) as total_records,
  COUNT(DISTINCT client_id) as unique_clients,
  COUNT(DISTINCT TO_CHAR(summary_date, 'YYYY-MM')) as unique_months,
  MIN(summary_date) as earliest_month,
  MAX(summary_date) as latest_month,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend_all_clients
FROM campaign_summaries
WHERE summary_type = 'monthly'
GROUP BY summary_type, platform
ORDER BY platform;

-- Check monthly_summaries table if it exists
SELECT 
  '1️⃣ OVERVIEW BY TABLE & PLATFORM' as audit_section,
  'monthly_summaries' as table_name,
  'monthly' as summary_type,
  platform,
  COUNT(*) as total_records,
  COUNT(DISTINCT client_id) as unique_clients,
  COUNT(DISTINCT TO_CHAR(summary_date, 'YYYY-MM')) as unique_months,
  MIN(summary_date) as earliest_month,
  MAX(summary_date) as latest_month,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend_all_clients
FROM monthly_summaries
GROUP BY platform
ORDER BY platform;

-- 2️⃣ MONTHLY COVERAGE BY CLIENT: Which clients have monthly data?
SELECT 
  '2️⃣ MONTHLY COVERAGE BY CLIENT' as audit_section,
  c.name as client_name,
  cs.client_id,
  cs.platform,
  COUNT(*) as monthly_records,
  COUNT(DISTINCT TO_CHAR(cs.summary_date, 'YYYY-MM')) as unique_months,
  MIN(cs.summary_date) as earliest_month,
  MAX(cs.summary_date) as latest_month,
  ROUND(SUM(cs.total_spend)::numeric, 2) as total_spend,
  ROUND(AVG(cs.total_spend)::numeric, 2) as avg_monthly_spend
FROM campaign_summaries cs
LEFT JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'monthly'
GROUP BY c.name, cs.client_id, cs.platform
ORDER BY c.name, cs.platform;

-- 3️⃣ MONTH-BY-MONTH BREAKDOWN: All monthly periods with client details
SELECT 
  '3️⃣ MONTH-BY-MONTH BREAKDOWN' as audit_section,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as period,
  cs.summary_date,
  c.name as client_name,
  cs.platform,
  cs.total_spend,
  cs.total_impressions,
  cs.total_clicks,
  cs.reservations,
  cs.reservation_value,
  CASE 
    WHEN cs.meta_tables IS NOT NULL AND cs.meta_tables::text != 'null' THEN '✅ Has Meta Tables'
    ELSE '❌ No Meta Tables'
  END as meta_tables_status,
  CASE 
    WHEN cs.campaign_data IS NOT NULL AND jsonb_array_length(cs.campaign_data) > 0 THEN '✅ Has Campaigns'
    ELSE '❌ No Campaigns'
  END as campaign_data_status,
  DATE(cs.created_at) as created_date,
  DATE(cs.updated_at) as updated_date
FROM campaign_summaries cs
LEFT JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'monthly'
ORDER BY cs.summary_date DESC, c.name, cs.platform
LIMIT 100;

-- 4️⃣ GAP ANALYSIS: Find missing months for each client
WITH RECURSIVE month_series AS (
  -- Generate last 24 months
  SELECT DATE_TRUNC('month', CURRENT_DATE - INTERVAL '23 months')::date as month_start
  UNION ALL
  SELECT (month_start + INTERVAL '1 month')::date
  FROM month_series
  WHERE month_start < DATE_TRUNC('month', CURRENT_DATE)::date
),
client_months AS (
  SELECT DISTINCT
    cs.client_id,
    c.name as client_name,
    cs.platform,
    DATE_TRUNC('month', cs.summary_date)::date as month_start
  FROM campaign_summaries cs
  LEFT JOIN clients c ON c.id = cs.client_id
  WHERE cs.summary_type = 'monthly'
),
missing_months AS (
  SELECT 
    cm.client_id,
    cm.client_name,
    cm.platform,
    ms.month_start,
    CASE 
      WHEN cm.month_start IS NULL THEN '❌ Missing'
      ELSE '✅ Exists'
    END as status
  FROM month_series ms
  CROSS JOIN (SELECT DISTINCT client_id, client_name, platform FROM client_months) cm
  LEFT JOIN client_months cm2 ON 
    cm2.client_id = cm.client_id 
    AND cm2.platform = cm.platform
    AND cm2.month_start = ms.month_start
  WHERE cm2.month_start IS NULL
)
SELECT 
  '4️⃣ GAP ANALYSIS - MISSING MONTHS' as audit_section,
  client_name,
  platform,
  TO_CHAR(month_start, 'YYYY-MM') as missing_period,
  status
FROM missing_months
ORDER BY client_name, platform, month_start DESC;

-- 5️⃣ DATA QUALITY CHECK: Records with zero or null values
SELECT 
  '5️⃣ DATA QUALITY CHECK' as audit_section,
  COUNT(*) FILTER (WHERE total_spend = 0) as zero_spend_records,
  COUNT(*) FILTER (WHERE total_impressions = 0) as zero_impressions_records,
  COUNT(*) FILTER (WHERE total_clicks = 0) as zero_clicks_records,
  COUNT(*) FILTER (WHERE meta_tables IS NULL) as missing_meta_tables,
  COUNT(*) FILTER (WHERE campaign_data IS NULL OR jsonb_array_length(campaign_data) = 0) as missing_campaign_data,
  COUNT(*) FILTER (WHERE reservations IS NULL OR reservations = 0) as missing_reservations,
  COUNT(*) as total_monthly_records
FROM campaign_summaries
WHERE summary_type = 'monthly';

-- 6️⃣ RECENT MONTHS DETAIL: Last 6 months with full details
SELECT 
  '6️⃣ RECENT MONTHS DETAIL (LAST 6 MONTHS)' as audit_section,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as period,
  c.name as client_name,
  cs.platform,
  cs.total_spend,
  cs.total_impressions,
  cs.total_clicks,
  cs.reservations,
  cs.reservation_value,
  CASE 
    WHEN cs.reservations > 0 AND cs.total_spend > 0 
    THEN ROUND((cs.reservation_value::numeric / cs.total_spend::numeric)::numeric, 2)
    ELSE 0
  END as roas,
  jsonb_array_length(cs.campaign_data) as campaign_count,
  DATE(cs.created_at) as created_date
FROM campaign_summaries cs
LEFT JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'monthly'
  AND cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '6 months')::date
ORDER BY cs.summary_date DESC, c.name, cs.platform;

-- 7️⃣ PLATFORM COMPARISON: Meta vs Google monthly data
SELECT 
  '7️⃣ PLATFORM COMPARISON' as audit_section,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as period,
  c.name as client_name,
  COUNT(*) FILTER (WHERE cs.platform = 'meta') as meta_records,
  COUNT(*) FILTER (WHERE cs.platform = 'google') as google_records,
  SUM(CASE WHEN cs.platform = 'meta' THEN cs.total_spend ELSE 0 END)::numeric(10,2) as meta_spend,
  SUM(CASE WHEN cs.platform = 'google' THEN cs.total_spend ELSE 0 END)::numeric(10,2) as google_spend,
  CASE 
    WHEN COUNT(*) FILTER (WHERE cs.platform = 'meta') > 0 
     AND COUNT(*) FILTER (WHERE cs.platform = 'google') > 0 
    THEN '✅ Both Platforms'
    WHEN COUNT(*) FILTER (WHERE cs.platform = 'meta') > 0 
    THEN 'Meta Only'
    WHEN COUNT(*) FILTER (WHERE cs.platform = 'google') > 0 
    THEN 'Google Only'
    ELSE '❌ No Data'
  END as platform_coverage
FROM campaign_summaries cs
LEFT JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'monthly'
  AND cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')::date
GROUP BY TO_CHAR(cs.summary_date, 'YYYY-MM'), cs.summary_date, c.name
ORDER BY cs.summary_date DESC, c.name;

-- 8️⃣ SUMMARY STATISTICS: Overall monthly data health
SELECT 
  '8️⃣ SUMMARY STATISTICS' as audit_section,
  COUNT(DISTINCT client_id) as clients_with_monthly_data,
  COUNT(DISTINCT platform) as platforms_tracked,
  COUNT(*) as total_monthly_records,
  COUNT(DISTINCT TO_CHAR(summary_date, 'YYYY-MM')) as unique_monthly_periods,
  MIN(summary_date) as earliest_month,
  MAX(summary_date) as latest_month,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend_all_time,
  ROUND(AVG(total_spend)::numeric, 2) as avg_monthly_spend,
  COUNT(*) FILTER (WHERE meta_tables IS NOT NULL AND meta_tables::text != 'null') as records_with_meta_tables,
  COUNT(*) FILTER (WHERE campaign_data IS NOT NULL AND jsonb_array_length(campaign_data) > 0) as records_with_campaigns
FROM campaign_summaries
WHERE summary_type = 'monthly';

-- 9️⃣ YEAR-OVER-YEAR COMPARISON: Check if we have data for YoY analysis
SELECT 
  '9️⃣ YEAR-OVER-YEAR DATA AVAILABILITY' as audit_section,
  EXTRACT(YEAR FROM summary_date) as year,
  EXTRACT(MONTH FROM summary_date) as month,
  TO_CHAR(summary_date, 'YYYY-MM') as period,
  COUNT(DISTINCT client_id) as clients,
  COUNT(DISTINCT platform) as platforms,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend
FROM campaign_summaries
WHERE summary_type = 'monthly'
  AND summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '24 months')::date
GROUP BY EXTRACT(YEAR FROM summary_date), EXTRACT(MONTH FROM summary_date), summary_date
ORDER BY year DESC, month DESC;

-- 🔟 CLIENT-SPECIFIC DETAIL: Belmonte Hotel (most active client)
SELECT 
  '🔟 BELMONTE HOTEL MONTHLY DATA' as audit_section,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as period,
  cs.platform,
  cs.total_spend,
  cs.total_impressions,
  cs.total_clicks,
  cs.reservations,
  cs.reservation_value,
  jsonb_array_length(cs.campaign_data) as campaign_count,
  CASE 
    WHEN cs.meta_tables IS NOT NULL AND cs.meta_tables::text != 'null' THEN '✅'
    ELSE '❌'
  END as has_meta_tables,
  DATE(cs.created_at) as created_date
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'monthly'
ORDER BY cs.summary_date DESC, cs.platform;



