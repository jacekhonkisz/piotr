-- Debug why week 46 query isn't working

-- 1. Check what data exists for 2025-11-10
SELECT 
  '1️⃣ DATA FOR 2025-11-10' as check_step,
  c.name,
  c.id as client_id,
  cs.summary_date,
  cs.summary_type,
  cs.platform,
  cs.total_spend,
  cs.reservations
FROM campaign_summaries cs
JOIN clients c ON cs.client_id = c.id
WHERE cs.summary_date = '2025-11-10'
  AND cs.summary_type = 'weekly'
ORDER BY c.name, cs.platform;

-- 2. Check what client IDs exist
SELECT 
  '2️⃣ BELMONTE CLIENT ID' as check_step,
  id,
  name
FROM clients
WHERE name = 'Belmonte Hotel';

-- 3. Check all weekly data for Belmonte around Nov 10
SELECT 
  '3️⃣ BELMONTE WEEKLY DATA (ALL)' as check_step,
  summary_date,
  platform,
  total_spend,
  reservations,
  booking_step_1
FROM campaign_summaries cs
JOIN clients c ON cs.client_id = c.id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_type = 'weekly'
  AND cs.summary_date >= '2025-10-01'
ORDER BY cs.summary_date DESC, cs.platform;

-- 4. Check the exact query that StandardizedDataFetcher would run
-- (Replace 'BELMONTE_ID_HERE' with actual ID from step 2)
SELECT 
  '4️⃣ SIMULATED STANDARDIZED QUERY' as check_step,
  *
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE name = 'Belmonte Hotel' LIMIT 1)
  AND summary_type = 'weekly'
  AND platform = 'meta'
  AND summary_date = '2025-11-10';

