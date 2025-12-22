-- ============================================================================
-- CHECK: Daily KPI Data Availability for All Months
-- ============================================================================
-- Purpose: Compare which months have daily_kpi_data to understand the pattern
-- ============================================================================

-- 1️⃣ DAILY KPI DATA AVAILABILITY BY MONTH
SELECT 
  'DAILY KPI DATA AVAILABILITY' as check_type,
  TO_CHAR(date, 'YYYY-MM') as month,
  COUNT(*) as total_days,
  COUNT(DISTINCT DATE(date)) as unique_days,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  SUM(total_spend)::numeric(12,2) as total_spend,
  SUM(reservations) as total_reservations,
  SUM(reservation_value)::numeric(12,2) as total_reservation_value,
  SUM(booking_step_1) as total_booking_step_1,
  SUM(booking_step_2) as total_booking_step_2,
  SUM(booking_step_3) as total_booking_step_3,
  COUNT(*) FILTER (WHERE reservations > 0) as days_with_reservations,
  CASE 
    WHEN COUNT(*) = 0 THEN '❌ NO DATA'
    WHEN COUNT(*) < 28 THEN '⚠️ INCOMPLETE (< 28 days)'
    WHEN COUNT(*) >= 28 AND COUNT(*) < 31 THEN '⚠️ MOSTLY COMPLETE'
    WHEN COUNT(*) >= 31 THEN '✅ COMPLETE'
    ELSE 'Unknown'
  END as completeness_status,
  CASE 
    WHEN SUM(reservations) = 0 THEN '⚠️ No Reservations in Daily Data'
    WHEN SUM(reservations) > 0 THEN '✅ Has Reservations'
    ELSE 'Unknown'
  END as conversion_status
FROM daily_kpi_data
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'meta'
  AND date >= '2025-08-01'
  AND date < '2025-12-01'
GROUP BY TO_CHAR(date, 'YYYY-MM')
ORDER BY month DESC;

-- 2️⃣ COMPARE WITH MONTHLY SUMMARIES - See if daily data matches monthly
SELECT 
  'MONTHLY VS DAILY COMPARISON' as check_type,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as month,
  -- Monthly summary
  cs.total_spend as monthly_spend,
  cs.reservations as monthly_reservations,
  cs.reservation_value as monthly_reservation_value,
  cs.data_source as monthly_data_source,
  -- Daily KPI aggregated
  COALESCE(daily.total_spend, 0)::numeric(12,2) as daily_aggregated_spend,
  COALESCE(daily.total_reservations, 0) as daily_aggregated_reservations,
  COALESCE(daily.total_reservation_value, 0)::numeric(12,2) as daily_aggregated_reservation_value,
  -- Comparison
  CASE 
    WHEN daily.total_reservations IS NULL THEN '❌ No Daily Data Available'
    WHEN cs.reservations = 0 AND daily.total_reservations > 0 THEN '⚠️ Daily Has Data But Monthly Missing'
    WHEN cs.reservations > 0 AND daily.total_reservations = 0 THEN '⚠️ Monthly Has Data But Daily Missing'
    WHEN cs.reservations = daily.total_reservations THEN '✅ Match'
    WHEN ABS(cs.reservations - COALESCE(daily.total_reservations, 0)) < 5 THEN '⚠️ Close Match (Possible Rounding)'
    ELSE '❌ Mismatch'
  END as comparison_status
FROM campaign_summaries cs
LEFT JOIN (
  SELECT 
    TO_CHAR(date, 'YYYY-MM') as month,
    SUM(total_spend)::numeric(12,2) as total_spend,
    SUM(reservations) as total_reservations,
    SUM(reservation_value)::numeric(12,2) as total_reservation_value
  FROM daily_kpi_data
  WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
    AND platform = 'meta'
  GROUP BY TO_CHAR(date, 'YYYY-MM')
) daily ON TO_CHAR(cs.summary_date, 'YYYY-MM') = daily.month
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'monthly'
  AND cs.platform = 'meta'
  AND cs.summary_date >= '2025-08-01'
  AND cs.summary_date <= '2025-11-01'
ORDER BY cs.summary_date DESC;

-- 3️⃣ CHECK WHEN DAILY KPI DATA WAS COLLECTED
SELECT 
  'DAILY KPI COLLECTION TIMELINE' as check_type,
  TO_CHAR(date, 'YYYY-MM') as month,
  COUNT(*) as total_records,
  MIN(DATE(created_at)) as first_collected,
  MAX(DATE(created_at)) as last_collected,
  MIN(DATE(last_updated)) as first_updated,
  MAX(DATE(last_updated)) as last_updated,
  CASE 
    WHEN MIN(DATE(created_at))::date <= (TO_CHAR(date, 'YYYY-MM') || '-01')::date + INTERVAL '7 days' THEN '✅ Collected Early'
    WHEN MIN(DATE(created_at))::date <= (TO_CHAR(date, 'YYYY-MM') || '-01')::date + INTERVAL '15 days' THEN '⚠️ Collected Mid-Month'
    WHEN MIN(DATE(created_at))::date > (TO_CHAR(date, 'YYYY-MM') || '-01')::date + INTERVAL '15 days' THEN '❌ Collected Late'
    ELSE 'Unknown'
  END as collection_timing
FROM daily_kpi_data
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'meta'
  AND date >= '2025-08-01'
  AND date < '2025-12-01'
GROUP BY TO_CHAR(date, 'YYYY-MM')
ORDER BY month DESC;



