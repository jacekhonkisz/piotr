-- Check if October 2025 Google Ads data exists for Belmonte
-- This should be in campaign_summaries for fast loading

-- 1. Check monthly summaries for October 2025
SELECT 
  'MONTHLY OCTOBER DATA' as check_type,
  summary_date,
  platform,
  total_spend,
  total_impressions,
  total_clicks,
  reservations,
  last_updated
FROM campaign_summaries
WHERE email = 'belmonte@hotel.com'
  AND summary_type = 'monthly'
  AND platform = 'google'
  AND summary_date >= '2025-10-01'
  AND summary_date <= '2025-10-31';

-- 2. Check weekly summaries for October 2025  
SELECT 
  'WEEKLY OCTOBER DATA' as check_type,
  summary_date,
  platform,
  total_spend,
  total_impressions,
  total_clicks,
  reservations,
  last_updated
FROM campaign_summaries
WHERE email = 'belmonte@hotel.com'
  AND summary_type = 'weekly'
  AND platform = 'google'
  AND summary_date >= '2025-10-01'
  AND summary_date <= '2025-10-31'
ORDER BY summary_date DESC;

-- 3. Check what months DO exist for this client
SELECT 
  'AVAILABLE MONTHS' as check_type,
  LEFT(summary_date::text, 7) as month,
  summary_type,
  platform,
  COUNT(*) as record_count,
  SUM(total_spend) as total_spend
FROM campaign_summaries  
WHERE email = 'belmonte@hotel.com'
  AND platform = 'google'
GROUP BY LEFT(summary_date::text, 7), summary_type, platform
ORDER BY month DESC, summary_type;

-- 4. Check if data is still in current cache tables (not yet archived)
SELECT 
  '📦 CURRENT MONTH CACHE' as check_type,
  period_id,
  EXTRACT(EPOCH FROM (NOW() - last_updated)) / 3600 as hours_old,
  (cache_data->>'campaigns')::jsonb->>0->>'status' as first_campaign_status
FROM google_ads_current_month_cache
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND period_id = '2025-10'
LIMIT 1;

