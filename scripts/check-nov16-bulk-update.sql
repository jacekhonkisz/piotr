-- ============================================================================
-- INVESTIGATE: Nov 16 Bulk Update - Why did it work for September but not October/August?
-- ============================================================================
-- Purpose: Compare September (success) vs October/August (failed) to find the difference
-- ============================================================================

-- 1️⃣ COMPARE DAILY KPI DATA - September (success) vs October/August (failed)
SELECT 
  'DAILY KPI DATA COMPARISON' as check_type,
  TO_CHAR(date, 'YYYY-MM') as month,
  COUNT(*) as total_days,
  SUM(total_spend)::numeric(12,2) as total_spend,
  SUM(reservations) as total_reservations,
  SUM(reservation_value)::numeric(12,2) as total_reservation_value,
  SUM(booking_step_1) as total_booking_step_1,
  SUM(booking_step_2) as total_booking_step_2,
  SUM(booking_step_3) as total_booking_step_3,
  COUNT(*) FILTER (WHERE reservations > 0) as days_with_reservations,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  CASE 
    WHEN COUNT(*) = 0 THEN '❌ NO DAILY DATA'
    WHEN SUM(reservations) = 0 THEN '⚠️ Daily Data Exists But NO Reservations'
    WHEN SUM(reservations) > 0 THEN '✅ Daily Data WITH Reservations'
    ELSE 'Unknown'
  END as status
FROM daily_kpi_data
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'meta'
  AND date >= '2025-08-01'
  AND date < '2025-11-01'
GROUP BY TO_CHAR(date, 'YYYY-MM')
ORDER BY month DESC;

-- 2️⃣ COMPARE MONTHLY SUMMARIES - What's different between September and October?
SELECT 
  'MONTHLY SUMMARY COMPARISON' as check_type,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as month,
  cs.platform,
  -- Core metrics
  cs.total_spend,
  cs.total_impressions,
  cs.total_clicks,
  -- Conversion metrics
  cs.reservations,
  cs.reservation_value,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  -- Data source (critical!)
  cs.data_source,
  CASE 
    WHEN cs.data_source = 'daily_kpi_data_fallback' THEN '✅ Used Daily KPI Fallback'
    WHEN cs.data_source = 'meta_api' THEN '⚠️ Direct Meta API (may be missing conversions)'
    ELSE 'Unknown'
  END as source_analysis,
  -- Campaign count
  jsonb_array_length(cs.campaign_data) as campaign_count,
  -- Timestamps
  DATE(cs.created_at) as created_date,
  DATE(cs.last_updated) as updated_date
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'monthly'
  AND cs.platform = 'meta'
  AND cs.summary_date IN ('2025-09-01', '2025-10-01', '2025-08-01')
ORDER BY cs.summary_date DESC;

-- 3️⃣ CHECK CAMPAIGN DATA - Do campaigns have conversion fields?
SELECT 
  'CAMPAIGN DATA CONVERSION FIELDS' as check_type,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as month,
  jsonb_array_length(cs.campaign_data) as total_campaigns,
  -- Check first campaign
  cs.campaign_data->0->>'name' as sample_campaign_name,
  (cs.campaign_data->0->>'spend')::numeric(10,2) as sample_campaign_spend,
  (cs.campaign_data->0->>'reservations')::int as sample_campaign_reservations,
  (cs.campaign_data->0->>'booking_step_1')::int as sample_campaign_booking_step_1,
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
  ) as campaigns_with_booking_step_1,
  -- Sum from campaigns
  (
    SELECT COALESCE(SUM((campaign->>'reservations')::int), 0)
    FROM jsonb_array_elements(cs.campaign_data) AS campaign
  ) as total_reservations_from_campaigns,
  (
    SELECT COALESCE(SUM((campaign->>'booking_step_1')::int), 0)
    FROM jsonb_array_elements(cs.campaign_data) AS campaign
  ) as total_booking_step_1_from_campaigns
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'monthly'
  AND cs.platform = 'meta'
  AND cs.summary_date IN ('2025-09-01', '2025-10-01', '2025-08-01')
ORDER BY cs.summary_date DESC;

-- 4️⃣ CHECK IF NOV 16 UPDATE CHANGED DATA SOURCE
SELECT 
  'DATA SOURCE ANALYSIS' as check_type,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as month,
  cs.data_source,
  cs.reservations,
  cs.reservation_value,
  CASE 
    WHEN cs.data_source = 'daily_kpi_data_fallback' AND cs.reservations > 0 THEN '✅ Fallback worked'
    WHEN cs.data_source = 'daily_kpi_data_fallback' AND cs.reservations = 0 THEN '⚠️ Fallback used but no data'
    WHEN cs.data_source = 'meta_api' AND cs.reservations > 0 THEN '✅ Meta API had data'
    WHEN cs.data_source = 'meta_api' AND cs.reservations = 0 THEN '❌ Meta API missing conversions'
    ELSE 'Unknown'
  END as analysis
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'monthly'
  AND cs.platform = 'meta'
  AND cs.summary_date IN ('2025-09-01', '2025-10-01', '2025-08-01')
ORDER BY cs.summary_date DESC;

-- 5️⃣ DETAILED OCTOBER ANALYSIS - Why didn't it get fixed?
SELECT 
  'OCTOBER ROOT CAUSE' as check_type,
  'Monthly Summary' as data_type,
  cs.reservations as monthly_reservations,
  cs.reservation_value as monthly_reservation_value,
  cs.data_source,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'monthly'
  AND cs.platform = 'meta'
  AND cs.summary_date = '2025-10-01'

UNION ALL

SELECT 
  'OCTOBER ROOT CAUSE' as check_type,
  'Daily KPI Data (Fallback Source)' as data_type,
  SUM(reservations)::int,
  SUM(reservation_value)::numeric(12,2),
  'daily_kpi_data' as data_source,
  SUM(booking_step_1)::int,
  SUM(booking_step_2)::int,
  SUM(booking_step_3)::int
FROM daily_kpi_data
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'meta'
  AND date >= '2025-10-01'
  AND date < '2025-11-01'

UNION ALL

SELECT 
  'OCTOBER ROOT CAUSE' as check_type,
  'Campaign Data (Meta API Source)' as data_type,
  (
    SELECT COALESCE(SUM((campaign->>'reservations')::int), 0)
    FROM jsonb_array_elements(cs.campaign_data) AS campaign
  )::int,
  (
    SELECT COALESCE(SUM((campaign->>'reservation_value')::numeric), 0)
    FROM jsonb_array_elements(cs.campaign_data) AS campaign
  )::numeric(12,2),
  'campaign_data' as data_source,
  (
    SELECT COALESCE(SUM((campaign->>'booking_step_1')::int), 0)
    FROM jsonb_array_elements(cs.campaign_data) AS campaign
  )::int,
  (
    SELECT COALESCE(SUM((campaign->>'booking_step_2')::int), 0)
    FROM jsonb_array_elements(cs.campaign_data) AS campaign
  )::int,
  (
    SELECT COALESCE(SUM((campaign->>'booking_step_3')::int), 0)
    FROM jsonb_array_elements(cs.campaign_data) AS campaign
  )::int
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'monthly'
  AND cs.platform = 'meta'
  AND cs.summary_date = '2025-10-01';



