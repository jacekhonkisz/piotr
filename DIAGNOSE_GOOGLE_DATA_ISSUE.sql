-- Comprehensive diagnostic for Google Ads data storage issue

-- 1. Check ALL Belmonte records with dates and platforms
SELECT 
  '1️⃣ ALL BELMONTE RECORDS' as check,
  TO_CHAR(summary_date, 'YYYY-MM') as month,
  summary_type,
  platform,
  data_source,
  ROUND(total_spend::numeric, 2) as spend,
  active_campaigns,
  COUNT(*) OVER (PARTITION BY TO_CHAR(summary_date, 'YYYY-MM'), platform) as records_per_month
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
ORDER BY summary_date DESC, platform
LIMIT 30;

-- 2. Check unique constraint violations
SELECT 
  '2️⃣ CHECK FOR DUPLICATES' as check,
  client_id,
  summary_type,
  summary_date,
  platform,
  COUNT(*) as count
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
GROUP BY client_id, summary_type, summary_date, platform
HAVING COUNT(*) > 1;

-- 3. Check October specifically
SELECT 
  '3️⃣ OCTOBER 2025 ALL PLATFORMS' as check,
  summary_date,
  summary_type,
  platform,
  data_source,
  total_spend,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_date >= '2025-10-01'
  AND summary_date <= '2025-10-31'
ORDER BY summary_date, platform;

-- 4. Count by platform and month
SELECT 
  '4️⃣ COUNTS BY PLATFORM' as check,
  TO_CHAR(summary_date, 'YYYY-MM') as month,
  platform,
  COUNT(*) as records,
  SUM(total_spend) as total_spend
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
GROUP BY TO_CHAR(summary_date, 'YYYY-MM'), platform
ORDER BY month DESC, platform;

-- 5. Check for September Google data (to see if ANY Google monthly data exists)
SELECT 
  '5️⃣ SEPTEMBER GOOGLE DATA' as check,
  summary_date,
  summary_type,
  platform,
  data_source,
  total_spend,
  active_campaigns
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'google'
  AND summary_date >= '2025-09-01'
  AND summary_date <= '2025-09-30'
ORDER BY summary_date;

