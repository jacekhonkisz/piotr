-- Fix legacy data source names for Meta records

-- 1. Show current incorrect sources
SELECT 
  '1️⃣ BEFORE FIX - INCORRECT SOURCES' as check,
  platform,
  data_source,
  COUNT(*) as records
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'meta'
  AND data_source NOT IN ('meta_api', 'smart_cache_archive')
GROUP BY platform, data_source;

-- 2. Fix 'historical' and 'smart' to 'meta_api'
UPDATE campaign_summaries
SET 
  data_source = CASE
    WHEN data_source LIKE '%archive%' THEN data_source  -- Keep archive sources
    ELSE 'meta_api'  -- Fix everything else to meta_api
  END,
  last_updated = NOW()
WHERE platform = 'meta'
  AND data_source NOT IN ('meta_api', 'smart_cache_archive')
  AND data_source NOT LIKE '%archive%';

-- 3. Verify fix
SELECT 
  '2️⃣ AFTER FIX - ALL SOURCES' as check,
  platform,
  data_source,
  COUNT(*) as records,
  CASE 
    WHEN platform = 'meta' AND data_source IN ('meta_api', 'smart_cache_archive') THEN '✅ Correct'
    WHEN platform = 'google' AND data_source IN ('google_ads_api', 'google_ads_smart_cache_archive') THEN '✅ Correct'
    ELSE '⚠️ Check'
  END as status
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
GROUP BY platform, data_source
ORDER BY platform, data_source;

-- 4. Final verification
SELECT 
  '3️⃣ FINAL CHECK' as check,
  COUNT(*) as total_records,
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

