-- Check specifically for the missing November 2025 weeks

-- Weeks that should exist but are missing:
-- 2025-10-27 (Week 2)
-- 2025-11-03 (Week 1)  
-- 2025-11-10 (Week 0)

-- 1. Check if they exist with exact dates
SELECT 
  '1️⃣ CHECK MISSING WEEKS' as check_step,
  cs.summary_date,
  cs.total_spend,
  cs.reservations,
  DATE(cs.created_at) as created_date
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND cs.summary_date IN ('2025-10-27', '2025-11-03', '2025-11-10')
ORDER BY cs.summary_date;

-- 2. Check if there are any records with dates close to these (typo check)
SELECT 
  '2️⃣ CHECK FOR TYPOS/CLOSE DATES' as check_step,
  cs.summary_date,
  cs.total_spend,
  DATE(cs.created_at) as created_date
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND (
    cs.summary_date BETWEEN '2025-10-25' AND '2025-10-29' OR
    cs.summary_date BETWEEN '2025-11-01' AND '2025-11-05' OR
    cs.summary_date BETWEEN '2025-11-08' AND '2025-11-12'
  )
ORDER BY cs.summary_date;

-- 3. Check the latest date in database vs what should be there
SELECT 
  '3️⃣ DATE RANGE CHECK' as check_step,
  MIN(cs.summary_date) as earliest_date,
  MAX(cs.summary_date) as latest_date,
  COUNT(*) as total_records,
  CASE 
    WHEN MAX(cs.summary_date) >= '2025-11-10' THEN '✅ Has recent weeks'
    WHEN MAX(cs.summary_date) >= '2025-10-01' THEN '⚠️ Missing November weeks'
    ELSE '❌ Missing many weeks'
  END as status
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta';



