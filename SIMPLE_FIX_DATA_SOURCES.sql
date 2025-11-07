-- ========================================
-- SIMPLE DATA SOURCE FIX
-- Safe to run - ONLY updates data, NO schema changes
-- ========================================

-- Step 1: See what needs fixing
SELECT 
  platform,
  data_source,
  COUNT(*) as records
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'meta'
  AND data_source NOT IN ('meta_api', 'smart_cache_archive')
GROUP BY platform, data_source;

-- Step 2: Fix them (change "historical" and "smart" to "meta_api")
UPDATE campaign_summaries
SET data_source = 'meta_api'
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'meta'
  AND data_source IN ('historical', 'smart', 'standardized_coverage');

-- Step 3: Verify it worked
SELECT 
  platform,
  data_source,
  COUNT(*) as records,
  CASE 
    WHEN platform = 'meta' AND data_source = 'meta_api' THEN '✅'
    WHEN platform = 'google' AND data_source = 'google_ads_api' THEN '✅'
    ELSE '⚠️'
  END as status
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
GROUP BY platform, data_source
ORDER BY platform, data_source;

