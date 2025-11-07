-- Test if we can manually insert October 2025 Google Ads data

-- 1. Try to insert a test October record
INSERT INTO campaign_summaries (
  client_id,
  summary_type,
  summary_date,
  platform,
  total_spend,
  total_impressions,
  total_clicks,
  total_conversions,
  active_campaigns,
  data_source,
  last_updated
) VALUES (
  'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa',
  'monthly',
  '2025-10-01',
  'google',
  4530.78,
  1477,
  144,
  78,
  16,
  'google_ads_api',
  NOW()
) ON CONFLICT (client_id, summary_type, summary_date, platform) 
DO UPDATE SET 
  total_spend = EXCLUDED.total_spend,
  total_impressions = EXCLUDED.total_impressions,
  total_clicks = EXCLUDED.total_clicks,
  total_conversions = EXCLUDED.total_conversions,
  active_campaigns = EXCLUDED.active_campaigns,
  data_source = EXCLUDED.data_source,
  last_updated = EXCLUDED.last_updated
RETURNING *;

-- 2. Verify the insert
SELECT 
  '✅ MANUAL INSERT SUCCESS' as result,
  summary_date,
  platform,
  total_spend,
  data_source,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_date = '2025-10-01'
  AND platform = 'google';

