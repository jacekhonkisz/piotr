-- Delete the remaining 2 bad records from today

BEGIN;

-- Show what we're deleting
SELECT 
  '🗑️ RECORDS TO DELETE' as action,
  c.name,
  cs.summary_date,
  ROUND(cs.total_spend::numeric, 2) as spend,
  cs.reservations,
  TO_CHAR(cs.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
  AND DATE(cs.created_at) = CURRENT_DATE
ORDER BY cs.created_at;

-- Delete them
DELETE FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND DATE(created_at) = CURRENT_DATE;

-- Verify deletion
SELECT 
  '✅ AFTER DELETION' as status,
  COUNT(*) as remaining_records
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND DATE(created_at) = CURRENT_DATE;

COMMIT;



