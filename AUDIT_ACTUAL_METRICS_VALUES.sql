-- ============================================================================
-- AUDIT ACTUAL METRICS VALUES - CHECK FOR ZEROS
-- ============================================================================
-- Purpose: Verify that data has real metrics, not just zeros
-- ============================================================================

-- ============================================================================
-- 1. CHECK CAMPAIGN SUMMARIES FOR ACTUAL DATA
-- ============================================================================
SELECT 
  '📊 CAMPAIGN SUMMARIES - ACTUAL VALUES' as report_section,
  c.name as client_name,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as month,
  cs.total_spend,
  cs.total_impressions,
  cs.total_clicks,
  cs.total_conversions,
  CASE 
    WHEN cs.total_spend = 0 AND cs.total_impressions = 0 AND cs.total_clicks = 0 THEN '❌ ALL ZEROS'
    WHEN cs.total_spend > 0 THEN '✅ HAS DATA'
    ELSE '⚠️ PARTIAL'
  END as data_status,
  cs.data_source,
  cs.last_updated
FROM clients c
JOIN campaign_summaries cs ON cs.client_id = c.id
WHERE cs.summary_type = 'monthly'
  AND cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months')
ORDER BY c.name, cs.summary_date DESC;

-- ============================================================================
-- 2. COUNT RECORDS WITH ZEROS vs REAL DATA
-- ============================================================================
SELECT 
  '📈 ZEROS VS REAL DATA COUNT' as report_section,
  COUNT(*) as total_records,
  COUNT(CASE WHEN total_spend = 0 AND total_impressions = 0 THEN 1 END) as records_with_all_zeros,
  COUNT(CASE WHEN total_spend > 0 OR total_impressions > 0 THEN 1 END) as records_with_real_data,
  ROUND(
    (COUNT(CASE WHEN total_spend > 0 OR total_impressions > 0 THEN 1 END)::numeric / 
     COUNT(*)::numeric * 100), 
    1
  ) as percent_with_real_data
FROM campaign_summaries
WHERE summary_type = 'monthly'
  AND summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months');

-- ============================================================================
-- 3. CHECK CAMPAIGN_DATA JSONB FOR ACTUAL CAMPAIGNS
-- ============================================================================
SELECT 
  '🔍 CAMPAIGN DATA JSONB INSPECTION' as report_section,
  c.name as client_name,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as month,
  jsonb_array_length(cs.campaign_data) as campaigns_in_json,
  cs.total_campaigns,
  cs.active_campaigns,
  CASE 
    WHEN cs.campaign_data IS NULL THEN '❌ NO CAMPAIGN DATA'
    WHEN jsonb_array_length(cs.campaign_data) = 0 THEN '❌ EMPTY ARRAY'
    WHEN jsonb_array_length(cs.campaign_data) > 0 THEN '✅ HAS CAMPAIGNS'
    ELSE '⚠️ UNKNOWN'
  END as campaign_data_status
FROM clients c
JOIN campaign_summaries cs ON cs.client_id = c.id
WHERE cs.summary_type = 'monthly'
  AND cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months')
ORDER BY c.name, cs.summary_date DESC;

-- ============================================================================
-- 4. SAMPLE ACTUAL CAMPAIGN DATA FROM JSONB
-- ============================================================================
SELECT 
  '📋 SAMPLE CAMPAIGN FROM JSONB' as report_section,
  c.name as client_name,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as month,
  campaign->>'campaign_name' as campaign_name,
  (campaign->>'spend')::numeric as campaign_spend,
  (campaign->>'impressions')::bigint as campaign_impressions,
  (campaign->>'clicks')::bigint as campaign_clicks,
  campaign->>'status' as campaign_status
FROM clients c
JOIN campaign_summaries cs ON cs.client_id = c.id
CROSS JOIN LATERAL jsonb_array_elements(cs.campaign_data) as campaign
WHERE cs.summary_type = 'monthly'
  AND cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
  AND jsonb_array_length(cs.campaign_data) > 0
LIMIT 10;

-- ============================================================================
-- 5. CHECK DAILY KPI DATA FOR ACTUAL VALUES
-- ============================================================================
SELECT 
  '📅 DAILY KPI DATA - RECENT VALUES' as report_section,
  c.name as client_name,
  dkd.date,
  dkd.total_spend,
  dkd.total_impressions,
  dkd.total_clicks,
  dkd.total_conversions,
  CASE 
    WHEN dkd.total_spend = 0 AND dkd.total_impressions = 0 THEN '❌ ALL ZEROS'
    WHEN dkd.total_spend > 0 THEN '✅ HAS DATA'
    ELSE '⚠️ PARTIAL'
  END as data_status,
  dkd.data_source
FROM clients c
JOIN daily_kpi_data dkd ON dkd.client_id = c.id
WHERE dkd.date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY c.name, dkd.date DESC
LIMIT 50;

-- ============================================================================
-- 6. CHECK CURRENT MONTH CACHE FOR ACTUAL DATA
-- ============================================================================
SELECT 
  '💾 CURRENT MONTH CACHE - DATA INSPECTION' as report_section,
  c.name as client_name,
  cmc.period_id,
  cmc.cache_data->'stats'->>'totalSpend' as cached_spend,
  cmc.cache_data->'stats'->>'totalImpressions' as cached_impressions,
  cmc.cache_data->'stats'->>'totalClicks' as cached_clicks,
  jsonb_array_length(cmc.cache_data->'campaigns') as campaigns_count,
  cmc.last_updated,
  CASE 
    WHEN (cmc.cache_data->'stats'->>'totalSpend')::numeric = 0 AND 
         (cmc.cache_data->'stats'->>'totalImpressions')::bigint = 0 THEN '❌ ALL ZEROS'
    WHEN (cmc.cache_data->'stats'->>'totalSpend')::numeric > 0 THEN '✅ HAS DATA'
    ELSE '⚠️ PARTIAL'
  END as data_status
FROM clients c
JOIN current_month_cache cmc ON cmc.client_id = c.id
WHERE cmc.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
ORDER BY c.name;

-- ============================================================================
-- 7. DETAILED ANALYSIS: WHY ARE THERE ZEROS?
-- ============================================================================
WITH problem_records AS (
  SELECT 
    c.id as client_id,
    c.name as client_name,
    cs.summary_date,
    cs.total_spend,
    cs.total_impressions,
    cs.campaign_data,
    cs.data_source,
    cs.last_updated
  FROM clients c
  JOIN campaign_summaries cs ON cs.client_id = c.id
  WHERE cs.summary_type = 'monthly'
    AND cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months')
    AND cs.total_spend = 0 
    AND cs.total_impressions = 0
)
SELECT 
  '🔴 PROBLEM RECORDS ANALYSIS' as report_section,
  client_name,
  TO_CHAR(summary_date, 'YYYY-MM') as month,
  data_source,
  CASE 
    WHEN campaign_data IS NULL THEN '❌ campaign_data is NULL'
    WHEN jsonb_array_length(campaign_data) = 0 THEN '❌ campaign_data is empty array'
    ELSE '⚠️ campaign_data exists but totals are zero'
  END as issue,
  last_updated,
  'Need to re-fetch from API' as recommendation
FROM problem_records
ORDER BY client_name, summary_date DESC;

-- ============================================================================
-- 8. CLIENT-BY-CLIENT DATA QUALITY REPORT
-- ============================================================================
WITH client_quality AS (
  SELECT 
    c.id,
    c.name,
    c.api_status,
    COUNT(cs.id) as months_with_records,
    COUNT(CASE WHEN cs.total_spend > 0 OR cs.total_impressions > 0 THEN 1 END) as months_with_real_data,
    COUNT(CASE WHEN cs.total_spend = 0 AND cs.total_impressions = 0 THEN 1 END) as months_with_zeros,
    SUM(cs.total_spend) as total_spend_all_months,
    SUM(cs.total_impressions) as total_impressions_all_months
  FROM clients c
  LEFT JOIN campaign_summaries cs 
    ON cs.client_id = c.id 
    AND cs.summary_type = 'monthly'
    AND cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')
  GROUP BY c.id, c.name, c.api_status
)
SELECT 
  '👥 CLIENT DATA QUALITY REPORT' as report_section,
  name as client_name,
  api_status,
  months_with_records,
  months_with_real_data,
  months_with_zeros,
  ROUND(total_spend_all_months::numeric, 2) as total_spend,
  total_impressions_all_months as total_impressions,
  CASE 
    WHEN months_with_records = 0 THEN '🔴 NO DATA AT ALL'
    WHEN months_with_zeros = months_with_records THEN '🔴 ALL ZEROS - NEED BACKFILL'
    WHEN months_with_real_data = months_with_records THEN '✅ ALL GOOD'
    WHEN months_with_real_data >= months_with_records * 0.8 THEN '🟡 MOSTLY GOOD'
    ELSE '🟠 MIXED - NEED PARTIAL BACKFILL'
  END as status,
  CASE 
    WHEN months_with_zeros > 0 THEN 'Run: curl -X POST .../backfill-all-client-data -d ''{"clientIds":["' || id || '"], "forceRefresh":true}'''
    ELSE 'No action needed'
  END as recommended_action
FROM client_quality
ORDER BY 
  CASE 
    WHEN months_with_zeros = months_with_records THEN 1
    WHEN months_with_zeros > 0 THEN 2
    ELSE 3
  END,
  name;

-- ============================================================================
-- 9. EXECUTIVE SUMMARY
-- ============================================================================
WITH summary AS (
  SELECT 
    COUNT(DISTINCT cs.client_id) as clients_with_data,
    COUNT(*) as total_month_records,
    COUNT(CASE WHEN cs.total_spend > 0 OR cs.total_impressions > 0 THEN 1 END) as records_with_real_data,
    COUNT(CASE WHEN cs.total_spend = 0 AND cs.total_impressions = 0 THEN 1 END) as records_with_zeros,
    SUM(cs.total_spend) as total_spend,
    SUM(cs.total_impressions) as total_impressions
  FROM campaign_summaries cs
  WHERE cs.summary_type = 'monthly'
    AND cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')
)
SELECT 
  '📋 EXECUTIVE SUMMARY' as report_section,
  clients_with_data as "Clients with Data",
  total_month_records as "Total Month Records",
  records_with_real_data as "Records with Real Data",
  records_with_zeros as "Records with ALL ZEROS",
  ROUND(
    (records_with_real_data::numeric / total_month_records::numeric * 100),
    1
  ) as "% Real Data",
  ROUND(
    (records_with_zeros::numeric / total_month_records::numeric * 100),
    1
  ) as "% ALL ZEROS",
  ROUND(total_spend::numeric, 2) as "Total Spend (All Time)",
  total_impressions as "Total Impressions (All Time)",
  CASE 
    WHEN records_with_zeros = 0 THEN '✅ PERFECT: All data is real'
    WHEN records_with_zeros < total_month_records * 0.1 THEN '🟡 GOOD: Minor zero issues'
    WHEN records_with_zeros < total_month_records * 0.5 THEN '🟠 FAIR: Significant zero records'
    ELSE '🔴 CRITICAL: Most records are zeros - Need immediate backfill with forceRefresh'
  END as "Status & Action"
FROM summary;

