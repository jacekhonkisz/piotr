-- ============================================================================
-- COMPREHENSIVE AUDIT: Google Ads Booking Steps Historical Data
-- ============================================================================
-- This audit checks ALL months to identify when booking steps were collected
-- and when they stopped, to diagnose the root cause of missing data.

-- ============================================================================
-- STEP 1: Check last 12 months of Google Ads data
-- ============================================================================
SELECT 
  '1️⃣ LAST 12 MONTHS OVERVIEW' as check_type,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as month,
  COUNT(*) as client_count,
  SUM(cs.total_spend)::numeric as total_spend_all_clients,
  SUM(cs.booking_step_1) as total_step1,
  SUM(cs.booking_step_2) as total_step2,
  SUM(cs.booking_step_3) as total_step3,
  SUM(cs.reservations) as total_reservations,
  COUNT(CASE WHEN cs.booking_step_1 > 0 THEN 1 END) as clients_with_step1,
  COUNT(CASE WHEN cs.booking_step_2 > 0 THEN 1 END) as clients_with_step2,
  COUNT(CASE WHEN cs.booking_step_3 > 0 THEN 1 END) as clients_with_step3,
  CASE 
    WHEN SUM(cs.booking_step_1) > 0 THEN '✅ Has booking steps'
    WHEN SUM(cs.total_spend) > 0 THEN '⚠️ Has spend but NO booking steps'
    ELSE '❌ No data'
  END as status
FROM campaign_summaries cs
WHERE cs.platform = 'google'
  AND cs.summary_type = 'monthly'
  AND cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')
GROUP BY TO_CHAR(cs.summary_date, 'YYYY-MM'), cs.summary_date
ORDER BY cs.summary_date DESC;

-- ============================================================================
-- STEP 2: Check data_source and last_updated for each month
-- ============================================================================
SELECT 
  '2️⃣ DATA SOURCE AUDIT' as check_type,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as month,
  COUNT(DISTINCT cs.data_source) as different_sources,
  STRING_AGG(DISTINCT cs.data_source, ', ') as data_sources,
  MAX(cs.last_updated) as most_recent_update,
  AVG(cs.booking_step_1) as avg_step1_per_client,
  AVG(cs.booking_step_2) as avg_step2_per_client,
  AVG(cs.booking_step_3) as avg_step3_per_client,
  CASE 
    WHEN AVG(cs.booking_step_1) > 0 THEN '✅ Has booking steps'
    ELSE '❌ No booking steps'
  END as booking_steps_status
FROM campaign_summaries cs
WHERE cs.platform = 'google'
  AND cs.summary_type = 'monthly'
  AND cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')
GROUP BY TO_CHAR(cs.summary_date, 'YYYY-MM'), cs.summary_date
ORDER BY cs.summary_date DESC;

-- ============================================================================
-- STEP 3: Sample individual client data per month
-- ============================================================================
WITH monthly_client_data AS (
  SELECT 
    TO_CHAR(cs.summary_date, 'YYYY-MM') as month,
    c.name as client_name,
    cs.total_spend,
    cs.booking_step_1,
    cs.booking_step_2,
    cs.booking_step_3,
    cs.reservations,
    cs.data_source,
    cs.last_updated,
    ROW_NUMBER() OVER (PARTITION BY TO_CHAR(cs.summary_date, 'YYYY-MM') ORDER BY cs.total_spend DESC) as spend_rank
  FROM campaign_summaries cs
  INNER JOIN clients c ON c.id = cs.client_id
  WHERE cs.platform = 'google'
    AND cs.summary_type = 'monthly'
    AND cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '6 months')
)
SELECT 
  '3️⃣ TOP SPENDER PER MONTH SAMPLE' as check_type,
  month,
  client_name,
  total_spend,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  data_source,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated,
  CASE 
    WHEN booking_step_1 > 0 THEN '✅ Has booking steps'
    ELSE '❌ No booking steps'
  END as status
FROM monthly_client_data
WHERE spend_rank = 1
ORDER BY month DESC;

-- ============================================================================
-- STEP 4: Check campaign_data JSONB for one problematic month
-- ============================================================================
WITH december_jsonb_check AS (
  SELECT 
    c.name as client_name,
    cs.total_spend,
    cs.booking_step_1 as column_step1,
    jsonb_array_length(cs.campaign_data) as campaign_count,
    (
      SELECT COALESCE(SUM((elem->>'booking_step_1')::numeric), 0)
      FROM jsonb_array_elements(cs.campaign_data) AS elem
    ) as jsonb_step1,
    (
      SELECT COALESCE(SUM((elem->>'booking_step_2')::numeric), 0)
      FROM jsonb_array_elements(cs.campaign_data) AS elem
    ) as jsonb_step2,
    (
      SELECT COALESCE(SUM((elem->>'booking_step_3')::numeric), 0)
      FROM jsonb_array_elements(cs.campaign_data) AS elem
    ) as jsonb_step3
  FROM campaign_summaries cs
  INNER JOIN clients c ON c.id = cs.client_id
  WHERE cs.summary_date = '2025-12-01'
    AND cs.platform = 'google'
    AND cs.summary_type = 'monthly'
  ORDER BY cs.total_spend DESC
  LIMIT 3
)
SELECT 
  '4️⃣ DECEMBER JSONB DETAILED CHECK' as check_type,
  client_name,
  total_spend,
  column_step1,
  campaign_count,
  jsonb_step1,
  jsonb_step2,
  jsonb_step3,
  CASE 
    WHEN column_step1 = 0 AND jsonb_step1 = 0 THEN '❌ Both column and JSONB have zeros'
    WHEN column_step1 > 0 THEN '✅ Column has data'
    WHEN jsonb_step1 > 0 THEN '⚠️ JSONB has data but column is zero (API will use JSONB)'
    ELSE '❓ Unknown'
  END as diagnosis
FROM december_jsonb_check;

-- ============================================================================
-- STEP 5: Check when booking steps were last properly collected
-- ============================================================================
WITH last_good_data AS (
  SELECT 
    c.name as client_name,
    MAX(cs.summary_date) FILTER (WHERE cs.booking_step_1 > 0) as last_month_with_step1,
    MAX(cs.summary_date) FILTER (WHERE cs.booking_step_2 > 0) as last_month_with_step2,
    MAX(cs.summary_date) FILTER (WHERE cs.booking_step_3 > 0) as last_month_with_step3,
    MAX(cs.summary_date) FILTER (WHERE cs.total_spend > 0) as last_month_with_spend
  FROM campaign_summaries cs
  INNER JOIN clients c ON c.id = cs.client_id
  WHERE cs.platform = 'google'
    AND cs.summary_type = 'monthly'
  GROUP BY c.name
)
SELECT 
  '5️⃣ WHEN WERE BOOKING STEPS LAST COLLECTED?' as check_type,
  client_name,
  TO_CHAR(last_month_with_step1, 'YYYY-MM') as last_step1_month,
  TO_CHAR(last_month_with_step2, 'YYYY-MM') as last_step2_month,
  TO_CHAR(last_month_with_step3, 'YYYY-MM') as last_step3_month,
  TO_CHAR(last_month_with_spend, 'YYYY-MM') as last_spend_month,
  CASE 
    WHEN last_month_with_step1 IS NULL THEN '❌ NEVER collected booking steps'
    WHEN last_month_with_step1 < DATE_TRUNC('month', CURRENT_DATE - INTERVAL '3 months') 
      THEN '⚠️ Last collected ' || TO_CHAR(last_month_with_step1, 'YYYY-MM') || ' (>3 months ago)'
    ELSE '✅ Recently collected (' || TO_CHAR(last_month_with_step1, 'YYYY-MM') || ')'
  END as diagnosis
FROM last_good_data
ORDER BY last_month_with_step1 DESC NULLS LAST;

-- ============================================================================
-- STEP 6: Check google_ads_campaigns table for December
-- ============================================================================
SELECT 
  '6️⃣ GOOGLE_ADS_CAMPAIGNS TABLE CHECK (December)' as check_type,
  c.name as client_name,
  COUNT(*) as campaign_count,
  SUM(g.spend)::numeric as total_spend,
  SUM(g.booking_step_1) as total_step1,
  SUM(g.booking_step_2) as total_step2,
  SUM(g.booking_step_3) as total_step3,
  SUM(g.reservations) as total_reservations,
  CASE 
    WHEN SUM(g.booking_step_1) > 0 THEN '✅ Source table has booking steps'
    WHEN SUM(g.spend) > 0 THEN '⚠️ Source has spend but NO booking steps'
    ELSE '❌ No data in source table'
  END as source_table_status
FROM google_ads_campaigns g
INNER JOIN clients c ON c.id = g.client_id
WHERE g.date_range_start >= '2025-12-01'
  AND g.date_range_start <= '2025-12-31'
GROUP BY c.name
ORDER BY SUM(g.spend) DESC;

-- ============================================================================
-- STEP 7: Compare source table vs campaign_summaries for December
-- ============================================================================
WITH source_data AS (
  SELECT 
    g.client_id,
    SUM(g.booking_step_1) as source_step1,
    SUM(g.booking_step_2) as source_step2,
    SUM(g.booking_step_3) as source_step3,
    SUM(g.spend)::numeric as source_spend
  FROM google_ads_campaigns g
  WHERE g.date_range_start >= '2025-12-01'
    AND g.date_range_start <= '2025-12-31'
  GROUP BY g.client_id
),
summary_data AS (
  SELECT 
    cs.client_id,
    cs.booking_step_1 as summary_step1,
    cs.booking_step_2 as summary_step2,
    cs.booking_step_3 as summary_step3,
    cs.total_spend as summary_spend
  FROM campaign_summaries cs
  WHERE cs.summary_date = '2025-12-01'
    AND cs.platform = 'google'
    AND cs.summary_type = 'monthly'
)
SELECT 
  '7️⃣ SOURCE VS SUMMARY COMPARISON (December)' as check_type,
  c.name as client_name,
  src.source_spend,
  sum.summary_spend,
  src.source_step1,
  sum.summary_step1,
  src.source_step2,
  sum.summary_step2,
  src.source_step3,
  sum.summary_step3,
  CASE 
    WHEN src.source_step1 > 0 AND sum.summary_step1 = 0 
      THEN '⚠️ Source has data but summary is zero - BACKFILL NEEDED'
    WHEN src.source_step1 = 0 AND sum.summary_step1 = 0 
      THEN '❌ Both source and summary are zero - FETCH FROM API NEEDED'
    WHEN src.source_step1 > 0 AND sum.summary_step1 > 0 
      THEN '✅ Both have data'
    ELSE '❓ Mixed state'
  END as diagnosis
FROM source_data src
LEFT JOIN summary_data sum ON sum.client_id = src.client_id
INNER JOIN clients c ON c.id = src.client_id
ORDER BY src.source_spend DESC;

-- ============================================================================
-- STEP 8: FINAL RECOMMENDATION
-- ============================================================================
WITH monthly_totals AS (
  SELECT 
    TO_CHAR(cs.summary_date, 'YYYY-MM') as month,
    SUM(cs.booking_step_1) as total_step1,
    SUM(cs.total_spend) as total_spend
  FROM campaign_summaries cs
  WHERE cs.platform = 'google'
    AND cs.summary_type = 'monthly'
    AND cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')
  GROUP BY TO_CHAR(cs.summary_date, 'YYYY-MM')
),
diagnostics AS (
  SELECT 
    COUNT(*) as total_months_checked,
    COUNT(CASE WHEN total_step1 > 0 THEN 1 END) as months_with_booking_steps,
    COUNT(CASE WHEN total_step1 = 0 AND total_spend > 0 THEN 1 END) as months_with_spend_but_no_steps
  FROM monthly_totals
)
SELECT 
  '8️⃣ FINAL RECOMMENDATION' as check_type,
  total_months_checked,
  months_with_booking_steps,
  months_with_spend_but_no_steps,
  CASE 
    WHEN months_with_spend_but_no_steps > 0 THEN 
      '⚠️ ISSUE FOUND: ' || months_with_spend_but_no_steps || ' months have spend but no booking steps. ' ||
      'Need to: 1) Run fetch-december-2025-google-ads.ts script, 2) Run backfill SQL for affected months'
    WHEN months_with_booking_steps = total_months_checked THEN 
      '✅ ALL months have booking steps - system is working correctly'
    ELSE 
      '❓ Mixed results - review individual month diagnostics above'
  END as recommendation
FROM diagnostics;

