-- ============================================================================
-- INVESTIGATE: Why was October Meta data updated 15 days after creation?
-- ============================================================================
-- Purpose: Check if the Nov 16 update added conversion metrics or if they're still missing
-- ============================================================================

-- 1️⃣ COMPARE OCTOBER DATA WITH OTHER MONTHS - Check if conversion metrics are missing
SELECT 
  'OCTOBER VS OTHER MONTHS - CONVERSION METRICS' as check_type,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as month,
  cs.platform,
  cs.total_spend,
  cs.reservations,
  cs.reservation_value,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  CASE 
    WHEN cs.reservations IS NULL OR cs.reservations = 0 THEN '❌ No Reservations'
    WHEN cs.reservation_value IS NULL OR cs.reservation_value = 0 THEN '❌ No Reservation Value'
    WHEN cs.booking_step_1 IS NULL OR cs.booking_step_1 = 0 THEN '⚠️ No Booking Steps'
    ELSE '✅ Has Conversion Data'
  END as conversion_status,
  cs.data_source,
  DATE(cs.created_at) as created_date,
  DATE(cs.last_updated) as last_updated_date
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'monthly'
  AND cs.platform = 'meta'
  AND cs.summary_date >= '2025-08-01'
  AND cs.summary_date <= '2025-11-01'
ORDER BY cs.summary_date DESC;

-- 2️⃣ CHECK IF CAMPAIGN DATA HAS CONVERSION METRICS - October vs other months
SELECT 
  'CAMPAIGN DATA CONVERSION CHECK' as check_type,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as month,
  jsonb_array_length(cs.campaign_data) as campaign_count,
  -- Check if first campaign has conversion data
  (cs.campaign_data->0->>'reservations')::int as sample_campaign_reservations,
  (cs.campaign_data->0->>'booking_step_1')::int as sample_campaign_booking_step_1,
  (cs.campaign_data->0->>'booking_step_2')::int as sample_campaign_booking_step_2,
  (cs.campaign_data->0->>'booking_step_3')::int as sample_campaign_booking_step_3,
  -- Count campaigns with conversion data
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(cs.campaign_data) AS campaign
    WHERE (campaign->>'reservations')::int > 0
  ) as campaigns_with_reservations,
  (
    SELECT COUNT(*)
    FROM jsonb_array_elements(cs.campaign_data) AS campaign
    WHERE (campaign->>'booking_step_1')::int > 0
  ) as campaigns_with_booking_step_1
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'monthly'
  AND cs.platform = 'meta'
  AND cs.summary_date >= '2025-08-01'
  AND cs.summary_date <= '2025-11-01'
ORDER BY cs.summary_date DESC;

-- 3️⃣ CHECK DAILY KPI DATA AVAILABILITY - October vs other months
SELECT 
  'DAILY KPI DATA AVAILABILITY' as check_type,
  TO_CHAR(date, 'YYYY-MM') as month,
  COUNT(*) as total_days,
  SUM(total_spend)::numeric(12,2) as total_spend,
  SUM(reservations) as total_reservations,
  SUM(reservation_value)::numeric(12,2) as total_reservation_value,
  SUM(booking_step_1) as total_booking_step_1,
  SUM(booking_step_2) as total_booking_step_2,
  SUM(booking_step_3) as total_booking_step_3,
  COUNT(*) FILTER (WHERE reservations > 0) as days_with_reservations,
  CASE 
    WHEN COUNT(*) = 0 THEN '❌ No Daily Data'
    WHEN SUM(reservations) = 0 THEN '⚠️ Daily Data Exists But No Reservations'
    ELSE '✅ Has Daily Data With Reservations'
  END as daily_data_status
FROM daily_kpi_data
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'meta'
  AND date >= '2025-08-01'
  AND date < '2025-12-01'
GROUP BY TO_CHAR(date, 'YYYY-MM')
ORDER BY month DESC;

-- 4️⃣ DETAILED OCTOBER MONTHLY SUMMARY - All fields
SELECT 
  'OCTOBER DETAILED SUMMARY' as check_type,
  cs.summary_type,
  cs.platform,
  cs.summary_date,
  -- Core metrics
  cs.total_spend,
  cs.total_impressions,
  cs.total_clicks,
  cs.total_conversions,
  -- Conversion funnel
  cs.click_to_call,
  cs.email_contacts,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  cs.reservations,
  cs.reservation_value,
  cs.roas,
  cs.cost_per_reservation,
  -- Data source
  cs.data_source,
  -- Timestamps
  cs.created_at,
  cs.last_updated,
  EXTRACT(EPOCH FROM (cs.last_updated - cs.created_at)) / 86400 as days_between_create_update,
  -- Campaign count
  jsonb_array_length(cs.campaign_data) as campaign_count
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'monthly'
  AND cs.summary_date = '2025-10-01'
ORDER BY cs.platform;

-- 5️⃣ CHECK IF NOV 16 UPDATE CHANGED ANYTHING - Compare with other months update patterns
SELECT 
  'UPDATE PATTERN ANALYSIS' as check_type,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as month,
  cs.platform,
  DATE(cs.created_at) as created_date,
  DATE(cs.last_updated) as last_updated_date,
  EXTRACT(EPOCH FROM (cs.last_updated - cs.created_at)) / 86400 as days_between,
  CASE 
    WHEN EXTRACT(EPOCH FROM (cs.last_updated - cs.created_at)) / 86400 < 1 THEN '✅ Single collection'
    WHEN EXTRACT(EPOCH FROM (cs.last_updated - cs.created_at)) / 86400 BETWEEN 1 AND 7 THEN '⚠️ Updated within week'
    WHEN EXTRACT(EPOCH FROM (cs.last_updated - cs.created_at)) / 86400 > 7 THEN '❌ Updated much later (possible fix attempt)'
    ELSE 'Unknown'
  END as update_pattern,
  cs.reservations,
  cs.reservation_value
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'monthly'
  AND cs.platform = 'meta'
  AND cs.summary_date >= '2025-08-01'
  AND cs.summary_date <= '2025-11-01'
ORDER BY cs.summary_date DESC;



