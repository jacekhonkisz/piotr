-- Verify if October 2025 was actually archived to campaign_summaries

-- Check if October 2025 monthly data exists for Belmonte
SELECT 
  '✅ OCTOBER IN DATABASE' as status,
  summary_type,
  summary_date,
  platform,
  total_spend as spend,
  total_impressions as impressions,
  total_clicks as clicks,
  reservations,
  data_source,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'google'
  AND summary_type = 'monthly'
  AND summary_date >= '2025-10-01'
  AND summary_date <= '2025-10-31'
ORDER BY summary_date DESC;

-- If no results, check what data DOES exist for Belmonte + Google
SELECT 
  '📅 AVAILABLE DATA' as info,
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

-- Check if October data still exists in the cache (should have been cleaned up)
SELECT 
  '🔍 CACHE CHECK' as info,
  period_id,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as cache_last_updated
FROM google_ads_current_month_cache
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND period_id = '2025-10'
LIMIT 1;

