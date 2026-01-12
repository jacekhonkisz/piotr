-- ============================================================================
-- AUDIT: Google Ads Fetch System Comparison
-- ============================================================================
-- This audit compares:
-- 1. Smart Cache fetch (current period) vs Live API fetch
-- 2. How booking steps are fetched and aggregated
-- 3. Where data might be getting lost
-- ============================================================================

-- ============================================================================
-- PART 1: SMART CACHE DATA (Current Period)
-- ============================================================================

-- STEP 1: Check what's stored in smart cache
-- ============================================================================
SELECT 
  '1️⃣ SMART CACHE: Current Month Data' as audit_section,
  c.name as client_name,
  g.period_id,
  TO_CHAR(g.last_updated, 'YYYY-MM-DD HH24:MI:SS') as cache_updated,
  EXTRACT(EPOCH FROM (NOW() - g.last_updated))/3600 as cache_age_hours,
  -- Aggregated totals from cache
  (g.cache_data->'conversionMetrics'->>'booking_step_1')::numeric as cache_total_step1,
  (g.cache_data->'conversionMetrics'->>'booking_step_2')::numeric as cache_total_step2,
  (g.cache_data->'conversionMetrics'->>'booking_step_3')::numeric as cache_total_step3,
  (g.cache_data->'stats'->>'totalSpend')::numeric as cache_total_spend,
  jsonb_array_length(g.cache_data->'campaigns') as campaign_count
FROM google_ads_current_month_cache g
INNER JOIN clients c ON c.id = g.client_id
WHERE g.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
ORDER BY (g.cache_data->'stats'->>'totalSpend')::numeric DESC;

-- STEP 2: Sum individual campaigns in cache (should match cache totals)
-- ============================================================================
WITH campaign_sums AS (
  SELECT 
    g.client_id,
    SUM((campaign->>'booking_step_1')::numeric) as sum_step1,
    SUM((campaign->>'booking_step_2')::numeric) as sum_step2,
    SUM((campaign->>'booking_step_3')::numeric) as sum_step3,
    SUM((campaign->>'spend')::numeric) as sum_spend,
    COUNT(*) as campaign_count
  FROM google_ads_current_month_cache g,
    jsonb_array_elements(g.cache_data->'campaigns') as campaign
  WHERE g.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
  GROUP BY g.client_id
),
cache_totals AS (
  SELECT 
    g.client_id,
    (g.cache_data->'conversionMetrics'->>'booking_step_1')::numeric as cache_step1,
    (g.cache_data->'conversionMetrics'->>'booking_step_2')::numeric as cache_step2,
    (g.cache_data->'conversionMetrics'->>'booking_step_3')::numeric as cache_step3,
    (g.cache_data->'stats'->>'totalSpend')::numeric as cache_spend
  FROM google_ads_current_month_cache g
  WHERE g.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
)
SELECT 
  '2️⃣ SMART CACHE: Campaign Sum vs Cache Totals' as audit_section,
  c.name as client_name,
  cs.sum_step1 as campaign_sum_step1,
  ct.cache_step1 as cache_total_step1,
  cs.sum_step2 as campaign_sum_step2,
  ct.cache_step2 as cache_total_step2,
  cs.sum_step3 as campaign_sum_step3,
  ct.cache_step3 as cache_total_step3,
  cs.sum_spend as campaign_sum_spend,
  ct.cache_spend as cache_total_spend,
  cs.campaign_count,
  CASE 
    WHEN ABS(COALESCE(cs.sum_step1, 0) - COALESCE(ct.cache_step1, 0)) > 1 THEN '⚠️ MISMATCH: Step1'
    WHEN ABS(COALESCE(cs.sum_step2, 0) - COALESCE(ct.cache_step2, 0)) > 1 THEN '⚠️ MISMATCH: Step2'
    WHEN ABS(COALESCE(cs.sum_step3, 0) - COALESCE(ct.cache_step3, 0)) > 1 THEN '⚠️ MISMATCH: Step3'
    ELSE '✅ Match'
  END as comparison_status
FROM campaign_sums cs
INNER JOIN cache_totals ct ON cs.client_id = ct.client_id
INNER JOIN clients c ON c.id = cs.client_id;

-- STEP 3: Check individual campaigns with booking steps in cache
-- ============================================================================
SELECT 
  '3️⃣ SMART CACHE: Individual Campaigns with Booking Steps' as audit_section,
  c.name as client_name,
  campaign->>'campaignName' as campaign_name,
  (campaign->>'spend')::numeric as campaign_spend,
  (campaign->>'booking_step_1')::numeric as campaign_step1,
  (campaign->>'booking_step_2')::numeric as campaign_step2,
  (campaign->>'booking_step_3')::numeric as campaign_step3,
  CASE 
    WHEN (campaign->>'booking_step_1')::numeric > 0 AND (campaign->>'spend')::numeric = 0 THEN '⚠️ Has steps but no spend'
    WHEN (campaign->>'booking_step_1')::numeric = (campaign->>'booking_step_2')::numeric AND (campaign->>'booking_step_1')::numeric > 0 THEN '⚠️ Step1 = Step2'
    ELSE '✅ Normal'
  END as data_quality
FROM google_ads_current_month_cache g
INNER JOIN clients c ON c.id = g.client_id,
  jsonb_array_elements(g.cache_data->'campaigns') as campaign
WHERE g.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
  AND ((campaign->>'booking_step_1')::numeric > 0 OR (campaign->>'booking_step_2')::numeric > 0 OR (campaign->>'booking_step_3')::numeric > 0)
ORDER BY c.name, (campaign->>'spend')::numeric DESC
LIMIT 30;

-- ============================================================================
-- PART 2: DATABASE DATA (Historical/Live API Fallback)
-- ============================================================================

-- STEP 4: Check google_ads_campaigns table (raw API data)
-- ============================================================================
SELECT 
  '4️⃣ DATABASE: google_ads_campaigns Table (Raw API Data)' as audit_section,
  c.name as client_name,
  COUNT(*) as campaign_count,
  SUM(g.spend)::numeric as total_spend,
  SUM(g.booking_step_1) as total_step1,
  SUM(g.booking_step_2) as total_step2,
  SUM(g.booking_step_3) as total_step3,
  MIN(g.date_range_start) as earliest_date,
  MAX(g.date_range_end) as latest_date,
  COUNT(CASE WHEN g.booking_step_1 > 0 THEN 1 END) as campaigns_with_step1,
  COUNT(CASE WHEN g.booking_step_2 > 0 THEN 1 END) as campaigns_with_step2,
  COUNT(CASE WHEN g.booking_step_3 > 0 THEN 1 END) as campaigns_with_step3
FROM google_ads_campaigns g
INNER JOIN clients c ON c.id = g.client_id
WHERE g.date_range_start >= DATE_TRUNC('month', CURRENT_DATE)
  AND g.date_range_start < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
GROUP BY c.name
ORDER BY total_spend DESC;

-- STEP 5: Check campaign_summaries (aggregated historical data)
-- ============================================================================
SELECT 
  '5️⃣ DATABASE: campaign_summaries (Aggregated Data)' as audit_section,
  c.name as client_name,
  cs.summary_date,
  cs.data_source,
  cs.total_spend,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  cs.reservations,
  TO_CHAR(cs.last_updated, 'YYYY-MM-DD HH24:MI:SS') as db_updated,
  jsonb_array_length(cs.campaign_data) as campaign_count_in_jsonb
FROM campaign_summaries cs
INNER JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'google'
  AND cs.summary_type = 'monthly'
  AND cs.summary_date = DATE_TRUNC('month', CURRENT_DATE)
ORDER BY cs.total_spend DESC;

-- ============================================================================
-- PART 3: COMPARISON - Cache vs Database vs Campaigns Table
-- ============================================================================

-- STEP 6: Three-way comparison
-- ============================================================================
WITH cache_data AS (
  SELECT 
    g.client_id,
    (g.cache_data->'conversionMetrics'->>'booking_step_1')::numeric as step1,
    (g.cache_data->'conversionMetrics'->>'booking_step_2')::numeric as step2,
    (g.cache_data->'conversionMetrics'->>'booking_step_3')::numeric as step3,
    (g.cache_data->'stats'->>'totalSpend')::numeric as spend,
    jsonb_array_length(g.cache_data->'campaigns') as campaign_count
  FROM google_ads_current_month_cache g
  WHERE g.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
),
campaigns_table AS (
  SELECT 
    g.client_id,
    SUM(g.booking_step_1) as step1,
    SUM(g.booking_step_2) as step2,
    SUM(g.booking_step_3) as step3,
    SUM(g.spend)::numeric as spend,
    COUNT(*) as campaign_count
  FROM google_ads_campaigns g
  WHERE g.date_range_start >= DATE_TRUNC('month', CURRENT_DATE)
    AND g.date_range_start < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
  GROUP BY g.client_id
),
summary_table AS (
  SELECT 
    cs.client_id,
    cs.booking_step_1 as step1,
    cs.booking_step_2 as step2,
    cs.booking_step_3 as step3,
    cs.total_spend as spend,
    jsonb_array_length(cs.campaign_data) as campaign_count
  FROM campaign_summaries cs
  WHERE cs.platform = 'google'
    AND cs.summary_type = 'monthly'
    AND cs.summary_date = DATE_TRUNC('month', CURRENT_DATE)
)
SELECT 
  '6️⃣ THREE-WAY COMPARISON: Cache vs Campaigns Table vs Summary' as audit_section,
  c.name as client_name,
  -- Cache data
  cache.step1 as cache_step1,
  cache.step2 as cache_step2,
  cache.step3 as cache_step3,
  cache.spend as cache_spend,
  cache.campaign_count as cache_campaign_count,
  -- Campaigns table data
  campaigns.step1 as campaigns_step1,
  campaigns.step2 as campaigns_step2,
  campaigns.step3 as campaigns_step3,
  campaigns.spend as campaigns_spend,
  campaigns.campaign_count as campaigns_campaign_count,
  -- Summary table data
  summary.step1 as summary_step1,
  summary.step2 as summary_step2,
  summary.step3 as summary_step3,
  summary.spend as summary_spend,
  summary.campaign_count as summary_campaign_count,
  -- Comparison
  CASE 
    WHEN ABS(COALESCE(cache.step1, 0) - COALESCE(campaigns.step1, 0)) > 1 THEN '⚠️ Cache ≠ Campaigns'
    WHEN ABS(COALESCE(cache.step1, 0) - COALESCE(summary.step1, 0)) > 1 THEN '⚠️ Cache ≠ Summary'
    WHEN ABS(COALESCE(campaigns.step1, 0) - COALESCE(summary.step1, 0)) > 1 THEN '⚠️ Campaigns ≠ Summary'
    ELSE '✅ All match'
  END as comparison_status
FROM cache_data cache
FULL OUTER JOIN campaigns_table campaigns ON cache.client_id = campaigns.client_id
FULL OUTER JOIN summary_table summary ON COALESCE(cache.client_id, campaigns.client_id) = summary.client_id
INNER JOIN clients c ON c.id = COALESCE(cache.client_id, campaigns.client_id, summary.client_id)
ORDER BY c.name;

-- ============================================================================
-- PART 4: DATA FLOW ANALYSIS
-- ============================================================================

-- STEP 7: Check if campaigns in cache match campaigns in database
-- ============================================================================
WITH cache_campaigns AS (
  SELECT DISTINCT
    g.client_id,
    campaign->>'campaignId' as campaign_id,
    campaign->>'campaignName' as campaign_name,
    (campaign->>'booking_step_1')::numeric as step1
  FROM google_ads_current_month_cache g,
    jsonb_array_elements(g.cache_data->'campaigns') as campaign
  WHERE g.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
),
db_campaigns AS (
  SELECT DISTINCT
    g.client_id,
    g.campaign_id,
    g.campaign_name,
    g.booking_step_1 as step1
  FROM google_ads_campaigns g
  WHERE g.date_range_start >= DATE_TRUNC('month', CURRENT_DATE)
    AND g.date_range_start < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
)
SELECT 
  '7️⃣ CAMPAIGN MATCHING: Cache vs Database' as audit_section,
  c.name as client_name,
  COUNT(DISTINCT cc.campaign_id) as cache_campaign_count,
  COUNT(DISTINCT dc.campaign_id) as db_campaign_count,
  COUNT(DISTINCT CASE WHEN cc.campaign_id = dc.campaign_id THEN cc.campaign_id END) as matching_campaigns,
  SUM(cc.step1) as cache_total_step1,
  SUM(dc.step1) as db_total_step1,
  CASE 
    WHEN COUNT(DISTINCT cc.campaign_id) != COUNT(DISTINCT dc.campaign_id) THEN '⚠️ Different campaign counts'
    WHEN ABS(SUM(cc.step1) - SUM(dc.step1)) > 1 THEN '⚠️ Different totals'
    ELSE '✅ Match'
  END as comparison_status
FROM cache_campaigns cc
FULL OUTER JOIN db_campaigns dc ON cc.client_id = dc.client_id AND cc.campaign_id = dc.campaign_id
INNER JOIN clients c ON c.id = COALESCE(cc.client_id, dc.client_id)
GROUP BY c.name
ORDER BY c.name;

-- STEP 8: Find campaigns with booking steps in one source but not the other
-- ============================================================================
WITH cache_campaigns AS (
  SELECT 
    g.client_id,
    campaign->>'campaignId' as campaign_id,
    campaign->>'campaignName' as campaign_name,
    (campaign->>'booking_step_1')::numeric as step1,
    (campaign->>'spend')::numeric as spend
  FROM google_ads_current_month_cache g,
    jsonb_array_elements(g.cache_data->'campaigns') as campaign
  WHERE g.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
),
db_campaigns AS (
  SELECT 
    g.client_id,
    g.campaign_id,
    g.campaign_name,
    g.booking_step_1 as step1,
    g.spend
  FROM google_ads_campaigns g
  WHERE g.date_range_start >= DATE_TRUNC('month', CURRENT_DATE)
    AND g.date_range_start < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
)
SELECT 
  '8️⃣ MISSING CAMPAIGNS: In Cache but Not in DB (or vice versa)' as audit_section,
  c.name as client_name,
  COALESCE(cc.campaign_name, dc.campaign_name) as campaign_name,
  cc.step1 as cache_step1,
  dc.step1 as db_step1,
  cc.spend as cache_spend,
  dc.spend as db_spend,
  CASE 
    WHEN cc.campaign_id IS NULL THEN '⚠️ In DB but NOT in cache'
    WHEN dc.campaign_id IS NULL THEN '⚠️ In cache but NOT in DB'
    WHEN ABS(COALESCE(cc.step1, 0) - COALESCE(dc.step1, 0)) > 1 THEN '⚠️ Different step1 values'
    ELSE '✅ Match'
  END as issue_type
FROM cache_campaigns cc
FULL OUTER JOIN db_campaigns dc ON cc.client_id = dc.client_id AND cc.campaign_id = dc.campaign_id
INNER JOIN clients c ON c.id = COALESCE(cc.client_id, dc.client_id)
WHERE cc.campaign_id IS NULL OR dc.campaign_id IS NULL OR ABS(COALESCE(cc.step1, 0) - COALESCE(dc.step1, 0)) > 1
ORDER BY c.name, COALESCE(cc.campaign_name, dc.campaign_name);

-- ============================================================================
-- PART 5: SUMMARY & RECOMMENDATIONS
-- ============================================================================

-- STEP 9: Overall summary
-- ============================================================================
WITH cache_summary AS (
  SELECT 
    COUNT(*) as clients_with_cache,
    SUM((cache_data->'conversionMetrics'->>'booking_step_1')::numeric) as total_step1,
    SUM((cache_data->'conversionMetrics'->>'booking_step_2')::numeric) as total_step2,
    SUM((cache_data->'conversionMetrics'->>'booking_step_3')::numeric) as total_step3
  FROM google_ads_current_month_cache
  WHERE period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
),
campaigns_summary AS (
  SELECT 
    COUNT(DISTINCT client_id) as clients_with_campaigns,
    SUM(booking_step_1) as total_step1,
    SUM(booking_step_2) as total_step2,
    SUM(booking_step_3) as total_step3
  FROM google_ads_campaigns
  WHERE date_range_start >= DATE_TRUNC('month', CURRENT_DATE)
    AND date_range_start < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
)
SELECT 
  '9️⃣ OVERALL SUMMARY' as audit_section,
  'Cache' as source,
  cs.clients_with_cache as client_count,
  cs.total_step1,
  cs.total_step2,
  cs.total_step3
FROM cache_summary cs
UNION ALL
SELECT 
  '9️⃣ OVERALL SUMMARY' as audit_section,
  'Campaigns Table' as source,
  campaigns.clients_with_campaigns as client_count,
  campaigns.total_step1,
  campaigns.total_step2,
  campaigns.total_step3
FROM campaigns_summary campaigns;

