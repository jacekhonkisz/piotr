-- Check what booking_step data actually exists in google_ads_campaigns for December 2025
-- This will tell us if the data was ever collected

-- ============================================================================
-- STEP 1: Check if booking_step columns have any non-zero values for December
-- ============================================================================
SELECT 
  '1️⃣ DECEMBER BOOKING STEPS IN google_ads_campaigns' as check_type,
  c.name as client_name,
  COUNT(*) as total_campaigns,
  SUM(g.booking_step_1) as total_booking_step_1,
  SUM(g.booking_step_2) as total_booking_step_2,
  SUM(g.booking_step_3) as total_booking_step_3,
  SUM(g.reservations) as total_reservations,
  SUM(g.reservation_value) as total_reservation_value,
  SUM(g.spend) as total_spend
FROM google_ads_campaigns g
INNER JOIN clients c ON c.id = g.client_id
WHERE g.date_range_start >= '2025-12-01'
  AND g.date_range_start <= '2025-12-31'
GROUP BY c.name
ORDER BY SUM(g.spend) DESC;

-- ============================================================================
-- STEP 2: Sample raw campaign data to see what values are stored
-- ============================================================================
SELECT 
  '2️⃣ SAMPLE CAMPAIGN DATA' as check_type,
  c.name as client_name,
  g.campaign_name,
  g.date_range_start,
  g.spend,
  g.booking_step_1,
  g.booking_step_2,
  g.booking_step_3,
  g.reservations,
  g.reservation_value
FROM google_ads_campaigns g
INNER JOIN clients c ON c.id = g.client_id
WHERE g.date_range_start >= '2025-12-01'
  AND g.date_range_start <= '2025-12-31'
  AND g.spend > 0
ORDER BY g.spend DESC
LIMIT 20;

-- ============================================================================
-- STEP 3: Check if ANY client has non-zero booking_step values in December
-- ============================================================================
SELECT 
  '3️⃣ ANY NON-ZERO BOOKING STEPS?' as check_type,
  CASE 
    WHEN SUM(booking_step_1) > 0 THEN 'YES - booking_step_1 has data'
    ELSE 'NO - booking_step_1 is all zeros'
  END as step1_status,
  CASE 
    WHEN SUM(booking_step_2) > 0 THEN 'YES - booking_step_2 has data'
    ELSE 'NO - booking_step_2 is all zeros'
  END as step2_status,
  CASE 
    WHEN SUM(booking_step_3) > 0 THEN 'YES - booking_step_3 has data'
    ELSE 'NO - booking_step_3 is all zeros'
  END as step3_status,
  CASE 
    WHEN SUM(reservations) > 0 THEN 'YES - reservations has data'
    ELSE 'NO - reservations is all zeros'
  END as reservations_status,
  SUM(booking_step_1) as total_step1,
  SUM(booking_step_2) as total_step2,
  SUM(booking_step_3) as total_step3,
  SUM(reservations) as total_reservations
FROM google_ads_campaigns
WHERE date_range_start >= '2025-12-01'
  AND date_range_start <= '2025-12-31';

-- ============================================================================
-- STEP 4: Check what months DO have non-zero booking_step values
-- ============================================================================
SELECT 
  '4️⃣ MONTHS WITH BOOKING STEP DATA' as check_type,
  TO_CHAR(date_range_start, 'YYYY-MM') as month,
  SUM(booking_step_1) as total_step1,
  SUM(booking_step_2) as total_step2,
  SUM(booking_step_3) as total_step3,
  SUM(reservations) as total_reservations,
  COUNT(*) as campaign_count
FROM google_ads_campaigns
GROUP BY TO_CHAR(date_range_start, 'YYYY-MM')
ORDER BY month DESC
LIMIT 12;

-- ============================================================================
-- STEP 5: Check daily_kpi_data for Google Ads conversion metrics
-- ============================================================================
SELECT 
  '5️⃣ DAILY_KPI_DATA DECEMBER GOOGLE' as check_type,
  c.name as client_name,
  COUNT(*) as days_with_data,
  SUM(k.booking_step_1) as total_step1,
  SUM(k.booking_step_2) as total_step2,
  SUM(k.booking_step_3) as total_step3,
  SUM(k.reservations) as total_reservations
FROM daily_kpi_data k
INNER JOIN clients c ON c.id = k.client_id
WHERE k.date >= '2025-12-01'
  AND k.date <= '2025-12-31'
  AND k.platform = 'google'
GROUP BY c.name
ORDER BY SUM(k.booking_step_1) DESC;

-- ============================================================================
-- STEP 6: Check campaign_data JSONB in campaign_summaries (may have booking steps)
-- ============================================================================
SELECT 
  '6️⃣ CAMPAIGN_DATA JSONB CHECK' as check_type,
  c.name as client_name,
  cs.summary_date,
  jsonb_array_length(cs.campaign_data) as campaigns_in_jsonb,
  cs.campaign_data->0->>'booking_step_1' as first_campaign_step1,
  cs.campaign_data->0->>'booking_step_2' as first_campaign_step2,
  cs.campaign_data->0->>'booking_step_3' as first_campaign_step3
FROM campaign_summaries cs
INNER JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_date = '2025-12-01'
  AND cs.platform = 'google'
  AND cs.summary_type = 'monthly'
ORDER BY cs.total_spend DESC;

