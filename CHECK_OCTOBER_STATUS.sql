-- Comprehensive check for October 2025 data

-- 1. Check if October 2025 exists in campaign_summaries
SELECT 
  '1️⃣  OCTOBER IN DATABASE?' as check,
  COUNT(*) as count,
  COALESCE(MAX(total_spend), 0) as spend,
  COALESCE(MAX(total_impressions), 0) as impressions,
  MAX(TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS')) as last_updated,
  MAX(data_source) as data_source
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'google'
  AND summary_type = 'monthly'
  AND summary_date >= '2025-10-01'
  AND summary_date <= '2025-10-31';

-- 2. Show ALL Google Ads data for Belmonte
SELECT 
  '2️⃣  ALL GOOGLE DATA' as check,
  summary_type,
  summary_date,
  total_spend as spend,
  total_impressions as impressions,
  total_clicks as clicks,
  reservations,
  data_source,
  TO_CHAR(last_updated, 'HH24:MI:SS') as time
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'google'
ORDER BY last_updated DESC
LIMIT 5;

-- 3. Check if background collector is creating ANY Google data
SELECT 
  '3️⃣  RECENT GOOGLE DATA' as check,
  COUNT(*) as total_records,
  MIN(summary_date) as earliest_date,
  MAX(summary_date) as latest_date,
  SUM(total_spend) as total_spend
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'google'
  AND last_updated > NOW() - INTERVAL '10 minutes';

-- 4. Check current November cache (for comparison)
SELECT 
  '4️⃣  NOVEMBER CACHE' as check,
  period_id,
  (cache_data->>'stats')::jsonb->>'totalSpend' as cached_spend,
  (cache_data->>'stats')::jsonb->>'totalImpressions' as cached_impressions,
  TO_CHAR(last_updated, 'HH24:MI:SS') as time
FROM google_ads_current_month_cache
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
LIMIT 1;

-- 5. Check if October was EVER in the cache
SELECT 
  '5️⃣  OCTOBER CACHE HISTORY' as check,
  'Checking if October 2025 was cached...' as note;

-- Look for any October references
SELECT 
  period_id,
  (cache_data->>'stats')::jsonb->>'totalSpend' as spend,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated
FROM google_ads_current_month_cache
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND period_id = '2025-10'
LIMIT 1;

