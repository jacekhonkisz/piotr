-- Delete all Belmonte weekly data collected today to start fresh

BEGIN;

-- Show what we're deleting
SELECT 
  '🗑️ RECORDS TO DELETE' as action,
  COUNT(*) as total_records,
  MIN(summary_date) as earliest_week,
  MAX(summary_date) as latest_week
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_type = 'weekly'
  AND DATE(cs.created_at) = CURRENT_DATE;

-- Delete all Belmonte weekly data from today
DELETE FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE name = 'Belmonte Hotel')
  AND summary_type = 'weekly'
  AND DATE(created_at) = CURRENT_DATE;

-- Verify deletion
SELECT 
  '✅ AFTER DELETION' as status,
  COUNT(*) as remaining_records
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_type = 'weekly'
  AND DATE(cs.created_at) = CURRENT_DATE;

COMMIT;



