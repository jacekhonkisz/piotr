-- 🔍 DIAGNOSE MISSING CONVERSION DATA
-- Run this to understand why some periods have missing conversion metrics

-- 1. Check campaign_summaries for missing conversion data
SELECT 
  'campaign_summaries' as source,
  summary_type,
  summary_date,
  period_id,
  platform,
  total_spend,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  jsonb_array_length(campaign_data) as campaign_count,
  data_source,
  CASE 
    WHEN total_spend > 0 AND (booking_step_1 IS NULL OR booking_step_1 = 0) THEN '❌ MISSING'
    ELSE '✅ OK'
  END as data_status,
  created_at
FROM campaign_summaries
WHERE summary_type IN ('weekly', 'monthly')
  AND summary_date >= '2025-11-01'
ORDER BY summary_date DESC
LIMIT 20;

-- 2. Check if daily_kpi_data has the conversion metrics
SELECT 
  'daily_kpi_data' as source,
  date,
  spend,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  CASE 
    WHEN spend > 0 AND (booking_step_1 IS NULL OR booking_step_1 = 0) THEN '❌ MISSING'
    ELSE '✅ OK'
  END as data_status,
  created_at
FROM daily_kpi_data
WHERE date >= '2025-11-01'
ORDER BY date DESC
LIMIT 20;

-- 3. Check campaign_data JSON structure
SELECT 
  summary_date,
  summary_type,
  jsonb_array_length(campaign_data) as total_campaigns,
  campaign_data->0->>'campaign_name' as first_campaign_name,
  campaign_data->0->>'spend' as first_campaign_spend,
  campaign_data->0->>'booking_step_1' as first_campaign_booking1,
  campaign_data->0->>'booking_step_2' as first_campaign_booking2,
  campaign_data->0->>'booking_step_3' as first_campaign_booking3,
  campaign_data->0->>'reservations' as first_campaign_reservations,
  (SELECT jsonb_object_keys(campaign_data->0) LIMIT 10) as available_keys
FROM campaign_summaries
WHERE summary_date >= '2025-11-01'
  AND jsonb_array_length(campaign_data) > 0
ORDER BY summary_date DESC
LIMIT 5;

-- 4. Compare aggregated columns vs campaign_data calculation
SELECT 
  summary_date,
  summary_type,
  -- Aggregated columns
  booking_step_1 as agg_booking_step_1,
  booking_step_2 as agg_booking_step_2,
  booking_step_3 as agg_booking_step_3,
  reservations as agg_reservations,
  -- Calculated from campaign_data
  (
    SELECT SUM((value->>'booking_step_1')::numeric)
    FROM jsonb_array_elements(campaign_data) as value
  ) as calc_booking_step_1,
  (
    SELECT SUM((value->>'booking_step_2')::numeric)
    FROM jsonb_array_elements(campaign_data) as value
  ) as calc_booking_step_2,
  (
    SELECT SUM((value->>'booking_step_3')::numeric)
    FROM jsonb_array_elements(campaign_data) as value
  ) as calc_booking_step_3,
  (
    SELECT SUM((value->>'reservations')::numeric)
    FROM jsonb_array_elements(campaign_data) as value
  ) as calc_reservations
FROM campaign_summaries
WHERE summary_date >= '2025-11-01'
  AND summary_type IN ('weekly', 'monthly')
ORDER BY summary_date DESC
LIMIT 10;

-- 5. Find the exact period with missing data from screenshots
SELECT 
  summary_date,
  summary_type,
  total_spend,
  total_clicks,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  CASE 
    WHEN total_spend BETWEEN 24000 AND 25000 THEN '📸 Screenshot 1 Match?'
    WHEN total_spend BETWEEN 6000 AND 7000 THEN '📸 Screenshot 2 Match?'
    ELSE ''
  END as screenshot_match
FROM campaign_summaries
WHERE summary_date >= '2025-11-01'
ORDER BY total_spend DESC;

