-- Check where conversion data actually exists for December
-- This will help us understand why conversions are zeros

-- ============================================================================
-- 1. CHECK GOOGLE_ADS_CAMPAIGNS TABLE
-- ============================================================================
SELECT 
  '1️⃣ GOOGLE_ADS_CAMPAIGNS TABLE' as source,
  client_id,
  COUNT(*) as campaign_count,
  SUM(spend)::numeric as total_spend,
  SUM(booking_step_1) as booking_step_1,
  SUM(booking_step_2) as booking_step_2,
  SUM(booking_step_3) as booking_step_3,
  SUM(reservations) as reservations,
  SUM(reservation_value)::numeric as reservation_value,
  -- Check if any campaigns have conversion data
  COUNT(CASE WHEN booking_step_1 > 0 THEN 1 END) as campaigns_with_step1,
  COUNT(CASE WHEN reservations > 0 THEN 1 END) as campaigns_with_reservations
FROM google_ads_campaigns
WHERE date_range_start >= '2025-12-01'
  AND date_range_start <= '2025-12-31'
GROUP BY client_id
ORDER BY total_spend DESC;

-- ============================================================================
-- 2. CHECK DAILY_KPI_DATA TABLE
-- ============================================================================
SELECT 
  '2️⃣ DAILY_KPI_DATA TABLE' as source,
  client_id,
  COUNT(DISTINCT date) as days_with_data,
  SUM(total_spend)::numeric as total_spend,
  SUM(booking_step_1) as booking_step_1,
  SUM(booking_step_2) as booking_step_2,
  SUM(booking_step_3) as booking_step_3,
  SUM(reservations) as reservations,
  SUM(reservation_value)::numeric as reservation_value
FROM daily_kpi_data
WHERE date >= '2025-12-01'
  AND date <= '2025-12-31'
  AND platform = 'google'
GROUP BY client_id
ORDER BY total_spend DESC;

-- ============================================================================
-- 3. CHECK CAMPAIGN_SUMMARIES (CURRENT STATE)
-- ============================================================================
SELECT 
  '3️⃣ CAMPAIGN_SUMMARIES (CURRENT)' as source,
  cs.client_id,
  c.name as client_name,
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
-- 4. COMPARISON - WHERE IS THE CONVERSION DATA?
-- ============================================================================
SELECT 
  '4️⃣ DATA SOURCE COMPARISON' as check_type,
  'google_ads_campaigns' as source,
  COUNT(DISTINCT client_id) as clients,
  SUM(booking_step_1) as total_step1,
  SUM(reservations) as total_reservations
FROM google_ads_campaigns
WHERE date_range_start >= '2025-12-01'
  AND date_range_start <= '2025-12-31'

UNION ALL

SELECT 
  '4️⃣ DATA SOURCE COMPARISON' as check_type,
  'daily_kpi_data' as source,
  COUNT(DISTINCT client_id) as clients,
  SUM(booking_step_1) as total_step1,
  SUM(reservations) as total_reservations
FROM daily_kpi_data
WHERE date >= '2025-12-01'
  AND date <= '2025-12-31'
  AND platform = 'google';

