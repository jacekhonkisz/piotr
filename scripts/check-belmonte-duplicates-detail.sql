-- Check ALL duplicate weeks for Belmonte in detail
-- This will show us why there are 158 weeks instead of ~60

-- 1. Show ALL weeks with their data to see the pattern
SELECT 
  cs.summary_date,
  TO_CHAR(cs.summary_date, 'Dy') as day_of_week,
  cs.total_spend,
  cs.reservations,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.created_at,
  cs.id
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.summary_date >= '2025-11-01'
ORDER BY cs.summary_date DESC, cs.created_at DESC;

-- 2. Count how many entries per unique week date
SELECT 
  cs.summary_date,
  COUNT(*) as entry_count,
  SUM(cs.total_spend) as total_spend_all_entries,
  STRING_AGG(cs.id::text, ', ') as all_ids
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.summary_date >= '2025-10-01'
GROUP BY cs.summary_date
ORDER BY cs.summary_date DESC;

-- 3. Check if summary_date is Monday (ISO week start)
SELECT 
  cs.summary_date,
  EXTRACT(DOW FROM cs.summary_date) as day_of_week_number,
  CASE 
    WHEN EXTRACT(DOW FROM cs.summary_date) = 1 THEN '✅ Monday (correct)'
    ELSE '❌ NOT Monday (wrong!)'
  END as is_monday,
  cs.total_spend,
  cs.reservations,
  cs.created_at
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.summary_date >= '2025-10-01'
ORDER BY cs.summary_date DESC
LIMIT 20;

