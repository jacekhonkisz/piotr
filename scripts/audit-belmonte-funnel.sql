-- ============================================================================
-- BELMONTE HOTEL FUNNEL AUDIT
-- ============================================================================
-- Purpose: Check why Belmonte Hotel has 0s in the funnel
-- Client ID: ab0b4c7e-2bf0-46bc-b455-b18ef6942baa
-- ============================================================================

-- 1. Check Belmonte's client information
SELECT 
  id,
  name,
  email,
  google_ads_enabled,
  google_ads_customer_id,
  ad_account_id as meta_ad_account_id,
  api_status
FROM clients
WHERE id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

-- 2. Check Google Ads campaign_summaries for January 2026 and December 2025
SELECT 
  summary_date,
  summary_type,
  platform,
  total_spend,
  total_impressions,
  total_clicks,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  total_conversions,
  last_updated,
  created_at
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'google'
  AND summary_date IN ('2026-01-01', '2025-12-01')
ORDER BY summary_date DESC, summary_type;

-- 3. Check daily_kpi_data for January 2026 and December 2025 (if exists)
-- Note: Google Ads uses data_source = 'google_ads_api' OR platform = 'google'
SELECT 
  date,
  data_source,
  platform,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  total_spend,
  total_clicks,
  total_conversions,
  created_at
FROM daily_kpi_data
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND (data_source = 'google_ads_api' OR platform = 'google')
  AND date >= '2025-12-01'
  AND date <= '2026-01-31'
ORDER BY date DESC;

-- 4. Check google_ads_campaigns table for January 2026 and December 2025
-- Note: This table uses date_range_start and date_range_end instead of a single date column
SELECT 
  DATE_TRUNC('month', date_range_start) as month,
  COUNT(*) as campaign_records,
  SUM(spend) as total_spend,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(booking_step_1) as total_step_1,
  SUM(booking_step_2) as total_step_2,
  SUM(booking_step_3) as total_step_3,
  SUM(reservations) as total_reservations,
  SUM(reservation_value) as total_reservation_value
FROM google_ads_campaigns
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND date_range_start >= '2025-12-01'
  AND date_range_end <= '2026-01-31'
GROUP BY DATE_TRUNC('month', date_range_start)
ORDER BY month DESC;

-- 5. Check current month cache for January 2026
SELECT 
  period_id,
  last_updated,
  AGE(NOW(), last_updated) as cache_age,
  cache_data->'stats'->>'totalSpend' as total_spend,
  cache_data->'stats'->>'totalClicks' as total_clicks,
  cache_data->'conversionMetrics'->>'booking_step_1' as step_1,
  cache_data->'conversionMetrics'->>'booking_step_2' as step_2,
  cache_data->'conversionMetrics'->>'booking_step_3' as step_3,
  cache_data->'conversionMetrics'->>'reservations' as reservations,
  cache_data->'conversionMetrics'->>'reservation_value' as reservation_value
FROM google_ads_current_month_cache
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND period_id IN ('2026-01', '2025-12')
ORDER BY period_id DESC;

-- 6. Check if there are ANY records with non-zero funnel metrics for Belmonte
SELECT 
  'campaign_summaries' as source,
  COUNT(*) as total_records,
  COUNT(CASE WHEN booking_step_1 > 0 THEN 1 END) as records_with_step1,
  COUNT(CASE WHEN booking_step_2 > 0 THEN 1 END) as records_with_step2,
  COUNT(CASE WHEN booking_step_3 > 0 THEN 1 END) as records_with_step3,
  COUNT(CASE WHEN reservations > 0 THEN 1 END) as records_with_reservations,
  MAX(booking_step_1) as max_step1,
  MAX(booking_step_2) as max_step2,
  MAX(booking_step_3) as max_step3,
  MAX(reservations) as max_reservations
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'google'
UNION ALL
SELECT 
  'google_ads_campaigns' as source,
  COUNT(*) as total_records,
  COUNT(CASE WHEN booking_step_1 > 0 THEN 1 END) as records_with_step1,
  COUNT(CASE WHEN booking_step_2 > 0 THEN 1 END) as records_with_step2,
  COUNT(CASE WHEN booking_step_3 > 0 THEN 1 END) as records_with_step3,
  COUNT(CASE WHEN reservations > 0 THEN 1 END) as records_with_reservations,
  MAX(booking_step_1) as max_step1,
  MAX(booking_step_2) as max_step2,
  MAX(booking_step_3) as max_step3,
  MAX(reservations) as max_reservations
FROM google_ads_campaigns
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

