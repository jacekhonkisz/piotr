-- Comprehensive diagnostic to find why week 2025-11-10 is missing

-- 1. Check ALL weekly data (not just Belmonte) to see what's actually in the database
SELECT 
  '1️⃣ ALL WEEKLY DATA IN DATABASE' as check_step,
  c.name as client_name,
  cs.summary_date,
  cs.platform,
  cs.total_spend,
  DATE(cs.created_at) as created_date
FROM campaign_summaries cs
JOIN clients c ON cs.client_id = c.id
WHERE cs.summary_type = 'weekly'
ORDER BY cs.summary_date DESC, c.name
LIMIT 30;

-- 2. Check specifically for 2025-11-10 across ALL clients
SELECT 
  '2️⃣ DATA FOR 2025-11-10 (ALL CLIENTS)' as check_step,
  c.name as client_name,
  c.id as client_id,
  cs.summary_date,
  cs.platform,
  cs.total_spend,
  cs.reservations,
  DATE(cs.created_at) as created_date
FROM campaign_summaries cs
JOIN clients c ON cs.client_id = c.id
WHERE cs.summary_date = '2025-11-10'
  AND cs.summary_type = 'weekly'
ORDER BY c.name, cs.platform;

-- 3. Check Belmonte's client ID
SELECT 
  '3️⃣ BELMONTE CLIENT INFO' as check_step,
  id as client_id,
  name,
  created_at
FROM clients
WHERE name = 'Belmonte Hotel';

-- 4. Check if there's ANY data for Belmonte after 2025-09-01
SELECT 
  '4️⃣ BELMONTE DATA AFTER 2025-09-01' as check_step,
  cs.summary_date,
  cs.platform,
  cs.total_spend,
  cs.reservations,
  DATE(cs.created_at) as created_date
FROM campaign_summaries cs
JOIN clients c ON cs.client_id = c.id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_type = 'weekly'
  AND cs.summary_date > '2025-09-01'
ORDER BY cs.summary_date DESC;

-- 5. Count records by date range to see distribution
SELECT 
  '5️⃣ DATA DISTRIBUTION BY DATE RANGE' as check_step,
  CASE 
    WHEN summary_date >= '2025-11-01' THEN 'Nov 2025'
    WHEN summary_date >= '2025-10-01' THEN 'Oct 2025'
    WHEN summary_date >= '2025-09-01' THEN 'Sep 2025'
    WHEN summary_date >= '2025-08-01' THEN 'Aug 2025'
    ELSE 'Older'
  END as period,
  COUNT(*) as record_count,
  MIN(summary_date) as earliest,
  MAX(summary_date) as latest
FROM campaign_summaries cs
JOIN clients c ON cs.client_id = c.id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
GROUP BY period
ORDER BY period DESC;



