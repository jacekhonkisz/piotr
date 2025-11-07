-- ========================================
-- AUDIT ALL CLIENTS DATA COVERAGE
-- ========================================

-- 1️⃣ ALL CLIENTS OVERVIEW
SELECT 
  '1️⃣ ALL CLIENTS' as check,
  id,
  name,
  email,
  CASE WHEN meta_access_token IS NOT NULL THEN '✅' ELSE '❌' END as has_meta_token,
  CASE WHEN google_ads_customer_id IS NOT NULL THEN '✅' ELSE '❌' END as has_google_ads,
  created_at::date as created_date
FROM clients
ORDER BY name;

-- 2️⃣ RECORD COUNTS BY CLIENT AND PLATFORM
SELECT 
  '2️⃣ RECORDS BY CLIENT & PLATFORM' as check,
  c.name as client_name,
  cs.platform,
  cs.summary_type,
  COUNT(*) as records,
  MIN(cs.summary_date) as earliest_date,
  MAX(cs.summary_date) as latest_date,
  ROUND(SUM(cs.total_spend)::numeric, 2) as total_spend
FROM clients c
LEFT JOIN campaign_summaries cs ON c.id = cs.client_id
WHERE cs.client_id IS NOT NULL
GROUP BY c.name, cs.platform, cs.summary_type
ORDER BY c.name, cs.platform, cs.summary_type;

-- 3️⃣ CLIENTS WITH NO DATA
SELECT 
  '3️⃣ CLIENTS WITH NO DATA' as check,
  c.name,
  c.email,
  c.created_at::date as created,
  CASE WHEN c.meta_access_token IS NOT NULL THEN '✅ Has Meta' ELSE '❌ No Meta' END as meta_status,
  CASE WHEN c.google_ads_customer_id IS NOT NULL THEN '✅ Has Google' ELSE '❌ No Google' END as google_status
FROM clients c
LEFT JOIN campaign_summaries cs ON c.id = cs.client_id
WHERE cs.client_id IS NULL
ORDER BY c.name;

-- 4️⃣ TOTAL RECORDS PER CLIENT (SUMMARY)
SELECT 
  '4️⃣ TOTAL RECORDS PER CLIENT' as check,
  c.name as client_name,
  COUNT(cs.id) as total_records,
  COUNT(DISTINCT CASE WHEN cs.platform = 'meta' THEN cs.id END) as meta_records,
  COUNT(DISTINCT CASE WHEN cs.platform = 'google' THEN cs.id END) as google_records,
  COUNT(DISTINCT CASE WHEN cs.summary_type = 'weekly' THEN cs.id END) as weekly_records,
  COUNT(DISTINCT CASE WHEN cs.summary_type = 'monthly' THEN cs.id END) as monthly_records
FROM clients c
LEFT JOIN campaign_summaries cs ON c.id = cs.client_id
GROUP BY c.name
ORDER BY total_records DESC;

-- 5️⃣ DATA SOURCE VALIDATION (ALL CLIENTS)
SELECT 
  '5️⃣ DATA SOURCES VALIDATION' as check,
  c.name as client_name,
  cs.platform,
  cs.data_source,
  COUNT(*) as records,
  CASE 
    WHEN cs.platform = 'meta' AND cs.data_source IN ('meta_api', 'smart_cache_archive') THEN '✅'
    WHEN cs.platform = 'google' AND cs.data_source IN ('google_ads_api', 'google_ads_smart_cache_archive') THEN '✅'
    ELSE '⚠️'
  END as status
FROM clients c
JOIN campaign_summaries cs ON c.id = cs.client_id
GROUP BY c.name, cs.platform, cs.data_source
ORDER BY c.name, cs.platform, cs.data_source;

-- 6️⃣ WEEKLY COVERAGE BY CLIENT
SELECT 
  '6️⃣ WEEKLY COVERAGE' as check,
  c.name as client_name,
  cs.platform,
  COUNT(*) as weekly_records,
  MIN(cs.summary_date) as earliest_week,
  MAX(cs.summary_date) as latest_week,
  ROUND(EXTRACT(EPOCH FROM (MAX(cs.summary_date::timestamp) - MIN(cs.summary_date::timestamp))) / 604800) as weeks_span
FROM clients c
JOIN campaign_summaries cs ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
GROUP BY c.name, cs.platform
ORDER BY c.name, cs.platform;

-- 7️⃣ MONTHLY COVERAGE BY CLIENT
SELECT 
  '7️⃣ MONTHLY COVERAGE' as check,
  c.name as client_name,
  cs.platform,
  COUNT(*) as monthly_records,
  MIN(cs.summary_date) as earliest_month,
  MAX(cs.summary_date) as latest_month,
  ROUND(EXTRACT(EPOCH FROM (MAX(cs.summary_date::timestamp) - MIN(cs.summary_date::timestamp))) / 2592000) as months_span
FROM clients c
JOIN campaign_summaries cs ON c.id = cs.client_id
WHERE cs.summary_type = 'monthly'
GROUP BY c.name, cs.platform
ORDER BY c.name, cs.platform;

-- 8️⃣ OVERALL DATABASE SUMMARY
SELECT 
  '8️⃣ DATABASE SUMMARY' as check,
  COUNT(DISTINCT c.id) as total_clients,
  COUNT(DISTINCT cs.client_id) as clients_with_data,
  COUNT(cs.id) as total_records,
  COUNT(DISTINCT CASE WHEN cs.platform = 'meta' THEN cs.id END) as meta_records,
  COUNT(DISTINCT CASE WHEN cs.platform = 'google' THEN cs.id END) as google_records,
  COUNT(DISTINCT CASE WHEN cs.summary_type = 'weekly' THEN cs.id END) as weekly_records,
  COUNT(DISTINCT CASE WHEN cs.summary_type = 'monthly' THEN cs.id END) as monthly_records
FROM clients c
LEFT JOIN campaign_summaries cs ON c.id = cs.client_id;

-- 9️⃣ DATA QUALITY CHECK
SELECT 
  '9️⃣ DATA QUALITY' as check,
  COUNT(*) as total_records,
  SUM(CASE WHEN (
    (platform = 'meta' AND data_source IN ('meta_api', 'smart_cache_archive')) OR
    (platform = 'google' AND data_source IN ('google_ads_api', 'google_ads_smart_cache_archive'))
  ) THEN 1 ELSE 0 END) as correct_sources,
  SUM(CASE WHEN NOT (
    (platform = 'meta' AND data_source IN ('meta_api', 'smart_cache_archive')) OR
    (platform = 'google' AND data_source IN ('google_ads_api', 'google_ads_smart_cache_archive'))
  ) THEN 1 ELSE 0 END) as incorrect_sources,
  SUM(CASE WHEN total_spend > 0 THEN 1 ELSE 0 END) as records_with_spend,
  SUM(CASE WHEN total_spend = 0 THEN 1 ELSE 0 END) as records_zero_spend
FROM campaign_summaries;

-- 🔟 RECENT ACTIVITY (LAST 7 DAYS)
SELECT 
  '🔟 RECENT ACTIVITY (Last 7 Days)' as check,
  c.name as client_name,
  cs.platform,
  cs.summary_type,
  COUNT(*) as new_records,
  MAX(cs.last_updated) as last_update
FROM clients c
JOIN campaign_summaries cs ON c.id = cs.client_id
WHERE cs.last_updated >= NOW() - INTERVAL '7 days'
GROUP BY c.name, cs.platform, cs.summary_type
ORDER BY last_update DESC;

