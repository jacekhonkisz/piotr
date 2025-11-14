-- 🔍 META vs GOOGLE ADS DATA SEPARATION AUDIT
-- Date: November 5, 2025
-- Purpose: Ensure Meta and Google Ads data are properly separated and not mixed

-- Belmonte Client ID: ab0b4c7e-2bf0-46bc-b455-b18ef6942baa

-- ============================================
-- QUERY 1: Check November 2025 Data by Platform
-- ============================================
-- This shows what data exists for BOTH platforms in November 2025

SELECT 
  platform,
  summary_type,
  summary_date,
  total_spend,
  total_conversions,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  created_at
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_date >= '2025-11-01'
  AND summary_date < '2025-12-01'
ORDER BY platform, summary_type, summary_date;

-- ✅ EXPECTED: Separate records for 'meta' and 'google' platforms
-- ❌ BAD: If same data appears in both, it's mixed


-- ============================================
-- QUERY 2: Compare Meta vs Google for Same Periods
-- ============================================
-- Check if the SAME period has DIFFERENT data for each platform

WITH meta_data AS (
  SELECT 
    summary_date,
    summary_type,
    'meta' as platform,
    total_spend as meta_spend,
    booking_step_1 as meta_step1,
    booking_step_2 as meta_step2,
    booking_step_3 as meta_step3,
    reservations as meta_reservations
  FROM campaign_summaries
  WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
    AND platform = 'meta'
    AND summary_date >= '2025-11-01'
),
google_data AS (
  SELECT 
    summary_date,
    summary_type,
    'google' as platform,
    total_spend as google_spend,
    booking_step_1 as google_step1,
    booking_step_2 as google_step2,
    booking_step_3 as google_step3,
    reservations as google_reservations
  FROM campaign_summaries
  WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
    AND platform = 'google'
    AND summary_date >= '2025-11-01'
)
SELECT 
  COALESCE(m.summary_date, g.summary_date) as period,
  COALESCE(m.summary_type, g.summary_type) as type,
  m.meta_spend,
  g.google_spend,
  m.meta_step1,
  g.google_step1,
  m.meta_step2,
  g.google_step2,
  m.meta_step3,
  g.google_step3,
  m.meta_reservations,
  g.google_reservations,
  -- Check if data looks suspiciously similar
  CASE 
    WHEN m.meta_spend = g.google_spend THEN '⚠️ SAME SPEND'
    WHEN m.meta_step1 = g.google_step1 THEN '⚠️ SAME STEP 1'
    ELSE '✅ Different'
  END as data_check
FROM meta_data m
FULL OUTER JOIN google_data g 
  ON m.summary_date = g.summary_date 
  AND m.summary_type = g.summary_type
ORDER BY period DESC;

-- This will show if Meta and Google have DIFFERENT data (good)
-- or if they have SAME/similar data (bad - data mixing!)


-- ============================================
-- QUERY 3: Check Campaign Data JSON
-- ============================================
-- Look inside the campaign_data JSONB to see actual campaign IDs

SELECT 
  summary_date,
  summary_type,
  platform,
  total_spend,
  booking_step_1,
  reservations,
  -- Extract first campaign from JSON
  campaign_data->0->>'campaignId' as first_campaign_id,
  campaign_data->0->>'campaignName' as first_campaign_name,
  jsonb_array_length(campaign_data) as total_campaigns
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_date >= '2025-11-01'
ORDER BY platform, summary_date;

-- ✅ GOOD: Meta campaign IDs should be 17-digit numbers
-- ✅ GOOD: Google campaign IDs should be 10-11 digit numbers
-- ❌ BAD: If Meta shows Google campaign names or vice versa


-- ============================================
-- QUERY 4: Validate Funnel Logic
-- ============================================
-- Check for impossible funnels (step 2 > step 1, etc.)

SELECT 
  summary_date,
  platform,
  summary_type,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  total_spend,
  -- Logic checks
  CASE 
    WHEN booking_step_2 > booking_step_1 THEN '❌ Step 2 > Step 1 (IMPOSSIBLE)'
    WHEN booking_step_3 > booking_step_2 THEN '❌ Step 3 > Step 2 (IMPOSSIBLE)'
    WHEN reservations > booking_step_1 * 100 THEN '❌ Reservations WAY too high'
    WHEN booking_step_1 = 0 AND reservations > 0 THEN '⚠️ Reservations without Step 1'
    ELSE '✅ Logical funnel'
  END as funnel_validation,
  -- Conversion rates
  ROUND((booking_step_2::numeric / NULLIF(booking_step_1, 0)) * 100, 1) as step1_to_2_rate,
  ROUND((booking_step_3::numeric / NULLIF(booking_step_2, 0)) * 100, 1) as step2_to_3_rate,
  ROUND((reservations::numeric / NULLIF(booking_step_3, 0)) * 100, 1) as step3_to_res_rate
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_date >= '2025-11-01'
ORDER BY platform, summary_date;

-- This will highlight ILLOGICAL funnels like:
-- - 11 → 17 → 9 → 28,974 (Google from your screenshot)


-- ============================================
-- QUERY 5: Check Data Source Field
-- ============================================
-- Verify data_source field matches platform

SELECT 
  summary_date,
  platform,
  data_source,
  total_spend,
  booking_step_1,
  reservations,
  CASE 
    WHEN platform = 'meta' AND data_source != 'meta_api' THEN '⚠️ MISMATCH'
    WHEN platform = 'google' AND data_source != 'google_ads_api' THEN '⚠️ MISMATCH'
    ELSE '✅ Correct'
  END as source_validation
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_date >= '2025-11-01'
ORDER BY platform, summary_date;

-- Platform should match data_source:
-- - platform='meta' → data_source='meta_api'
-- - platform='google' → data_source='google_ads_api'


-- ============================================
-- QUERY 6: Check for Duplicate Periods
-- ============================================
-- See if same period has multiple records for same platform

SELECT 
  summary_date,
  summary_type,
  platform,
  COUNT(*) as record_count,
  ARRAY_AGG(id) as record_ids,
  ARRAY_AGG(total_spend) as spends,
  CASE 
    WHEN COUNT(*) > 1 THEN '❌ DUPLICATES FOUND'
    ELSE '✅ Unique'
  END as status
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_date >= '2025-11-01'
GROUP BY summary_date, summary_type, platform
HAVING COUNT(*) > 1
ORDER BY summary_date, platform;

-- ✅ EXPECTED: Zero rows (no duplicates)
-- ❌ BAD: Multiple rows = duplicate data for same period/platform


-- ============================================
-- QUERY 7: Historical Comparison (September vs November)
-- ============================================
-- Compare September (which looked correct) to November

SELECT 
  TO_CHAR(summary_date, 'YYYY-MM') as month,
  platform,
  COUNT(*) as total_records,
  SUM(total_spend) as total_spend,
  AVG(booking_step_1) as avg_step1,
  AVG(booking_step_2) as avg_step2,
  AVG(booking_step_3) as avg_step3,
  AVG(reservations) as avg_reservations,
  -- Check for suspicious patterns
  CASE 
    WHEN AVG(booking_step_2) > AVG(booking_step_1) THEN '❌ Inverted funnel'
    WHEN AVG(reservations) > AVG(booking_step_1) * 10 THEN '❌ Too many reservations'
    ELSE '✅ Looks normal'
  END as data_quality
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_date >= '2025-09-01'
GROUP BY TO_CHAR(summary_date, 'YYYY-MM'), platform
ORDER BY month DESC, platform;


-- ============================================
-- INTERPRETATION GUIDE
-- ============================================

/*

SCENARIO A: Clean Separation ✅
  - Query 1: Shows separate records for 'meta' and 'google'
  - Query 2: Data is DIFFERENT for each platform
  - Query 3: Campaign IDs match platform (Meta=17 digits, Google=10-11 digits)
  - Query 4: All funnels are LOGICAL
  - Query 5: platform matches data_source
  - Query 6: No duplicates
  → RESULT: Data is properly separated, working as intended

SCENARIO B: Data Mixing ❌
  - Query 1: Same numbers appear in both platforms
  - Query 2: Shows "SAME SPEND" or "SAME STEP 1"
  - Query 3: Google campaigns show in Meta or vice versa
  - Query 4: Shows "IMPOSSIBLE" funnels
  - Query 5: Shows "MISMATCH"
  - Query 6: Shows "DUPLICATES FOUND"
  → RESULT: Critical bug - data being mixed between platforms

SCENARIO C: Broken Google Tracking ⚠️
  - Query 4: Google shows illogical funnel (17 > 11)
  - Google shows 28,974 reservations (way too high)
  - Meta shows normal funnel
  → RESULT: Google Ads conversion tracking broken/misconfigured

WHAT YOUR SCREENSHOTS SUGGEST:
Based on your images, this looks like SCENARIO C:
- Meta: Logical funnel (150 → 75 → 50 → 50)
- Google: BROKEN funnel (11 → 17 → 9 → 28,974)

The Google data is either:
1. Tracking wrong conversion events
2. Counting view-through conversions incorrectly
3. Mixing direct bookings with ad-driven conversions
4. Data corruption in Google Ads import

*/




