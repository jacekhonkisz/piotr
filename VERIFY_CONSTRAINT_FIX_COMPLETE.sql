-- Comprehensive verification of constraint fix for BOTH summary_types

-- 1. Check constraint is correct
SELECT
  '1️⃣ CONSTRAINT CHECK' as check,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'campaign_summaries'::regclass
  AND contype = 'u' -- unique constraints
  AND conname LIKE '%summary%';

-- 2. Verify WEEKLY summaries work for both platforms
SELECT 
  '2️⃣ WEEKLY - BOTH PLATFORMS' as check,
  TO_CHAR(summary_date, 'YYYY-MM') as month,
  summary_type,
  ARRAY_AGG(DISTINCT platform ORDER BY platform) as platforms,
  COUNT(*) as total_records,
  STRING_AGG(DISTINCT data_source, ', ' ORDER BY data_source) as data_sources
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'weekly'
GROUP BY TO_CHAR(summary_date, 'YYYY-MM'), summary_type
HAVING COUNT(DISTINCT platform) > 1
ORDER BY month DESC
LIMIT 5;

-- 3. Verify MONTHLY summaries work for both platforms
SELECT 
  '3️⃣ MONTHLY - BOTH PLATFORMS' as check,
  TO_CHAR(summary_date, 'YYYY-MM') as month,
  summary_type,
  ARRAY_AGG(DISTINCT platform ORDER BY platform) as platforms,
  COUNT(*) as total_records,
  STRING_AGG(DISTINCT data_source, ', ' ORDER BY data_source) as data_sources
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'monthly'
GROUP BY TO_CHAR(summary_date, 'YYYY-MM'), summary_type
HAVING COUNT(DISTINCT platform) > 1
ORDER BY month DESC
LIMIT 5;

-- 4. Check October 2025 current state (before inserting Google data)
SELECT 
  '4️⃣ OCTOBER 2025 CURRENT STATE' as check,
  summary_date,
  summary_type,
  platform,
  data_source,
  ROUND(total_spend::numeric, 2) as total_spend,
  active_campaigns
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_date >= '2025-10-01'
  AND summary_date <= '2025-10-31'
ORDER BY summary_type, platform;

-- 5. Summary by month showing both platforms
SELECT 
  '5️⃣ SUMMARY BY MONTH' as check,
  TO_CHAR(summary_date, 'YYYY-MM') as month,
  summary_type,
  platform,
  COUNT(*) as records,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_date >= '2025-09-01'
GROUP BY TO_CHAR(summary_date, 'YYYY-MM'), summary_type, platform
ORDER BY month DESC, summary_type, platform;

