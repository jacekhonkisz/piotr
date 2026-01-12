-- ============================================================================
-- DIAGNOSTIC: Check if Historical Google Ads Data Has Booking Steps
-- ============================================================================
-- This SQL checks if booking_step_1/2/3 are properly populated in campaign_summaries
-- for historical Google Ads data, which is what the UI fetches when viewing past months.

-- ============================================================================
-- STEP 1: Check what's stored in campaign_summaries for December 2025
-- ============================================================================
SELECT 
  '1️⃣ DECEMBER IN CAMPAIGN_SUMMARIES' as check_type,
  c.name as client_name,
  cs.summary_date,
  cs.platform,
  cs.total_spend,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  cs.reservations,
  cs.reservation_value,
  cs.data_source
FROM campaign_summaries cs
INNER JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_date = '2025-12-01'
  AND cs.platform = 'google'
  AND cs.summary_type = 'monthly'
ORDER BY cs.total_spend DESC;

-- ============================================================================
-- STEP 2: Check campaign_data JSONB to see if booking steps are in there
-- ============================================================================
SELECT 
  '2️⃣ CAMPAIGN_DATA JSONB SAMPLE' as check_type,
  c.name as client_name,
  cs.summary_date,
  jsonb_array_length(cs.campaign_data) as campaign_count,
  -- Check first campaign in the array
  cs.campaign_data->0->>'campaignName' as first_campaign_name,
  cs.campaign_data->0->>'spend' as first_campaign_spend,
  cs.campaign_data->0->>'booking_step_1' as first_campaign_step1,
  cs.campaign_data->0->>'booking_step_2' as first_campaign_step2,
  cs.campaign_data->0->>'booking_step_3' as first_campaign_step3,
  -- Check totals across all campaigns in JSONB
  (
    SELECT SUM((elem->>'booking_step_1')::numeric)
    FROM jsonb_array_elements(cs.campaign_data) AS elem
  ) as total_step1_in_jsonb,
  (
    SELECT SUM((elem->>'booking_step_2')::numeric)
    FROM jsonb_array_elements(cs.campaign_data) AS elem
  ) as total_step2_in_jsonb,
  (
    SELECT SUM((elem->>'booking_step_3')::numeric)
    FROM jsonb_array_elements(cs.campaign_data) AS elem
  ) as total_step3_in_jsonb
FROM campaign_summaries cs
INNER JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_date = '2025-12-01'
  AND cs.platform = 'google'
  AND cs.summary_type = 'monthly'
ORDER BY cs.total_spend DESC
LIMIT 5;

-- ============================================================================
-- STEP 3: Compare what's in aggregated columns vs campaign_data JSONB
-- ============================================================================
SELECT 
  '3️⃣ AGGREGATED VS JSONB COMPARISON' as check_type,
  c.name as client_name,
  cs.booking_step_1 as column_step1,
  cs.booking_step_2 as column_step2,
  cs.booking_step_3 as column_step3,
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
  ) as jsonb_step3,
  CASE 
    WHEN cs.booking_step_1 = 0 AND (
      SELECT COALESCE(SUM((elem->>'booking_step_1')::numeric), 0)
      FROM jsonb_array_elements(cs.campaign_data) AS elem
    ) = 0 THEN '❌ Both sources have zeros'
    WHEN cs.booking_step_1 > 0 THEN '✅ Column has data'
    WHEN (
      SELECT COALESCE(SUM((elem->>'booking_step_1')::numeric), 0)
      FROM jsonb_array_elements(cs.campaign_data) AS elem
    ) > 0 THEN '⚠️ JSONB has data but column is zero'
    ELSE '❓ Unknown state'
  END as diagnosis
FROM campaign_summaries cs
INNER JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_date = '2025-12-01'
  AND cs.platform = 'google'
  AND cs.summary_type = 'monthly'
ORDER BY cs.total_spend DESC;

-- ============================================================================
-- STEP 4: Check how the API reads this data (simulated)
-- ============================================================================
-- This simulates what fetch-google-ads-live-data/route.ts does

WITH api_read_simulation AS (
  SELECT 
    cs.client_id,
    c.name as client_name,
    cs.summary_date,
    -- PRIORITY 1: Use aggregated columns if they exist
    CASE 
      WHEN cs.booking_step_1 IS NOT NULL THEN cs.booking_step_1
      ELSE 0
    END as api_will_show_step1,
    CASE 
      WHEN cs.booking_step_2 IS NOT NULL THEN cs.booking_step_2
      ELSE 0
    END as api_will_show_step2,
    CASE 
      WHEN cs.booking_step_3 IS NOT NULL THEN cs.booking_step_3
      ELSE 0
    END as api_will_show_step3,
    -- FALLBACK: Calculate from campaign_data JSONB
    (
      SELECT COALESCE(SUM((elem->>'booking_step_1')::numeric), 0)
      FROM jsonb_array_elements(cs.campaign_data) AS elem
    ) as fallback_step1,
    (
      SELECT COALESCE(SUM((elem->>'booking_step_2')::numeric), 0)
      FROM jsonb_array_elements(cs.campaign_data) AS elem
    ) as fallback_step2,
    (
      SELECT COALESCE(SUM((elem->>'booking_step_3')::numeric), 0)
      FROM jsonb_array_elements(cs.campaign_data) AS elem
    ) as fallback_step3
  FROM campaign_summaries cs
  INNER JOIN clients c ON c.id = cs.client_id
  WHERE cs.summary_date = '2025-12-01'
    AND cs.platform = 'google'
    AND cs.summary_type = 'monthly'
)
SELECT 
  '4️⃣ API READ SIMULATION' as check_type,
  client_name,
  summary_date,
  api_will_show_step1,
  api_will_show_step2,
  api_will_show_step3,
  fallback_step1,
  fallback_step2,
  fallback_step3,
  CASE 
    WHEN api_will_show_step1 > 0 THEN '✅ API will show booking steps from columns'
    WHEN fallback_step1 > 0 THEN '⚠️ API will fallback to JSONB (slower but works)'
    ELSE '❌ API will show zeros (no data in either source)'
  END as what_user_will_see
FROM api_read_simulation
ORDER BY client_name;

-- ============================================================================
-- STEP 5: Check a recent month to compare (January 2026)
-- ============================================================================
SELECT 
  '5️⃣ JANUARY 2026 FOR COMPARISON' as check_type,
  c.name as client_name,
  cs.summary_date,
  cs.total_spend,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  cs.reservations,
  cs.data_source,
  CASE 
    WHEN cs.booking_step_1 > 0 THEN '✅ Has booking steps'
    ELSE '❌ No booking steps'
  END as status
FROM campaign_summaries cs
INNER JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_date = '2026-01-01'
  AND cs.platform = 'google'
  AND cs.summary_type = 'monthly'
ORDER BY cs.total_spend DESC;

-- ============================================================================
-- STEP 6: FINAL DIAGNOSIS
-- ============================================================================
SELECT 
  '6️⃣ FINAL DIAGNOSIS' as check_type,
  COUNT(*) as december_records,
  SUM(CASE WHEN booking_step_1 > 0 THEN 1 ELSE 0 END) as records_with_step1,
  SUM(CASE WHEN booking_step_2 > 0 THEN 1 ELSE 0 END) as records_with_step2,
  SUM(CASE WHEN booking_step_3 > 0 THEN 1 ELSE 0 END) as records_with_step3,
  SUM(booking_step_1) as total_step1,
  SUM(booking_step_2) as total_step2,
  SUM(booking_step_3) as total_step3,
  CASE 
    WHEN SUM(booking_step_1) > 0 THEN '✅ December has booking steps in campaign_summaries'
    ELSE '❌ December has NO booking steps - need to run fetch script + backfill'
  END as conclusion
FROM campaign_summaries
WHERE summary_date = '2025-12-01'
  AND platform = 'google'
  AND summary_type = 'monthly';

