-- Fix legacy data source names for Meta records
-- SAFE to run multiple times - only updates data, not schema

-- 1. Show current incorrect sources
SELECT 
  '1️⃣ CURRENT STATE - Data Sources by Platform' as check,
  platform,
  data_source,
  COUNT(*) as records,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
GROUP BY platform, data_source
ORDER BY platform, data_source;

-- 2. Show which ones need fixing
SELECT 
  '2️⃣ RECORDS THAT NEED FIXING' as check,
  platform,
  data_source,
  COUNT(*) as records_to_fix
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'meta'
  AND data_source NOT IN ('meta_api', 'smart_cache_archive')
  AND data_source NOT LIKE '%archive%'
GROUP BY platform, data_source;

-- 3. Fix incorrect Meta data sources
UPDATE campaign_summaries
SET 
  data_source = 'meta_api',
  last_updated = NOW()
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'meta'
  AND data_source NOT IN ('meta_api', 'smart_cache_archive')
  AND data_source NOT LIKE '%archive%';

-- 4. Verify all sources are now correct
SELECT 
  '3️⃣ AFTER FIX - All Sources' as check,
  platform,
  data_source,
  COUNT(*) as records,
  CASE 
    WHEN platform = 'meta' AND data_source IN ('meta_api', 'smart_cache_archive') THEN '✅ Correct'
    WHEN platform = 'google' AND data_source IN ('google_ads_api', 'google_ads_smart_cache_archive') THEN '✅ Correct'
    ELSE '⚠️ Needs Review'
  END as status
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
GROUP BY platform, data_source
ORDER BY platform, data_source;

-- 5. Final summary
SELECT 
  '4️⃣ SUMMARY' as check,
  COUNT(*) as total_records,
  COUNT(DISTINCT platform) as platforms,
  SUM(CASE WHEN (
    (platform = 'meta' AND data_source IN ('meta_api', 'smart_cache_archive')) OR
    (platform = 'google' AND data_source IN ('google_ads_api', 'google_ads_smart_cache_archive'))
  ) THEN 1 ELSE 0 END) as correct_sources,
  SUM(CASE WHEN NOT (
    (platform = 'meta' AND data_source IN ('meta_api', 'smart_cache_archive')) OR
    (platform = 'google' AND data_source IN ('google_ads_api', 'google_ads_smart_cache_archive'))
  ) THEN 1 ELSE 0 END) as incorrect_sources
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

