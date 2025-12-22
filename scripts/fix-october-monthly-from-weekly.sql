-- ============================================================================
-- FIX: Update October Monthly Summary from Weekly Data
-- ============================================================================
-- Purpose: Aggregate October weekly summaries to populate monthly summary
--          Weekly data has: 392 reservations, 1,730,360.00 value
--          Monthly data has: 0 reservations, 0 value
-- ============================================================================

-- 1️⃣ PREVIEW: What will be updated (dry run)
SELECT 
  'PREVIEW UPDATE' as action,
  'October Monthly Summary' as target,
  -- Current values
  cs.reservations as current_reservations,
  cs.reservation_value as current_reservation_value,
  cs.booking_step_1 as current_booking_step_1,
  cs.booking_step_2 as current_booking_step_2,
  cs.booking_step_3 as current_booking_step_3,
  cs.click_to_call as current_click_to_call,
  cs.email_contacts as current_email_contacts,
  -- New values (from weekly aggregation)
  weekly_agg.total_reservations as new_reservations,
  weekly_agg.total_reservation_value as new_reservation_value,
  weekly_agg.total_booking_step_1 as new_booking_step_1,
  weekly_agg.total_booking_step_2 as new_booking_step_2,
  weekly_agg.total_booking_step_3 as new_booking_step_3,
  weekly_agg.total_click_to_call as new_click_to_call,
  weekly_agg.total_email_contacts as new_email_contacts,
  -- Comparison
  CASE 
    WHEN cs.reservations = 0 AND weekly_agg.total_reservations > 0 THEN '✅ Will Fix'
    WHEN cs.reservations = weekly_agg.total_reservations THEN '✅ Already Correct'
    ELSE '⚠️ Mismatch'
  END as update_status
FROM campaign_summaries cs
CROSS JOIN (
  SELECT 
    SUM(reservations) as total_reservations,
    SUM(reservation_value)::numeric(12,2) as total_reservation_value,
    SUM(booking_step_1) as total_booking_step_1,
    SUM(booking_step_2) as total_booking_step_2,
    SUM(booking_step_3) as total_booking_step_3,
    SUM(click_to_call) as total_click_to_call,
    SUM(email_contacts) as total_email_contacts
  FROM campaign_summaries
  WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
    AND summary_type = 'weekly'
    AND platform = 'meta'
    AND summary_date >= '2025-10-01'
    AND summary_date < '2025-11-01'
) weekly_agg
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'monthly'
  AND cs.platform = 'meta'
  AND cs.summary_date = '2025-10-01';

-- 2️⃣ ACTUAL UPDATE: Aggregate weekly data to monthly summary
UPDATE campaign_summaries cs
SET 
  -- Conversion funnel metrics
  reservations = weekly_agg.total_reservations,
  reservation_value = weekly_agg.total_reservation_value,
  booking_step_1 = weekly_agg.total_booking_step_1,
  booking_step_2 = weekly_agg.total_booking_step_2,
  booking_step_3 = weekly_agg.total_booking_step_3,
  click_to_call = weekly_agg.total_click_to_call,
  email_contacts = weekly_agg.total_email_contacts,
  -- Calculated metrics
  roas = CASE 
    WHEN weekly_agg.total_reservation_value > 0 AND cs.total_spend > 0 
    THEN weekly_agg.total_reservation_value / cs.total_spend 
    ELSE 0 
  END,
  cost_per_reservation = CASE 
    WHEN weekly_agg.total_reservations > 0 AND cs.total_spend > 0 
    THEN cs.total_spend / weekly_agg.total_reservations 
    ELSE 0 
  END,
  -- Update data source to indicate it came from weekly aggregation
  data_source = 'weekly_aggregation_fallback',
  -- Update timestamp
  last_updated = NOW()
FROM (
  SELECT 
    SUM(reservations) as total_reservations,
    SUM(reservation_value)::numeric(12,2) as total_reservation_value,
    SUM(booking_step_1) as total_booking_step_1,
    SUM(booking_step_2) as total_booking_step_2,
    SUM(booking_step_3) as total_booking_step_3,
    SUM(click_to_call) as total_click_to_call,
    SUM(email_contacts) as total_email_contacts
  FROM campaign_summaries
  WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
    AND summary_type = 'weekly'
    AND platform = 'meta'
    AND summary_date >= '2025-10-01'
    AND summary_date < '2025-11-01'
) weekly_agg
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'monthly'
  AND cs.platform = 'meta'
  AND cs.summary_date = '2025-10-01';

-- 3️⃣ VERIFY: Check the update worked
SELECT 
  'VERIFICATION' as check_type,
  cs.summary_date,
  cs.platform,
  cs.total_spend,
  cs.reservations,
  cs.reservation_value,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  cs.roas,
  cs.cost_per_reservation,
  cs.data_source,
  CASE 
    WHEN cs.reservations > 0 THEN '✅ FIXED - Has Conversion Data'
    ELSE '❌ Still Missing'
  END as status
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'monthly'
  AND cs.platform = 'meta'
  AND cs.summary_date = '2025-10-01';

-- 4️⃣ COMPARE: Weekly aggregated vs Monthly (should match now)
SELECT 
  'FINAL COMPARISON' as check_type,
  'Weekly Aggregated' as source,
  SUM(cs.total_spend)::numeric(12,2) as total_spend,
  SUM(cs.reservations) as total_reservations,
  SUM(cs.reservation_value)::numeric(12,2) as total_reservation_value,
  SUM(cs.booking_step_1) as total_booking_step_1,
  SUM(cs.booking_step_2) as total_booking_step_2,
  SUM(cs.booking_step_3) as total_booking_step_3
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND cs.summary_date >= '2025-10-01'
  AND cs.summary_date < '2025-11-01'

UNION ALL

SELECT 
  'FINAL COMPARISON' as check_type,
  'Monthly Summary' as source,
  cs.total_spend,
  cs.reservations,
  cs.reservation_value,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'monthly'
  AND cs.platform = 'meta'
  AND cs.summary_date = '2025-10-01';



