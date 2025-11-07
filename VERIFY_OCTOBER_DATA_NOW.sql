-- Check if October 2025 data is NOW in the database after collection

-- 1. Check for October 2025 monthly data
SELECT 
  '1️⃣ OCTOBER MONTHLY DATA' as check,
  COUNT(*) as records,
  COALESCE(SUM(total_spend), 0) as total_spend,
  COALESCE(SUM(total_impressions), 0) as total_impressions,
  COALESCE(SUM(total_clicks), 0) as total_clicks,
  MAX(TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS')) as last_updated,
  MAX(data_source) as data_source
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'google'
  AND summary_type = 'monthly'
  AND summary_date >= '2025-10-01'
  AND summary_date <= '2025-10-31';

-- 2. If data exists, show details
SELECT 
  '2️⃣ OCTOBER DETAILS' as check,
  summary_date,
  total_spend,
  total_impressions,
  total_clicks,
  reservations,
  active_campaigns,
  data_source,
  TO_CHAR(last_updated, 'HH24:MI:SS') as time_saved
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'google'
  AND summary_type = 'monthly'
  AND summary_date >= '2025-10-01'
  AND summary_date <= '2025-10-31';

-- 3. Check ALL Google data for Belmonte (last 5 records)
SELECT 
  '3️⃣ ALL GOOGLE DATA (Recent)' as check,
  summary_type,
  summary_date,
  total_spend,
  total_impressions,
  data_source,
  TO_CHAR(last_updated, 'HH24:MI:SS') as time
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'google'
ORDER BY last_updated DESC
LIMIT 5;

