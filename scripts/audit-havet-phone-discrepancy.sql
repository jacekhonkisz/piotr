-- ============================================================================
-- HAVET PHONE METRIC DISCREPANCY AUDIT
-- ============================================================================
-- Purpose: Audit why current month displays 10 phones when database shows 2
-- Client: Havet
-- Issue: Dashboard shows 10, but database (SS/campaign_summaries) shows 2
-- ============================================================================

-- STEP 1: Get Havet's client ID
SELECT 
  '1️⃣ HAVET CLIENT INFO' as check_name,
  id,
  name,
  meta_access_token IS NOT NULL as has_meta_token,
  ad_account_id,
  google_ads_enabled,
  google_ads_customer_id
FROM clients
WHERE LOWER(name) LIKE '%havet%'
LIMIT 1;

-- STEP 2: Check current_month_cache for Havet (current month)
-- This is what the dashboard uses for current month display
SELECT 
  '2️⃣ CURRENT_MONTH_CACHE' as check_name,
  cmc.period_id,
  cmc.last_updated,
  AGE(NOW(), cmc.last_updated) as cache_age,
  cmc.cache_data->'conversionMetrics'->>'click_to_call' as click_to_call_from_cache,
  cmc.cache_data->'stats'->>'totalSpend' as total_spend,
  cmc.cache_data->'stats'->>'totalClicks' as total_clicks,
  cmc.cache_data->'campaigns'->0->>'click_to_call' as first_campaign_phones,
  jsonb_array_length(cmc.cache_data->'campaigns') as campaign_count
FROM current_month_cache cmc
WHERE cmc.client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND cmc.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
ORDER BY cmc.last_updated DESC;

-- STEP 3: Check campaign_summaries for current month (database source)
-- This is what should have the correct value (2 phones)
SELECT 
  '3️⃣ CAMPAIGN_SUMMARIES (CURRENT MONTH)' as check_name,
  cs.summary_date,
  cs.summary_type,
  cs.platform,
  cs.click_to_call as click_to_call_from_db,
  cs.email_contacts,
  cs.total_spend,
  cs.total_clicks,
  cs.reservations,
  cs.last_updated
FROM campaign_summaries cs
WHERE cs.client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND cs.summary_date = DATE_TRUNC('month', CURRENT_DATE)
  AND cs.summary_type = 'monthly'
  AND cs.platform = 'meta'
ORDER BY cs.last_updated DESC;

-- STEP 4: Check daily_kpi_data for current month
-- This is another potential source
SELECT 
  '4️⃣ DAILY_KPI_DATA (CURRENT MONTH)' as check_name,
  DATE_TRUNC('month', date) as month,
  SUM(click_to_call) as total_click_to_call,
  SUM(email_contacts) as total_email_contacts,
  SUM(total_spend) as total_spend,
  COUNT(*) as record_count
FROM daily_kpi_data
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)
  AND platform = 'meta'
GROUP BY DATE_TRUNC('month', date);

-- STEP 5: Check individual daily records to see breakdown
SELECT 
  '5️⃣ DAILY_KPI_DATA BREAKDOWN' as check_name,
  date,
  click_to_call,
  email_contacts,
  total_spend,
  data_source
FROM daily_kpi_data
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)
  AND platform = 'meta'
ORDER BY date DESC;

-- STEP 6: Check if there are multiple campaign_summaries entries for current month
-- (Could be duplicate entries causing aggregation issues)
SELECT 
  '6️⃣ DUPLICATE CHECK' as check_name,
  COUNT(*) as duplicate_count,
  COUNT(DISTINCT click_to_call) as distinct_phone_values,
  STRING_AGG(DISTINCT click_to_call::text, ', ') as all_phone_values,
  STRING_AGG(DISTINCT summary_type, ', ') as summary_types
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND summary_date = DATE_TRUNC('month', CURRENT_DATE)
  AND platform = 'meta';

-- STEP 7: Check if cache is aggregating from campaigns incorrectly
-- Sum up click_to_call from all campaigns in cache
SELECT 
  '7️⃣ CACHE CAMPAIGNS AGGREGATION' as check_name,
  cmc.period_id,
  (
    SELECT SUM((campaign->>'click_to_call')::numeric)
    FROM jsonb_array_elements(cmc.cache_data->'campaigns') as campaign
    WHERE (campaign->>'click_to_call') IS NOT NULL
  ) as sum_from_campaigns,
  cmc.cache_data->'conversionMetrics'->>'click_to_call' as conversion_metrics_value,
  jsonb_array_length(cmc.cache_data->'campaigns') as campaign_count
FROM current_month_cache cmc
WHERE cmc.client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND cmc.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

-- STEP 8: Check if there's a mismatch between what's stored vs what's displayed
-- Compare cache conversionMetrics vs sum of campaigns
SELECT 
  '8️⃣ CACHE VS CAMPAIGNS COMPARISON' as check_name,
  cmc.period_id,
  cmc.cache_data->'conversionMetrics'->>'click_to_call' as conversion_metrics_phones,
  (
    SELECT SUM((campaign->>'click_to_call')::numeric)
    FROM jsonb_array_elements(cmc.cache_data->'campaigns') as campaign
    WHERE (campaign->>'click_to_call') IS NOT NULL
  ) as sum_of_campaigns_phones,
  CASE 
    WHEN (cmc.cache_data->'conversionMetrics'->>'click_to_call')::numeric = 
         (SELECT SUM((campaign->>'click_to_call')::numeric)
          FROM jsonb_array_elements(cmc.cache_data->'campaigns') as campaign
          WHERE (campaign->>'click_to_call') IS NOT NULL)
    THEN '✅ MATCH'
    ELSE '❌ MISMATCH - Dashboard may be using sum of campaigns instead of conversionMetrics'
  END as status
FROM current_month_cache cmc
WHERE cmc.client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND cmc.period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

