-- ========================================
-- FIX DATA SOURCES FOR ALL CLIENTS
-- ========================================
-- Fixes legacy data source names across ALL clients
-- Safe to run multiple times

-- 1️⃣ SHOW CURRENT INCORRECT SOURCES
SELECT 
  '1️⃣ INCORRECT SOURCES (Before Fix)' as check,
  platform,
  data_source,
  COUNT(*) as records,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend
FROM campaign_summaries
WHERE data_source NOT IN ('meta_api', 'google_ads_api', 'smart_cache_archive', 'google_ads_smart_cache_archive')
GROUP BY platform, data_source
ORDER BY platform, data_source;

-- 2️⃣ FIX META DATA SOURCES
UPDATE campaign_summaries
SET 
  data_source = 'meta_api',
  last_updated = NOW()
WHERE platform = 'meta'
  AND data_source NOT IN ('meta_api', 'smart_cache_archive')
  AND data_source NOT LIKE '%archive%';

-- 3️⃣ FIX GOOGLE DATA SOURCES  
UPDATE campaign_summaries
SET 
  data_source = 'google_ads_api',
  last_updated = NOW()
WHERE platform = 'google'
  AND data_source NOT IN ('google_ads_api', 'google_ads_smart_cache_archive')
  AND data_source NOT LIKE '%archive%';

-- 4️⃣ VERIFY ALL SOURCES ARE NOW CORRECT
SELECT 
  '2️⃣ ALL SOURCES (After Fix)' as check,
  platform,
  data_source,
  COUNT(*) as records,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend,
  CASE 
    WHEN platform = 'meta' AND data_source IN ('meta_api', 'smart_cache_archive') THEN '✅ Correct'
    WHEN platform = 'google' AND data_source IN ('google_ads_api', 'google_ads_smart_cache_archive') THEN '✅ Correct'
    ELSE '⚠️ Needs Review'
  END as status
FROM campaign_summaries
GROUP BY platform, data_source
ORDER BY platform, data_source;

-- 5️⃣ FINAL SUMMARY
SELECT 
  '3️⃣ FINAL SUMMARY' as check,
  COUNT(*) as total_records,
  COUNT(DISTINCT client_id) as clients,
  COUNT(DISTINCT platform) as platforms,
  SUM(CASE WHEN (
    (platform = 'meta' AND data_source IN ('meta_api', 'smart_cache_archive')) OR
    (platform = 'google' AND data_source IN ('google_ads_api', 'google_ads_smart_cache_archive'))
  ) THEN 1 ELSE 0 END) as correct_sources,
  SUM(CASE WHEN NOT (
    (platform = 'meta' AND data_source IN ('meta_api', 'smart_cache_archive')) OR
    (platform = 'google' AND data_source IN ('google_ads_api', 'google_ads_smart_cache_archive'))
  ) THEN 1 ELSE 0 END) as incorrect_sources
FROM campaign_summaries;

-- 6️⃣ CLIENTS AFFECTED
SELECT 
  '4️⃣ CLIENTS UPDATED' as check,
  c.name as client_name,
  COUNT(cs.id) as total_records,
  SUM(CASE WHEN cs.platform = 'meta' THEN 1 ELSE 0 END) as meta_records,
  SUM(CASE WHEN cs.platform = 'google' THEN 1 ELSE 0 END) as google_records
FROM clients c
JOIN campaign_summaries cs ON c.id = cs.client_id
GROUP BY c.name
ORDER BY total_records DESC;

