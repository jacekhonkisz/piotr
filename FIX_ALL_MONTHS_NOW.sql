-- ============================================================================
-- COMPREHENSIVE FIX: Make All Months Consistent
-- ============================================================================
-- This adds missing conversion data to ALL historical months
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Add conversions from daily_kpi_data to ALL months
UPDATE campaign_summaries cs
SET 
  click_to_call = COALESCE(daily_totals.click_to_call, 0),
  email_contacts = COALESCE(daily_totals.email_contacts, 0),
  booking_step_1 = COALESCE(daily_totals.booking_step_1, 0),
  booking_step_2 = COALESCE(daily_totals.booking_step_2, 0),
  booking_step_3 = COALESCE(daily_totals.booking_step_3, 0),
  reservations = COALESCE(daily_totals.reservations, 0),
  reservation_value = COALESCE(daily_totals.reservation_value, 0),
  roas = CASE 
    WHEN cs.total_spend > 0 AND daily_totals.reservation_value > 0 
    THEN ROUND((daily_totals.reservation_value / cs.total_spend)::numeric, 2)
    ELSE 0
  END,
  cost_per_reservation = CASE
    WHEN daily_totals.reservations > 0
    THEN ROUND((cs.total_spend / daily_totals.reservations)::numeric, 2)
    ELSE 0
  END,
  last_updated = NOW()
FROM (
  SELECT 
    client_id,
    DATE_TRUNC('month', date)::date as month_start,
    SUM(COALESCE(click_to_call, 0)) as click_to_call,
    SUM(COALESCE(email_contacts, 0)) as email_contacts,
    SUM(COALESCE(booking_step_1, 0)) as booking_step_1,
    SUM(COALESCE(booking_step_2, 0)) as booking_step_2,
    SUM(COALESCE(booking_step_3, 0)) as booking_step_3,
    SUM(COALESCE(reservations, 0)) as reservations,
    SUM(COALESCE(reservation_value, 0)) as reservation_value
  FROM daily_kpi_data
  WHERE date >= '2025-01-01'
    AND date < DATE_TRUNC('month', CURRENT_DATE)  -- Up to but not including current month
  GROUP BY client_id, DATE_TRUNC('month', date)::date
) daily_totals
WHERE cs.client_id = daily_totals.client_id
  AND cs.summary_date = daily_totals.month_start
  AND cs.summary_type = 'monthly'
  AND cs.platform = 'meta';

-- Step 2: Verify the update
SELECT 
  '✅ VERIFICATION' as status,
  summary_date,
  jsonb_array_length(COALESCE(campaign_data, '[]'::jsonb)) as campaigns,
  total_spend,
  click_to_call,
  booking_step_1,
  reservations,
  reservation_value,
  roas,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated
FROM campaign_summaries
WHERE summary_type = 'monthly'
  AND summary_date >= '2025-07-01'
  AND summary_date < DATE_TRUNC('month', CURRENT_DATE)
ORDER BY summary_date DESC, client_id
LIMIT 10;

-- Step 3: Show summary of what was fixed
SELECT 
  '📊 SUMMARY' as status,
  COUNT(*) as total_records_updated,
  SUM(CASE WHEN reservations > 0 THEN 1 ELSE 0 END) as records_with_conversions,
  SUM(CASE WHEN campaign_data IS NOT NULL AND jsonb_array_length(campaign_data) > 0 THEN 1 ELSE 0 END) as records_with_campaigns,
  SUM(CASE WHEN reservations > 0 AND campaign_data IS NOT NULL THEN 1 ELSE 0 END) as complete_records
FROM campaign_summaries
WHERE summary_type = 'monthly'
  AND summary_date >= '2025-01-01'
  AND summary_date < DATE_TRUNC('month', CURRENT_DATE)
  AND platform = 'meta';












