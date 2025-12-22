-- Check if November 2025 data exists for ANY client or platform

-- 1. Check ALL data for 2025-11-10 (the week we're looking for)
SELECT 
  '1️⃣ ALL DATA FOR 2025-11-10' as check_step,
  c.name as client_name,
  c.id as client_id,
  cs.summary_date,
  cs.summary_type,
  cs.platform,
  cs.total_spend,
  cs.reservations,
  DATE(cs.created_at) as created_date,
  TO_CHAR(cs.created_at, 'HH24:MI:SS') as created_time
FROM campaign_summaries cs
JOIN clients c ON cs.client_id = c.id
WHERE cs.summary_date = '2025-11-10'
ORDER BY c.name, cs.platform;

-- 2. Check ALL November 2025 weekly data
SELECT 
  '2️⃣ ALL NOVEMBER 2025 WEEKLY DATA' as check_step,
  c.name as client_name,
  cs.summary_date,
  cs.platform,
  cs.total_spend,
  cs.reservations,
  DATE(cs.created_at) as created_date
FROM campaign_summaries cs
JOIN clients c ON cs.client_id = c.id
WHERE cs.summary_type = 'weekly'
  AND cs.summary_date >= '2025-11-01'
  AND cs.summary_date <= '2025-11-30'
ORDER BY cs.summary_date DESC, c.name, cs.platform;

-- 3. Check if there's data for Belmonte's client_id directly (bypass name lookup)
SELECT 
  '3️⃣ BELMONTE BY CLIENT_ID' as check_step,
  cs.summary_date,
  cs.summary_type,
  cs.platform,
  cs.total_spend,
  cs.reservations,
  DATE(cs.created_at) as created_date
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'weekly'
  AND cs.summary_date >= '2025-10-01'
ORDER BY cs.summary_date DESC
LIMIT 20;

-- 4. Check what the latest record is for Belmonte (any date)
SELECT 
  '4️⃣ LATEST BELMONTE RECORD' as check_step,
  cs.summary_date,
  cs.summary_type,
  cs.platform,
  cs.total_spend,
  DATE(cs.created_at) as created_date,
  TO_CHAR(cs.created_at, 'HH24:MI:SS') as created_time
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'weekly'
ORDER BY cs.summary_date DESC
LIMIT 5;



