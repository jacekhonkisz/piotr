-- Execute Belmonte weekly data deletion (automated version)

BEGIN;

-- Backup Belmonte weekly data
CREATE TEMP TABLE IF NOT EXISTS belmonte_weekly_backup AS
SELECT cs.*
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta';

-- Show backup
SELECT 
  '💾 BACKUP CREATED' as status,
  COUNT(*) as records_backed_up,
  MIN(summary_date) as earliest_week,
  MAX(summary_date) as latest_week
FROM belmonte_weekly_backup;

-- Delete Belmonte weekly data
DELETE FROM campaign_summaries
WHERE client_id IN (
  SELECT id FROM clients WHERE name ILIKE '%Belmonte%'
)
AND summary_type = 'weekly'
AND platform = 'meta';

-- Confirm deletion
SELECT 
  '✅ DELETION COMPLETE' as status,
  (SELECT COUNT(*) FROM belmonte_weekly_backup) as records_deleted,
  (SELECT COUNT(*) 
   FROM campaign_summaries cs
   JOIN clients c ON c.id = cs.client_id
   WHERE c.name ILIKE '%Belmonte%'
     AND cs.summary_type = 'weekly'
  ) as remaining_records;

COMMIT;

-- Final verification
SELECT 
  '🔍 FINAL CHECK' as info,
  c.name,
  COUNT(*) as weekly_records_remaining
FROM clients c
LEFT JOIN campaign_summaries cs ON cs.client_id = c.id 
  AND cs.summary_type = 'weekly'
WHERE c.name ILIKE '%Belmonte%'
GROUP BY c.name;



