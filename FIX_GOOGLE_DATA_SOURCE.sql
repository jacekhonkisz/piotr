-- FIX: Update all existing Google Ads records to have correct data_source

-- 1. Show current state (BEFORE fix)
SELECT 
  '1️⃣ BEFORE FIX' as check,
  platform,
  data_source,
  COUNT(*) as records,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
GROUP BY platform, data_source
ORDER BY platform, data_source;

-- 2. UPDATE all Google platform records to have correct data_source
UPDATE campaign_summaries
SET 
  data_source = 'google_ads_api',
  last_updated = NOW()
WHERE platform = 'google'
  AND data_source != 'google_ads_api';

-- 3. Show updated state (AFTER fix)
SELECT 
  '2️⃣ AFTER FIX' as check,
  platform,
  data_source,
  COUNT(*) as records,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
GROUP BY platform, data_source
ORDER BY platform, data_source;

-- 4. Verify Google data now has correct source
SELECT 
  '3️⃣ VERIFY GOOGLE DATA' as check,
  TO_CHAR(summary_date, 'YYYY-MM') as month,
  summary_type,
  platform,
  data_source,
  COUNT(*) as records,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'google'
GROUP BY TO_CHAR(summary_date, 'YYYY-MM'), summary_type, platform, data_source
ORDER BY month DESC, summary_type;

-- 5. Check for any remaining mixed data sources
SELECT 
  '4️⃣ CHECK FOR MIXED SOURCES' as check,
  platform,
  data_source,
  COUNT(*) as records,
  ARRAY_AGG(DISTINCT TO_CHAR(summary_date, 'YYYY-MM')) as months
FROM campaign_summaries
GROUP BY platform, data_source
HAVING platform != data_source 
  AND NOT (
    (platform = 'google' AND data_source = 'google_ads_api') OR
    (platform = 'google' AND data_source = 'google_ads_smart_cache_archive') OR
    (platform = 'meta' AND data_source = 'meta_api') OR
    (platform = 'meta' AND data_source = 'smart_cache_archive')
  )
ORDER BY platform, data_source;

