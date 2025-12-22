-- ============================================================================
-- CHECK: October Weekly Summaries - Do They Have Conversion Data?
-- ============================================================================
-- Purpose: Check if weekly summaries have conversion metrics that can be aggregated
-- ============================================================================

-- 1️⃣ OCTOBER WEEKLY SUMMARIES - Full Details
SELECT 
  'OCTOBER WEEKLY SUMMARIES' as check_type,
  TO_CHAR(cs.summary_date, 'YYYY-MM-DD') as week_start,
  TO_CHAR(cs.summary_date, 'YYYY-"W"WW') as week_label,
  cs.total_spend,
  cs.total_impressions,
  cs.total_clicks,
  -- Conversion metrics
  cs.reservations,
  cs.reservation_value,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  cs.click_to_call,
  cs.email_contacts,
  -- Data source
  cs.data_source,
  -- Status
  CASE 
    WHEN cs.reservations > 0 THEN '✅ Has Conversion Data'
    WHEN cs.reservation_value > 0 THEN '✅ Has Reservation Value'
    WHEN cs.booking_step_1 > 0 THEN '✅ Has Booking Steps'
    ELSE '❌ No Conversion Data'
  END as conversion_status,
  DATE(cs.created_at) as created_date
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND cs.summary_date >= '2025-10-01'
  AND cs.summary_date < '2025-11-01'
ORDER BY cs.summary_date;

-- 2️⃣ AGGREGATE OCTOBER WEEKLY TO MONTHLY - Compare with monthly summary
SELECT 
  'WEEKLY AGGREGATION VS MONTHLY' as check_type,
  'Weekly Aggregated' as source,
  SUM(cs.total_spend)::numeric(12,2) as total_spend,
  SUM(cs.reservations) as total_reservations,
  SUM(cs.reservation_value)::numeric(12,2) as total_reservation_value,
  SUM(cs.booking_step_1) as total_booking_step_1,
  SUM(cs.booking_step_2) as total_booking_step_2,
  SUM(cs.booking_step_3) as total_booking_step_3,
  SUM(cs.click_to_call) as total_click_to_call,
  SUM(cs.email_contacts) as total_email_contacts,
  COUNT(*) as week_count
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND cs.summary_date >= '2025-10-01'
  AND cs.summary_date < '2025-11-01'

UNION ALL

SELECT 
  'WEEKLY AGGREGATION VS MONTHLY' as check_type,
  'Monthly Summary' as source,
  cs.total_spend,
  cs.reservations,
  cs.reservation_value,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  cs.click_to_call,
  cs.email_contacts,
  1 as week_count
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'monthly'
  AND cs.platform = 'meta'
  AND cs.summary_date = '2025-10-01';

-- 3️⃣ CHECK IF WEEKLY DATA CAN FIX MONTHLY
SELECT 
  'CAN WEEKLY DATA FIX MONTHLY?' as check_type,
  CASE 
    WHEN weekly.total_reservations > 0 AND monthly.reservations = 0 THEN '✅ YES - Weekly has data, monthly missing'
    WHEN weekly.total_reservations = 0 AND monthly.reservations = 0 THEN '❌ NO - Both missing'
    WHEN weekly.total_reservations = monthly.reservations THEN '✅ Match'
    ELSE '⚠️ Mismatch'
  END as can_fix,
  weekly.total_reservations as weekly_reservations,
  monthly.reservations as monthly_reservations,
  weekly.total_reservation_value as weekly_reservation_value,
  monthly.reservation_value as monthly_reservation_value
FROM (
  SELECT 
    SUM(reservations) as total_reservations,
    SUM(reservation_value)::numeric(12,2) as total_reservation_value
  FROM campaign_summaries
  WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
    AND summary_type = 'weekly'
    AND platform = 'meta'
    AND summary_date >= '2025-10-01'
    AND summary_date < '2025-11-01'
) weekly
CROSS JOIN (
  SELECT 
    reservations,
    reservation_value
  FROM campaign_summaries
  WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
    AND summary_type = 'monthly'
    AND platform = 'meta'
    AND summary_date = '2025-10-01'
) monthly;



