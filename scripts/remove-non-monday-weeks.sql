-- Remove weekly summaries that DON'T start on Monday
-- ISO weeks MUST start on Monday (day_of_week = 1)

BEGIN;

-- Find all "weekly" entries that are NOT Mondays
SELECT 
  cs.id,
  c.name as client_name,
  cs.summary_date,
  EXTRACT(DOW FROM cs.summary_date) as day_of_week,
  TO_CHAR(cs.summary_date, 'Dy') as day_name,
  cs.total_spend,
  cs.reservations,
  cs.created_at,
  CASE 
    WHEN EXTRACT(DOW FROM cs.summary_date) = 1 THEN '✅ Monday (keep)'
    ELSE '❌ NOT Monday (DELETE)'
  END as status
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
  AND EXTRACT(DOW FROM cs.summary_date) != 1  -- NOT Monday
ORDER BY c.name, cs.summary_date DESC
LIMIT 100;

-- COUNT non-Monday entries
SELECT 
  COUNT(*) as non_monday_entries,
  COUNT(DISTINCT cs.client_id) as affected_clients
FROM campaign_summaries cs
WHERE cs.summary_type = 'weekly'
  AND EXTRACT(DOW FROM cs.summary_date) != 1;

-- ⚠️ UNCOMMENT TO DELETE NON-MONDAY ENTRIES:
-- DELETE FROM campaign_summaries
-- WHERE summary_type = 'weekly'
--   AND EXTRACT(DOW FROM cs.summary_date) != 1;

ROLLBACK; -- Change to COMMIT after reviewing

