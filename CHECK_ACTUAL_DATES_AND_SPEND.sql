-- Check what dates are being used and if there's actual spend data

-- ============================================================================
-- 1. CHECK WHAT DATES ARE IN THE CAMPAIGNS TABLE
-- ============================================================================
SELECT 
  '1️⃣ CAMPAIGNS TABLE DATES' as check_type,
  date_range_start,
  date_range_end,
  COUNT(*) as campaign_count,
  SUM(spend)::numeric as total_spend,
  SUM(impressions) as total_impressions,
  MAX(TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS')) as last_inserted
FROM google_ads_campaigns
WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
GROUP BY date_range_start, date_range_end
ORDER BY date_range_start DESC
LIMIT 10;

-- ============================================================================
-- 2. CHECK JANUARY 2026 CAMPAIGNS SPECIFICALLY
-- ============================================================================
SELECT 
  '2️⃣ JANUARY 2026 CAMPAIGNS' as check_type,
  date_range_start,
  date_range_end,
  COUNT(*) as campaign_count,
  SUM(spend)::numeric as total_spend,
  SUM(impressions) as total_impressions,
  COUNT(CASE WHEN spend > 0 THEN 1 END) as campaigns_with_spend
FROM google_ads_campaigns
WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
  AND date_range_start >= '2026-01-01'
  AND date_range_start <= '2026-01-31'
GROUP BY date_range_start, date_range_end;

-- ============================================================================
-- 3. CHECK DECEMBER 2025 (FOR COMPARISON - SHOULD HAVE DATA)
-- ============================================================================
SELECT 
  '3️⃣ DECEMBER 2025 CAMPAIGNS (COMPARISON)' as check_type,
  date_range_start,
  date_range_end,
  COUNT(*) as campaign_count,
  SUM(spend)::numeric as total_spend,
  SUM(impressions) as total_impressions,
  COUNT(CASE WHEN spend > 0 THEN 1 END) as campaigns_with_spend
FROM google_ads_campaigns
WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
  AND date_range_start >= '2025-12-01'
  AND date_range_start <= '2025-12-31'
GROUP BY date_range_start, date_range_end
ORDER BY date_range_start DESC;

-- ============================================================================
-- 4. CHECK MOST RECENT CAMPAIGNS INSERTED
-- ============================================================================
SELECT 
  '4️⃣ MOST RECENT CAMPAIGNS' as check_type,
  campaign_name,
  date_range_start,
  date_range_end,
  spend,
  impressions,
  clicks,
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
FROM google_ads_campaigns
WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- 5. DIAGNOSIS - WHY ZEROS?
-- ============================================================================
SELECT 
  '5️⃣ DIAGNOSIS' as check_type,
  CASE 
    -- Check if January campaigns exist in database
    WHEN (SELECT COUNT(*) FROM google_ads_campaigns 
          WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
            AND date_range_start >= '2026-01-01'
            AND date_range_start <= '2026-01-31') = 0
      THEN '❌ NO JANUARY CAMPAIGNS IN DATABASE - API may not be saving campaigns'
    
    -- Check if January campaigns have spend
    WHEN (SELECT SUM(spend) FROM google_ads_campaigns 
          WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
            AND date_range_start >= '2026-01-01'
            AND date_range_start <= '2026-01-31') = 0
      THEN '⚠️ JANUARY CAMPAIGNS EXIST BUT ALL HAVE $0 SPEND - No activity yet in January'
    
    -- Check if December has data (for comparison)
    WHEN (SELECT SUM(spend) FROM google_ads_campaigns 
          WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
            AND date_range_start >= '2025-12-01'
            AND date_range_start <= '2025-12-31') > 0
      THEN '✅ DECEMBER HAS DATA - January likely has no spend yet (only 2 days into month)'
    
    ELSE '✅ Configuration looks correct'
  END as diagnosis,
  (SELECT COUNT(*) FROM google_ads_campaigns 
   WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
     AND date_range_start >= '2026-01-01'
     AND date_range_start <= '2026-01-31') as january_campaigns_in_db,
  (SELECT SUM(spend) FROM google_ads_campaigns 
   WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
     AND date_range_start >= '2026-01-01'
     AND date_range_start <= '2026-01-31')::numeric as january_total_spend,
  (SELECT SUM(spend) FROM google_ads_campaigns 
   WHERE client_id = '93d46876-addc-4b99-b1e1-437428dd54f1'
     AND date_range_start >= '2025-12-01'
     AND date_range_start <= '2025-12-31')::numeric as december_total_spend;

