-- ============================================================================
-- DEBUG: Google Ads Booking Steps Discrepancy
-- ============================================================================
-- This script helps debug why Google Ads console shows different values
-- than the reports page
-- ============================================================================

-- STEP 1: Check what's in the current month cache (what reports page shows)
-- ============================================================================
SELECT 
  '1️⃣ CURRENT MONTH CACHE (Reports Page Source)' as check_type,
  c.name as client_name,
  g.period_id,
  TO_CHAR(g.last_updated, 'YYYY-MM-DD HH24:MI:SS') as cache_updated,
  (g.cache_data->'conversionMetrics'->>'booking_step_1')::numeric as cache_step1,
  (g.cache_data->'conversionMetrics'->>'booking_step_2')::numeric as cache_step2,
  (g.cache_data->'conversionMetrics'->>'booking_step_3')::numeric as cache_step3,
  (g.cache_data->'stats'->>'totalSpend')::numeric as cache_spend,
  jsonb_array_length(g.cache_data->'campaigns') as campaign_count
FROM google_ads_current_month_cache g
INNER JOIN clients c ON c.id = g.client_id
WHERE g.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
ORDER BY (g.cache_data->'stats'->>'totalSpend')::numeric DESC;

-- STEP 2: Check individual campaigns in cache (to see if data is distributed)
-- ============================================================================
SELECT 
  '2️⃣ INDIVIDUAL CAMPAIGNS IN CACHE' as check_type,
  c.name as client_name,
  campaign->>'campaignName' as campaign_name,
  (campaign->>'spend')::numeric as campaign_spend,
  (campaign->>'booking_step_1')::numeric as campaign_step1,
  (campaign->>'booking_step_2')::numeric as campaign_step2,
  (campaign->>'booking_step_3')::numeric as campaign_step3
FROM google_ads_current_month_cache g
INNER JOIN clients c ON c.id = g.client_id,
  jsonb_array_elements(g.cache_data->'campaigns') as campaign
WHERE g.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
  AND (campaign->>'booking_step_1')::numeric > 0
ORDER BY c.name, (campaign->>'spend')::numeric DESC
LIMIT 20;

-- STEP 3: Check google_ads_campaigns table (raw data from API)
-- ============================================================================
SELECT 
  '3️⃣ GOOGLE_ADS_CAMPAIGNS TABLE (Raw API Data)' as check_type,
  c.name as client_name,
  g.campaign_name,
  g.date_range_start,
  g.date_range_end,
  g.spend,
  g.booking_step_1,
  g.booking_step_2,
  g.booking_step_3,
  SUM(g.booking_step_1) OVER (PARTITION BY g.client_id) as total_step1,
  SUM(g.booking_step_2) OVER (PARTITION BY g.client_id) as total_step2,
  SUM(g.booking_step_3) OVER (PARTITION BY g.client_id) as total_step3
FROM google_ads_campaigns g
INNER JOIN clients c ON c.id = g.client_id
WHERE g.date_range_start >= DATE_TRUNC('month', CURRENT_DATE)
  AND g.date_range_start < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
ORDER BY c.name, g.spend DESC
LIMIT 30;

-- STEP 4: Aggregate totals from google_ads_campaigns (should match cache)
-- ============================================================================
SELECT 
  '4️⃣ AGGREGATED TOTALS FROM GOOGLE_ADS_CAMPAIGNS' as check_type,
  c.name as client_name,
  COUNT(*) as campaign_count,
  SUM(g.spend)::numeric as total_spend,
  SUM(g.booking_step_1) as total_step1,
  SUM(g.booking_step_2) as total_step2,
  SUM(g.booking_step_3) as total_step3,
  MIN(g.date_range_start) as earliest_date,
  MAX(g.date_range_end) as latest_date
FROM google_ads_campaigns g
INNER JOIN clients c ON c.id = g.client_id
WHERE g.date_range_start >= DATE_TRUNC('month', CURRENT_DATE)
  AND g.date_range_start < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
GROUP BY c.name
ORDER BY total_spend DESC;

-- STEP 5: Check campaign_summaries (what historical data uses)
-- ============================================================================
SELECT 
  '5️⃣ CAMPAIGN_SUMMARIES (Historical Data Source)' as check_type,
  c.name as client_name,
  cs.summary_date,
  cs.data_source,
  cs.total_spend,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  TO_CHAR(cs.last_updated, 'YYYY-MM-DD HH24:MI:SS') as db_updated
FROM campaign_summaries cs
INNER JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'google'
  AND cs.summary_type = 'monthly'
  AND cs.summary_date = DATE_TRUNC('month', CURRENT_DATE)
ORDER BY cs.total_spend DESC;

-- STEP 6: Compare all three sources side by side
-- ============================================================================
WITH cache_totals AS (
  SELECT 
    g.client_id,
    (g.cache_data->'conversionMetrics'->>'booking_step_1')::numeric as step1,
    (g.cache_data->'conversionMetrics'->>'booking_step_2')::numeric as step2,
    (g.cache_data->'conversionMetrics'->>'booking_step_3')::numeric as step3,
    (g.cache_data->'stats'->>'totalSpend')::numeric as spend
  FROM google_ads_current_month_cache g
  WHERE g.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
),
campaigns_totals AS (
  SELECT 
    g.client_id,
    SUM(g.booking_step_1) as step1,
    SUM(g.booking_step_2) as step2,
    SUM(g.booking_step_3) as step3,
    SUM(g.spend)::numeric as spend
  FROM google_ads_campaigns g
  WHERE g.date_range_start >= DATE_TRUNC('month', CURRENT_DATE)
    AND g.date_range_start < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
  GROUP BY g.client_id
),
summary_totals AS (
  SELECT 
    cs.client_id,
    cs.booking_step_1 as step1,
    cs.booking_step_2 as step2,
    cs.booking_step_3 as step3,
    cs.total_spend as spend
  FROM campaign_summaries cs
  WHERE cs.platform = 'google'
    AND cs.summary_type = 'monthly'
    AND cs.summary_date = DATE_TRUNC('month', CURRENT_DATE)
)
SELECT 
  '6️⃣ THREE-WAY COMPARISON' as check_type,
  c.name as client_name,
  cache.step1 as cache_step1,
  campaigns.step1 as campaigns_step1,
  summary.step1 as summary_step1,
  cache.step2 as cache_step2,
  campaigns.step2 as campaigns_step2,
  summary.step2 as summary_step2,
  cache.step3 as cache_step3,
  campaigns.step3 as campaigns_step3,
  summary.step3 as summary_step3,
  CASE 
    WHEN ABS(COALESCE(cache.step1, 0) - COALESCE(campaigns.step1, 0)) > 1 THEN '⚠️ Cache ≠ Campaigns'
    WHEN ABS(COALESCE(cache.step1, 0) - COALESCE(summary.step1, 0)) > 1 THEN '⚠️ Cache ≠ Summary'
    WHEN ABS(COALESCE(campaigns.step1, 0) - COALESCE(summary.step1, 0)) > 1 THEN '⚠️ Campaigns ≠ Summary'
    ELSE '✅ All match'
  END as comparison_status
FROM cache_totals cache
FULL OUTER JOIN campaigns_totals campaigns ON cache.client_id = campaigns.client_id
FULL OUTER JOIN summary_totals summary ON COALESCE(cache.client_id, campaigns.client_id) = summary.client_id
INNER JOIN clients c ON c.id = COALESCE(cache.client_id, campaigns.client_id, summary.client_id)
ORDER BY c.name;

-- STEP 7: Check for campaigns with suspicious booking step values
-- ============================================================================
SELECT 
  '7️⃣ SUSPICIOUS BOOKING STEP VALUES' as check_type,
  c.name as client_name,
  g.campaign_name,
  g.booking_step_1,
  g.booking_step_2,
  g.booking_step_3,
  g.spend,
  CASE 
    WHEN g.booking_step_1 = g.booking_step_2 AND g.booking_step_1 = g.booking_step_3 AND g.booking_step_1 > 0 
      THEN '🚨 ALL THREE IDENTICAL'
    WHEN g.booking_step_1 = g.booking_step_2 AND g.booking_step_1 > 0 
      THEN '⚠️ Step1 = Step2'
    WHEN g.booking_step_2 = g.booking_step_3 AND g.booking_step_2 > 0 
      THEN '⚠️ Step2 = Step3'
    WHEN g.booking_step_1 > 0 AND g.spend = 0 
      THEN '⚠️ Has steps but no spend'
    ELSE '✅ Normal'
  END as issue_type
FROM google_ads_campaigns g
INNER JOIN clients c ON c.id = g.client_id
WHERE g.date_range_start >= DATE_TRUNC('month', CURRENT_DATE)
  AND g.date_range_start < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
  AND (
    (g.booking_step_1 = g.booking_step_2 AND g.booking_step_1 > 0) OR
    (g.booking_step_2 = g.booking_step_3 AND g.booking_step_2 > 0) OR
    (g.booking_step_1 = g.booking_step_3 AND g.booking_step_1 > 0) OR
    (g.booking_step_1 > 0 AND g.spend = 0)
  )
ORDER BY c.name, g.spend DESC;

