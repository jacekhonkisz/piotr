-- ============================================================================
-- VERIFICATION SCRIPT: Platform Separation Audit
-- ============================================================================
-- Purpose: Verify Meta and Google data are properly separated
-- ============================================================================

-- 1️⃣ Campaign Summaries Platform Distribution
SELECT 
  '1. Campaign Summaries by Platform' as check_name,
  platform,
  summary_type,
  COUNT(*) as record_count,
  COUNT(DISTINCT client_id) as client_count,
  MIN(summary_date) as earliest_date,
  MAX(summary_date) as latest_date,
  SUM(total_spend)::numeric(12,2) as total_spend
FROM campaign_summaries
GROUP BY platform, summary_type
ORDER BY platform, summary_type;

-- 2️⃣ Daily KPI Data Platform Distribution
SELECT 
  '2. Daily KPI Data by Platform' as check_name,
  platform,
  COUNT(*) as record_count,
  COUNT(DISTINCT client_id) as client_count,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  SUM(total_spend)::numeric(12,2) as total_spend
FROM daily_kpi_data
GROUP BY platform
ORDER BY platform;

-- 3️⃣ Check for NULL platforms (should be 0)
SELECT 
  '3. NULL Platform Check' as check_name,
  'campaign_summaries' as table_name,
  COUNT(*) as null_platform_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ PASS'
    ELSE '❌ FAIL - NULL platforms found'
  END as status
FROM campaign_summaries
WHERE platform IS NULL

UNION ALL

SELECT 
  '3. NULL Platform Check' as check_name,
  'daily_kpi_data' as table_name,
  COUNT(*) as null_platform_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ PASS'
    ELSE '❌ FAIL - NULL platforms found'
  END as status
FROM daily_kpi_data
WHERE platform IS NULL;

-- 4️⃣ Clients using both platforms
SELECT 
  '4. Dual-Platform Clients' as check_name,
  c.name as client_name,
  COUNT(DISTINCT cs.platform) as platforms_count,
  ARRAY_AGG(DISTINCT cs.platform) as platforms_used,
  c.google_ads_enabled,
  CASE 
    WHEN c.meta_access_token IS NOT NULL THEN 'Yes'
    ELSE 'No'
  END as has_meta_token
FROM clients c
LEFT JOIN campaign_summaries cs ON cs.client_id = c.id
WHERE c.active = true
GROUP BY c.id, c.name, c.google_ads_enabled, c.meta_access_token
HAVING COUNT(DISTINCT cs.platform) > 0
ORDER BY platforms_count DESC, c.name;

-- 5️⃣ Check for platform value inconsistencies
SELECT 
  '5. Platform Value Consistency' as check_name,
  DISTINCT platform as platform_value,
  COUNT(*) as usage_count,
  CASE 
    WHEN platform IN ('meta', 'google') THEN '✅ VALID'
    ELSE '⚠️ INVALID VALUE'
  END as validation_status
FROM (
  SELECT platform FROM campaign_summaries
  UNION ALL
  SELECT platform FROM daily_kpi_data
) all_platforms
GROUP BY platform
ORDER BY usage_count DESC;

-- 6️⃣ Recent collections by platform (last 7 days)
SELECT 
  '6. Recent Collections (7 days)' as check_name,
  platform,
  COUNT(*) as records_added,
  COUNT(DISTINCT client_id) as clients_affected,
  MAX(last_updated) as most_recent_update,
  AGE(NOW(), MAX(last_updated)) as time_since_last
FROM campaign_summaries
WHERE last_updated >= NOW() - INTERVAL '7 days'
GROUP BY platform;



