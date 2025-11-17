-- VERIFY REAL PER-CAMPAIGN DATA (Not Distributed Averages)
-- Run this to check if the fix is working

-- Test 1: Check if campaigns have VARIANCE (different values)
WITH campaign_data AS (
  SELECT 
    jsonb_array_elements(cache_data->'campaigns') as campaign
  FROM current_month_cache
  WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%belmonte%' LIMIT 1)
    AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
)
SELECT 
  '=== VARIANCE TEST ===' as test_name,
  COUNT(*) as total_campaigns,
  COUNT(DISTINCT (campaign->>'booking_step_1')::numeric) as unique_step1_values,
  MIN((campaign->>'booking_step_1')::numeric) as min_step1,
  MAX((campaign->>'booking_step_1')::numeric) as max_step1,
  ROUND(AVG((campaign->>'booking_step_1')::numeric), 2) as avg_step1,
  ROUND(STDDEV((campaign->>'booking_step_1')::numeric), 2) as stddev_step1,
  CASE 
    WHEN COUNT(DISTINCT (campaign->>'booking_step_1')::numeric) = 1 
    THEN '❌ ALL IDENTICAL (distributed averages - BAD)'
    WHEN COUNT(DISTINCT (campaign->>'booking_step_1')::numeric) > 1
    THEN '✅ HAS VARIANCE (real per-campaign data - GOOD)'
    ELSE 'ℹ️  All zeros or no data'
  END as verdict
FROM campaign_data
WHERE (campaign->>'booking_step_1') IS NOT NULL;

-- Test 2: Show first 5 campaigns to see actual values
WITH campaign_data AS (
  SELECT 
    jsonb_array_elements(cache_data->'campaigns') as campaign,
    ROW_NUMBER() OVER () as row_num
  FROM current_month_cache
  WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%belmonte%' LIMIT 1)
    AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
)
SELECT 
  '=== SAMPLE CAMPAIGNS ===' as test_name,
  campaign->>'campaign_name' as campaign_name,
  ROUND((campaign->>'spend')::numeric, 2) as spend,
  (campaign->>'impressions')::int as impressions,
  (campaign->>'clicks')::int as clicks,
  (campaign->>'booking_step_1')::int as step1,
  (campaign->>'booking_step_2')::int as step2,
  (campaign->>'booking_step_3')::int as step3,
  (campaign->>'reservations')::int as reservations
FROM campaign_data
WHERE row_num <= 5
ORDER BY row_num;

-- Test 3: Check if values are suspiciously distributed
WITH campaign_data AS (
  SELECT 
    (campaign->>'booking_step_1')::numeric as step1,
    COUNT(*) as count
  FROM (
    SELECT jsonb_array_elements(cache_data->'campaigns') as campaign
    FROM current_month_cache
    WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%belmonte%' LIMIT 1)
      AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
  ) campaigns
  GROUP BY (campaign->>'booking_step_1')::numeric
)
SELECT 
  '=== DISTRIBUTION CHECK ===' as test_name,
  step1,
  count,
  CASE 
    WHEN count = (SELECT COUNT(*) FROM (
      SELECT jsonb_array_elements(cache_data->'campaigns') 
      FROM current_month_cache 
      WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%belmonte%' LIMIT 1)
        AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
    ) x)
    THEN '❌ ALL CAMPAIGNS HAVE SAME VALUE (distributed - BAD)'
    ELSE '✅ Natural distribution (real data - GOOD)'
  END as verdict
FROM campaign_data
ORDER BY count DESC, step1 DESC
LIMIT 10;

-- Test 4: Check conversion metrics totals
SELECT 
  '=== TOTALS VERIFICATION ===' as test_name,
  period_id,
  (cache_data->'stats'->>'totalSpend')::numeric as total_spend,
  (cache_data->'stats'->>'totalClicks')::int as total_clicks,
  (cache_data->'conversionMetrics'->>'booking_step_1')::int as total_step1,
  (cache_data->'conversionMetrics'->>'booking_step_2')::int as total_step2,
  (cache_data->'conversionMetrics'->>'booking_step_3')::int as total_step3,
  (cache_data->'conversionMetrics'->>'reservations')::int as total_reservations,
  -- Calculate what distributed average would be
  jsonb_array_length(cache_data->'campaigns') as campaign_count,
  CASE 
    WHEN jsonb_array_length(cache_data->'campaigns') > 0
    THEN ROUND((cache_data->'conversionMetrics'->>'booking_step_1')::numeric / 
               jsonb_array_length(cache_data->'campaigns'), 2)
    ELSE 0
  END as would_be_avg_if_distributed
FROM current_month_cache
WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%belmonte%' LIMIT 1)
  AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');

-- INTERPRETATION:
-- ✅ GOOD if:
--    - unique_step1_values > 1 (not all identical)
--    - stddev_step1 > 0 (has variation)
--    - Sample campaigns show DIFFERENT values
--    - Distribution check shows "Natural distribution"
--
-- ❌ BAD if:
--    - unique_step1_values = 1 (all identical)
--    - stddev_step1 = 0 or NULL (no variation)
--    - All campaigns have exact same value (e.g., all 20.00)
--    - Distribution check shows "ALL CAMPAIGNS HAVE SAME VALUE"


