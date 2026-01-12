-- AUDIT: Google Ads December 2025 Data Storage Issue
-- Client: Havet Hotel
-- Issue: December showing zeros, but Meta working fine

-- ============================================================================
-- STEP 0: Get Havet's client_id (run this first to get the ID)
-- ============================================================================
SELECT 
  '0️⃣ HAVET CLIENT INFO' as check_name,
  id as client_id,
  name,
  google_ads_customer_id,
  CASE WHEN google_ads_refresh_token IS NOT NULL THEN 'HAS TOKEN ✅' ELSE 'NO TOKEN ❌' END as token_status
FROM clients
WHERE name ILIKE '%havet%'
LIMIT 1;

-- ============================================================================
-- STEP 1: Check December 2025 in Google Ads Monthly Cache
-- ============================================================================
-- Replace 'YOUR_CLIENT_ID_HERE' with the ID from step 0, or use the subquery below
SELECT 
  '1️⃣ DECEMBER IN MONTHLY CACHE?' as check_name,
  gmc.period_id,
  gmc.client_id,
  (gmc.cache_data->'stats'->>'totalSpend')::numeric as cached_spend,
  (gmc.cache_data->'stats'->>'totalImpressions')::numeric as cached_impressions,
  (gmc.cache_data->'stats'->>'totalClicks')::numeric as cached_clicks,
  (gmc.cache_data->'conversionMetrics'->>'booking_step_1')::numeric as step1,
  (gmc.cache_data->'conversionMetrics'->>'booking_step_2')::numeric as step2,
  (gmc.cache_data->'conversionMetrics'->>'booking_step_3')::numeric as step3,
  (gmc.cache_data->'conversionMetrics'->>'reservations')::numeric as reservations,
  jsonb_array_length(COALESCE(gmc.cache_data->'campaigns', '[]'::jsonb)) as campaign_count,
  TO_CHAR(gmc.last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated,
  TO_CHAR(gmc.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
FROM google_ads_current_month_cache gmc
WHERE gmc.period_id = '2025-12'
  AND gmc.client_id = (SELECT id FROM clients WHERE name ILIKE '%havet%' LIMIT 1);

-- ============================================================================
-- STEP 2: Check December 2025 in Campaign Summaries (Archived)
-- ============================================================================
SELECT 
  '2️⃣ DECEMBER IN CAMPAIGN_SUMMARIES?' as check_name,
  cs.summary_date::text as period_id,
  cs.client_id,
  cs.total_spend as cached_spend,
  cs.total_impressions as cached_impressions,
  cs.total_clicks as cached_clicks,
  cs.booking_step_1 as step1,
  cs.booking_step_2 as step2,
  cs.booking_step_3 as step3,
  cs.reservations,
  jsonb_array_length(COALESCE(cs.campaign_data, '[]'::jsonb)) as campaign_count,
  TO_CHAR(cs.last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated,
  cs.data_source as created_at
FROM campaign_summaries cs
WHERE cs.client_id = (SELECT id FROM clients WHERE name ILIKE '%havet%' LIMIT 1)
  AND cs.summary_date >= '2025-12-01' 
  AND cs.summary_date <= '2025-12-31'
  AND cs.platform = 'google'
  AND cs.summary_type = 'monthly';

-- ============================================================================
-- STEP 3: Compare with Meta Ads December (Working)
-- ============================================================================
SELECT 
  '3️⃣ META DECEMBER (FOR COMPARISON)' as check_name,
  cs.summary_date::text as period_id,
  cs.client_id,
  cs.total_spend as cached_spend,
  cs.total_impressions as cached_impressions,
  cs.total_clicks as cached_clicks,
  cs.booking_step_1 as step1,
  cs.booking_step_2 as step2,
  cs.booking_step_3 as step3,
  cs.reservations,
  jsonb_array_length(COALESCE(cs.campaign_data, '[]'::jsonb)) as campaign_count,
  TO_CHAR(cs.last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated,
  cs.data_source as created_at
FROM campaign_summaries cs
WHERE cs.client_id = (SELECT id FROM clients WHERE name ILIKE '%havet%' LIMIT 1)
  AND cs.summary_date >= '2025-12-01' 
  AND cs.summary_date <= '2025-12-31'
  AND cs.platform = 'meta'
  AND cs.summary_type = 'monthly';

-- ============================================================================
-- STEP 4: Check All Google Ads Historical Data for Havet
-- ============================================================================
SELECT 
  '4️⃣ ALL GOOGLE ADS MONTHLY DATA' as check_name,
  LEFT(cs.summary_date::text, 7) as month,
  cs.client_id,
  cs.total_spend as cached_spend,
  cs.total_impressions as cached_impressions,
  cs.total_clicks as cached_clicks,
  cs.booking_step_1 as step1,
  cs.booking_step_2 as step2,
  cs.booking_step_3 as step3,
  cs.reservations,
  jsonb_array_length(COALESCE(cs.campaign_data, '[]'::jsonb)) as campaign_count,
  TO_CHAR(cs.last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated,
  cs.data_source as created_at
FROM campaign_summaries cs
WHERE cs.client_id = (SELECT id FROM clients WHERE name ILIKE '%havet%' LIMIT 1)
  AND cs.platform = 'google'
  AND cs.summary_type = 'monthly'
ORDER BY cs.summary_date DESC
LIMIT 12;

-- ============================================================================
-- STEP 5: Check Weekly Google Ads Data for December
-- ============================================================================
SELECT 
  '5️⃣ DECEMBER WEEKLY DATA' as check_name,
  cs.summary_date::text as period_id,
  cs.client_id,
  cs.total_spend as cached_spend,
  cs.total_impressions as cached_impressions,
  cs.total_clicks as cached_clicks,
  cs.booking_step_1 as step1,
  cs.booking_step_2 as step2,
  cs.booking_step_3 as step3,
  cs.reservations,
  jsonb_array_length(COALESCE(cs.campaign_data, '[]'::jsonb)) as campaign_count,
  TO_CHAR(cs.last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated,
  cs.data_source as created_at
FROM campaign_summaries cs
WHERE cs.client_id = (SELECT id FROM clients WHERE name ILIKE '%havet%' LIMIT 1)
  AND cs.summary_date >= '2025-12-01' 
  AND cs.summary_date <= '2025-12-31'
  AND cs.platform = 'google'
  AND cs.summary_type = 'weekly'
ORDER BY cs.summary_date DESC;

-- ============================================================================
-- STEP 6: Check Havet Client Configuration
-- ============================================================================
SELECT 
  '6️⃣ HAVET CLIENT CONFIG' as check_name,
  id::text as period_id,
  id as client_id,
  CASE WHEN google_ads_customer_id IS NOT NULL THEN 1 ELSE 0 END as has_customer_id,
  CASE WHEN google_ads_refresh_token IS NOT NULL THEN 1 ELSE 0 END as has_refresh_token,
  0 as cached_clicks,
  0 as step1,
  0 as step2,
  0 as step3,
  0 as reservations,
  0 as campaign_count,
  google_ads_customer_id as customer_id,
  CASE WHEN google_ads_refresh_token IS NOT NULL THEN 'HAS TOKEN ✅' ELSE 'NO TOKEN ❌' END as token_status
FROM clients
WHERE name ILIKE '%havet%'
LIMIT 1;

-- ============================================================================
-- STEP 7: Check Daily KPI Data for December (Raw Data Source)
-- ============================================================================
SELECT 
  '7️⃣ DAILY KPI DATA (DECEMBER)' as check_name,
  kpi.date::text as period_id,
  kpi.client_id,
  SUM(kpi.total_spend)::numeric as cached_spend,
  SUM(kpi.total_impressions)::numeric as cached_impressions,
  SUM(kpi.total_clicks)::numeric as cached_clicks,
  SUM(kpi.booking_step_1)::numeric as step1,
  SUM(kpi.booking_step_2)::numeric as step2,
  SUM(kpi.booking_step_3)::numeric as step3,
  SUM(kpi.reservations)::numeric as reservations,
  COUNT(DISTINCT kpi.date) as days_with_data,
  MAX(TO_CHAR(kpi.created_at, 'YYYY-MM-DD HH24:MI:SS')) as last_updated,
  'daily_kpi_data' as created_at
FROM daily_kpi_data kpi
WHERE kpi.client_id = (SELECT id FROM clients WHERE name ILIKE '%havet%' LIMIT 1)
  AND kpi.date >= '2025-12-01' 
  AND kpi.date <= '2025-12-31'
  AND kpi.platform = 'google'
GROUP BY kpi.client_id, kpi.date
ORDER BY kpi.date DESC
LIMIT 5;

-- ============================================================================
-- STEP 8: Summary - Check if December Data Exists Anywhere
-- ============================================================================
SELECT 
  '8️⃣ SUMMARY - DECEMBER DATA CHECK' as check_name,
  'Summary' as period_id,
  (SELECT id FROM clients WHERE name ILIKE '%havet%' LIMIT 1) as client_id,
  -- Check cache
  (SELECT COUNT(*) FROM google_ads_current_month_cache 
   WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%havet%' LIMIT 1)
     AND period_id = '2025-12') as cache_exists,
  -- Check archived
  (SELECT COUNT(*) FROM campaign_summaries 
   WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%havet%' LIMIT 1)
     AND summary_date >= '2025-12-01' 
     AND summary_date <= '2025-12-31'
     AND platform = 'google'
     AND summary_type = 'monthly') as archived_exists,
  -- Check daily KPI
  (SELECT COUNT(DISTINCT date) FROM daily_kpi_data 
   WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%havet%' LIMIT 1)
     AND date >= '2025-12-01' 
     AND date <= '2025-12-31'
     AND platform = 'google') as daily_kpi_days,
  0 as step1,
  0 as step2,
  0 as step3,
  0 as reservations,
  0 as campaign_count,
  'Run all queries above for details' as last_updated,
  'Summary check' as created_at;

