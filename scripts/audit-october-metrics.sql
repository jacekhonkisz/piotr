-- ============================================================================
-- AUDIT: Why October (Październik) Historical Data Missing Metrics
-- ============================================================================
-- Purpose: Investigate why October data has missing conversion metrics,
--          reservation data, and other key performance indicators
-- ============================================================================

-- 1️⃣ OCTOBER 2025 MONTHLY DATA - Check all metrics
SELECT 
  '1️⃣ OCTOBER 2025 MONTHLY DATA' as audit_section,
  cs.summary_type,
  TO_CHAR(cs.summary_date, 'YYYY-MM-DD') as period,
  cs.platform,
  cs.total_spend,
  cs.total_impressions,
  cs.total_clicks,
  cs.total_conversions,
  -- Conversion funnel metrics
  cs.click_to_call,
  cs.email_contacts,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  cs.reservations,
  cs.reservation_value,
  cs.roas,
  cs.cost_per_reservation,
  -- Data completeness check
  CASE 
    WHEN cs.reservations IS NULL OR cs.reservations = 0 THEN '❌ Missing Reservations'
    WHEN cs.reservation_value IS NULL OR cs.reservation_value = 0 THEN '❌ Missing Reservation Value'
    WHEN cs.booking_step_1 IS NULL OR cs.booking_step_1 = 0 THEN '⚠️ Missing Booking Steps'
    ELSE '✅ Has Conversion Data'
  END as conversion_data_status,
  -- Meta tables check
  CASE 
    WHEN cs.meta_tables IS NULL THEN '❌ No Meta Tables'
    WHEN cs.meta_tables::text = 'null' THEN '❌ Meta Tables NULL'
    WHEN jsonb_array_length(cs.meta_tables->'placementPerformance') > 0 THEN '✅ Has Meta Tables'
    ELSE '⚠️ Empty Meta Tables'
  END as meta_tables_status,
  -- Campaign data check
  CASE 
    WHEN cs.campaign_data IS NULL THEN '❌ No Campaign Data'
    WHEN jsonb_array_length(cs.campaign_data) > 0 THEN '✅ Has Campaigns (' || jsonb_array_length(cs.campaign_data)::text || ')'
    ELSE '⚠️ Empty Campaign Data'
  END as campaign_data_status,
  cs.data_source,
  DATE(cs.created_at) as created_date,
  DATE(cs.last_updated) as last_updated_date
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa' -- Belmonte
  AND cs.summary_type = 'monthly'
  AND cs.summary_date = '2025-10-01'
ORDER BY cs.platform;

-- 2️⃣ OCTOBER 2025 WEEKLY DATA - Check all weeks
SELECT 
  '2️⃣ OCTOBER 2025 WEEKLY DATA' as audit_section,
  TO_CHAR(cs.summary_date, 'YYYY-MM-DD') as week_start,
  TO_CHAR(cs.summary_date, 'YYYY-"W"WW') as week_label,
  cs.platform,
  cs.total_spend,
  cs.total_clicks,
  cs.reservations,
  cs.reservation_value,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  CASE 
    WHEN cs.reservations IS NULL OR cs.reservations = 0 THEN '❌ No Reservations'
    WHEN cs.reservation_value IS NULL OR cs.reservation_value = 0 THEN '❌ No Reservation Value'
    ELSE '✅ Has Conversion Data'
  END as conversion_status,
  CASE 
    WHEN cs.meta_tables IS NULL THEN '❌ No Meta Tables'
    WHEN jsonb_array_length(cs.meta_tables->'placementPerformance') > 0 THEN '✅ Has Meta Tables'
    ELSE '⚠️ Empty'
  END as meta_tables_status,
  DATE(cs.created_at) as created_date
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND cs.summary_date >= '2025-10-01'
  AND cs.summary_date < '2025-11-01'
ORDER BY cs.summary_date;

-- 3️⃣ COMPARE OCTOBER VS OTHER MONTHS - Check if October is different
SELECT 
  '3️⃣ OCTOBER VS OTHER MONTHS COMPARISON' as audit_section,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as month,
  cs.platform,
  COUNT(*) as records,
  SUM(cs.total_spend)::numeric(12,2) as total_spend,
  SUM(cs.reservations) as total_reservations,
  SUM(cs.reservation_value)::numeric(12,2) as total_reservation_value,
  SUM(cs.booking_step_1) as total_booking_step_1,
  SUM(cs.booking_step_2) as total_booking_step_2,
  SUM(cs.booking_step_3) as total_booking_step_3,
  COUNT(*) FILTER (WHERE cs.reservations IS NULL OR cs.reservations = 0) as records_without_reservations,
  COUNT(*) FILTER (WHERE cs.reservation_value IS NULL OR cs.reservation_value = 0) as records_without_reservation_value,
  COUNT(*) FILTER (WHERE cs.meta_tables IS NULL) as records_without_meta_tables
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'monthly'
  AND cs.platform = 'meta'
  AND cs.summary_date >= '2025-08-01'
  AND cs.summary_date <= '2025-11-01'
GROUP BY TO_CHAR(cs.summary_date, 'YYYY-MM'), cs.platform
ORDER BY month DESC;

-- 4️⃣ CHECK DAILY KPI DATA FOR OCTOBER - Fallback source
SELECT 
  '4️⃣ OCTOBER DAILY KPI DATA' as audit_section,
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
  COUNT(*) FILTER (WHERE reservation_value > 0) as days_with_reservation_value
FROM daily_kpi_data
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND date >= '2025-10-01'
  AND date < '2025-11-01';

-- 5️⃣ CHECK CAMPAIGN DATA IN OCTOBER MONTHLY SUMMARY - Individual campaigns
SELECT 
  '5️⃣ OCTOBER CAMPAIGN DATA DETAIL' as audit_section,
  cs.summary_date,
  cs.platform,
  jsonb_array_length(cs.campaign_data) as campaign_count,
  -- Sample first campaign to check structure
  cs.campaign_data->0->>'name' as sample_campaign_name,
  cs.campaign_data->0->>'spend' as sample_campaign_spend,
  cs.campaign_data->0->>'reservations' as sample_campaign_reservations,
  cs.campaign_data->0->>'reservation_value' as sample_campaign_reservation_value,
  cs.campaign_data->0->>'booking_step_1' as sample_campaign_booking_step_1,
  cs.campaign_data->0->>'booking_step_2' as sample_campaign_booking_step_2,
  cs.campaign_data->0->>'booking_step_3' as sample_campaign_booking_step_3,
  -- Check if campaigns have conversion data
  COUNT(*) FILTER (
    WHERE jsonb_array_length(cs.campaign_data) > 0 
    AND (cs.campaign_data->0->>'reservations')::int > 0
  ) as campaigns_with_reservations
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'monthly'
  AND cs.summary_date = '2025-10-01'
  AND cs.platform = 'meta'
GROUP BY cs.summary_date, cs.platform, cs.campaign_data;

-- 6️⃣ CHECK DATA SOURCE AND COLLECTION METHOD
SELECT 
  '6️⃣ OCTOBER DATA SOURCE ANALYSIS' as audit_section,
  cs.summary_date,
  cs.platform,
  cs.data_source,
  COUNT(*) as records,
  SUM(cs.total_spend)::numeric(12,2) as total_spend,
  SUM(cs.reservations) as total_reservations,
  SUM(cs.reservation_value)::numeric(12,2) as total_reservation_value,
  MIN(DATE(cs.created_at)) as first_created,
  MAX(DATE(cs.last_updated)) as last_updated,
  CASE 
    WHEN cs.data_source = 'daily_kpi_data_fallback' THEN '⚠️ Used Daily KPI Fallback'
    WHEN cs.data_source = 'meta_api' THEN '✅ Direct Meta API'
    WHEN cs.data_source = 'smart_cache_archive' THEN '✅ From Smart Cache'
    ELSE '⚠️ Unknown Source'
  END as source_quality
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'monthly'
  AND cs.summary_date = '2025-10-01'
GROUP BY cs.summary_date, cs.platform, cs.data_source;

-- 7️⃣ COMPARE OCTOBER WEEKLY TOTALS VS MONTHLY - Check aggregation
SELECT 
  '7️⃣ OCTOBER WEEKLY VS MONTHLY COMPARISON' as audit_section,
  'Weekly Aggregated' as data_type,
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
  '7️⃣ OCTOBER WEEKLY VS MONTHLY COMPARISON' as audit_section,
  'Monthly Summary' as data_type,
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

-- 8️⃣ CHECK IF OCTOBER DATA WAS COLLECTED PROPERLY - Creation dates
SELECT 
  '8️⃣ OCTOBER COLLECTION TIMELINE' as audit_section,
  cs.summary_type,
  cs.platform,
  TO_CHAR(cs.summary_date, 'YYYY-MM-DD') as period,
  DATE(cs.created_at) as created_date,
  DATE(cs.last_updated) as last_updated_date,
  EXTRACT(EPOCH FROM (cs.last_updated - cs.created_at)) / 3600 as hours_between_create_update,
  CASE 
    WHEN cs.created_at::date = '2025-10-01' THEN '✅ Collected on time'
    WHEN cs.created_at::date BETWEEN '2025-10-01' AND '2025-10-07' THEN '✅ Collected early in month'
    WHEN cs.created_at::date BETWEEN '2025-10-08' AND '2025-10-31' THEN '⚠️ Collected mid-month'
    WHEN cs.created_at::date >= '2025-11-01' THEN '❌ Collected late (after month ended)'
    ELSE '⚠️ Unknown timing'
  END as collection_timing
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_date = '2025-10-01'
ORDER BY cs.platform, cs.summary_type;

