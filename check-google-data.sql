-- Quick check for Google Ads data in cache and database

-- 1. Check current month cache
SELECT 
  '📦 CURRENT MONTH CACHE' as check_type,
  client_id,
  period_id,
  (cache_data->'stats'->>'totalSpend')::numeric as spend,
  (cache_data->'stats'->>'totalImpressions')::numeric as impressions,
  (cache_data->'conversionMetrics'->>'booking_step_1')::numeric as step1,
  (cache_data->'conversionMetrics'->>'booking_step_2')::numeric as step2,
  (cache_data->'conversionMetrics'->>'booking_step_3')::numeric as step3,
  (cache_data->'conversionMetrics'->>'reservations')::numeric as reservations,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated
FROM google_ads_current_month_cache
WHERE period_id = '2025-01'
ORDER BY last_updated DESC
LIMIT 5;

-- 2. Check campaign_summaries (stored data)
SELECT 
  '💾 CAMPAIGN SUMMARIES' as check_type,
  summary_type,
  summary_date,
  total_spend as spend,
  total_impressions as impressions,
  booking_step_1 as step1,
  booking_step_2 as step2,
  booking_step_3 as step3,
  reservations,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated
FROM campaign_summaries
WHERE platform = 'google'
  AND summary_date >= '2025-01-01'
ORDER BY last_updated DESC
LIMIT 5;

-- 3. Check daily_kpi_data (live data)
SELECT 
  '📊 DAILY KPI DATA' as check_type,
  date,
  SUM(booking_step_1) as step1,
  SUM(booking_step_2) as step2,
  SUM(booking_step_3) as step3,
  SUM(reservations) as reservations,
  SUM(reservation_value) as res_value
FROM daily_kpi_data
WHERE platform = 'google'
  AND date >= '2025-01-01'
GROUP BY date
ORDER BY date DESC
LIMIT 5;
