-- Check if data exists with exact parameters from the collection

-- The collection log shows it stored week 0 (2025-11-10) for Belmonte
-- Client ID: ab0b4c7e-2bf0-46bc-b455-b18ef6942baa
-- Platform: meta
-- Summary type: weekly
-- Summary date: 2025-11-10

-- 1. Check with exact parameters
SELECT 
  '1️⃣ EXACT MATCH CHECK' as check_step,
  cs.summary_date,
  cs.summary_type,
  cs.platform,
  cs.total_spend,
  cs.reservations,
  cs.booking_step_1,
  DATE(cs.created_at) as created_date,
  TO_CHAR(cs.created_at, 'HH24:MI:SS') as created_time
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND cs.summary_date = '2025-11-10';

-- 2. Check if ANY data exists for this client_id after 2025-09-01
SELECT 
  '2️⃣ ALL DATA AFTER 2025-09-01' as check_step,
  cs.summary_date,
  cs.summary_type,
  cs.platform,
  cs.total_spend,
  DATE(cs.created_at) as created_date
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_date > '2025-09-01'
ORDER BY cs.summary_date DESC
LIMIT 20;

-- 3. Check if there's data for 2025-11-10 for ANY client
SELECT 
  '3️⃣ 2025-11-10 FOR ANY CLIENT' as check_step,
  c.name as client_name,
  cs.summary_date,
  cs.summary_type,
  cs.platform,
  cs.total_spend
FROM campaign_summaries cs
JOIN clients c ON cs.client_id = c.id
WHERE cs.summary_date = '2025-11-10'
ORDER BY c.name, cs.platform;

-- 4. Check the most recent records created today (2025-11-18)
SELECT 
  '4️⃣ RECORDS CREATED TODAY' as check_step,
  c.name as client_name,
  cs.summary_date,
  cs.summary_type,
  cs.platform,
  cs.total_spend,
  TO_CHAR(cs.created_at, 'HH24:MI:SS') as created_time
FROM campaign_summaries cs
JOIN clients c ON cs.client_id = c.id
WHERE DATE(cs.created_at) = '2025-11-18'
  AND cs.summary_type = 'weekly'
ORDER BY cs.created_at DESC
LIMIT 30;



