-- Check what's currently in the Google Ads caches

-- 1. Check monthly cache
SELECT 
  '📅 MONTHLY CACHE' as cache_type,
  period_id,
  client_id,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated,
  (cache_data->>'stats')::jsonb->'totalSpend' as spend
FROM google_ads_current_month_cache
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
ORDER BY period_id DESC;

-- 2. Check weekly cache
SELECT 
  '📅 WEEKLY CACHE' as cache_type,
  period_id,
  client_id,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated,
  (cache_data->>'stats')::jsonb->'totalSpend' as spend
FROM google_ads_current_week_cache
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
ORDER BY period_id DESC
LIMIT 5;

-- 3. Check what's in campaign_summaries for Google
SELECT 
  '💾 DATABASE' as source,
  summary_type,
  summary_date,
  platform,
  total_spend as spend,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'google'
ORDER BY summary_date DESC
LIMIT 10;

