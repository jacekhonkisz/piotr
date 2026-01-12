-- Check why December 2025 was archived with zeros instead of real data
-- The issue: December had data, but archival stored zeros

-- ============================================================================
-- 1. CHECK DECEMBER IN CAMPAIGN_SUMMARIES (WHAT WAS ARCHIVED)
-- ============================================================================
SELECT 
  '1️⃣ DECEMBER ARCHIVED DATA' as check_type,
  summary_date,
  platform,
  total_spend,
  total_impressions,
  total_clicks,
  reservations,
  data_source,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as archived_at,
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
FROM campaign_summaries
WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
  AND summary_date >= '2025-12-01'
  AND summary_date <= '2025-12-31'
  AND platform = 'google'
  AND summary_type = 'monthly';

-- ============================================================================
-- 2. CHECK IF DECEMBER CACHE STILL EXISTS (OR WAS IT DELETED AFTER ARCHIVAL?)
-- ============================================================================
SELECT 
  '2️⃣ DECEMBER CACHE (IF STILL EXISTS)' as check_type,
  period_id,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated,
  (cache_data->'stats'->>'totalSpend')::numeric as cached_spend,
  jsonb_array_length(COALESCE(cache_data->'campaigns', '[]'::jsonb)) as campaign_count,
  CASE 
    WHEN (cache_data->'stats'->>'totalSpend')::numeric = 0 THEN '❌ ZEROS'
    WHEN (cache_data->'stats'->>'totalSpend')::numeric > 0 THEN '✅ HAS DATA'
    ELSE '⚠️ NULL'
  END as data_status
FROM google_ads_current_month_cache
WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
  AND period_id = '2025-12';

-- ============================================================================
-- 3. CHECK DECEMBER CAMPAIGNS IN DATABASE (REAL DATA SOURCE)
-- ============================================================================
SELECT 
  '3️⃣ DECEMBER CAMPAIGNS IN DATABASE' as check_type,
  date_range_start,
  date_range_end,
  COUNT(*) as campaign_count,
  SUM(spend)::numeric as total_spend,
  SUM(impressions) as total_impressions,
  SUM(clicks) as total_clicks,
  SUM(reservations) as total_reservations,
  MAX(TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS')) as last_inserted
FROM google_ads_campaigns
WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
  AND date_range_start >= '2025-12-01'
  AND date_range_start <= '2025-12-31'
GROUP BY date_range_start, date_range_end
ORDER BY date_range_start DESC;

-- ============================================================================
-- 4. CHECK WHEN REFRESH TOKEN WAS ADDED/UPDATED
-- ============================================================================
SELECT 
  '4️⃣ REFRESH TOKEN STATUS' as check_type,
  CASE 
    WHEN google_ads_refresh_token IS NOT NULL THEN '✅ Token exists'
    ELSE '❌ No token'
  END as token_status,
  LENGTH(google_ads_refresh_token) as token_length,
  TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') as last_updated
FROM clients
WHERE id = '93d46876-addc-4b99-b1e1-437428dd54f1';

-- ============================================================================
-- 5. CHECK DECEMBER DAILY KPI DATA (IF AVAILABLE)
-- ============================================================================
SELECT 
  '5️⃣ DECEMBER DAILY KPI DATA' as check_type,
  COUNT(DISTINCT date) as days_with_data,
  SUM(total_spend)::numeric as total_spend,
  SUM(total_impressions) as total_impressions,
  SUM(reservations) as total_reservations,
  MIN(date) as first_date,
  MAX(date) as last_date
FROM daily_kpi_data
WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
  AND date >= '2025-12-01'
  AND date <= '2025-12-31'
  AND platform = 'google';

-- ============================================================================
-- 6. COMPARE WITH META DECEMBER (WORKING CORRECTLY)
-- ============================================================================
SELECT 
  '6️⃣ META DECEMBER (COMPARISON)' as check_type,
  summary_date,
  platform,
  total_spend,
  total_impressions,
  reservations,
  data_source,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as archived_at
FROM campaign_summaries
WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
  AND summary_date >= '2025-12-01'
  AND summary_date <= '2025-12-31'
  AND platform = 'meta'
  AND summary_type = 'monthly';

-- ============================================================================
-- 7. DIAGNOSIS - WHY DECEMBER WAS ARCHIVED WITH ZEROS
-- ============================================================================
SELECT 
  '7️⃣ DIAGNOSIS' as check_type,
  CASE 
    -- Check if December cache had zeros when archived
    WHEN (SELECT (cache_data->'stats'->>'totalSpend')::numeric FROM google_ads_current_month_cache 
          WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
            AND period_id = '2025-12'
          ORDER BY last_updated DESC LIMIT 1) = 0
      THEN '❌ DECEMBER CACHE HAD ZEROS - Archival job archived zeros on Jan 1st'
    
    -- Check if December campaigns exist in database
    WHEN (SELECT SUM(spend) FROM google_ads_campaigns 
          WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
            AND date_range_start >= '2025-12-01'
            AND date_range_start <= '2025-12-31') > 0
      THEN '✅ DECEMBER DATA EXISTS IN DATABASE - Can be backfilled to campaign_summaries'
    
    -- Check if cache was never refreshed after token was added
    WHEN (SELECT MAX(last_updated) FROM google_ads_current_month_cache 
          WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
            AND period_id = '2025-12') < '2025-12-31 23:00:00'
      THEN '⚠️ DECEMBER CACHE NOT REFRESHED AT END OF MONTH - Token may have been added too late'
    
    ELSE '✅ Need to investigate further'
  END as diagnosis,
  (SELECT (cache_data->'stats'->>'totalSpend')::numeric FROM google_ads_current_month_cache 
   WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
     AND period_id = '2025-12'
   ORDER BY last_updated DESC LIMIT 1) as december_cache_spend,
  (SELECT SUM(spend) FROM google_ads_campaigns 
   WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
     AND date_range_start >= '2025-12-01'
     AND date_range_start <= '2025-12-31')::numeric as december_db_spend,
  (SELECT total_spend FROM campaign_summaries 
   WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
     AND summary_date = '2025-12-01'
     AND platform = 'google'
     AND summary_type = 'monthly')::numeric as december_archived_spend;

