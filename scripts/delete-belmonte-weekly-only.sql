-- ═══════════════════════════════════════════════════════════════════
-- 🗑️ DELETE BELMONTE WEEKLY DATA ONLY
-- ═══════════════════════════════════════════════════════════════════
-- Purpose: Remove all Belmonte weekly data for clean re-collection
-- ═══════════════════════════════════════════════════════════════════

-- STEP 1: Check current Belmonte weekly data
SELECT 
  '📊 BELMONTE CURRENT WEEKLY DATA' as info,
  c.name,
  COUNT(*) as weekly_records,
  MIN(cs.summary_date) as earliest_week,
  MAX(cs.summary_date) as latest_week,
  ROUND(SUM(cs.total_spend)::numeric, 2) as total_spend,
  SUM(cs.reservations) as total_reservations,
  SUM(cs.booking_step_1) as total_booking_step_1
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
GROUP BY c.name;

-- STEP 2: Detailed breakdown by week
SELECT 
  '📅 BELMONTE WEEKS DETAIL' as info,
  cs.summary_date,
  TO_CHAR(cs.summary_date, 'Day') as day_name,
  ROUND(cs.total_spend::numeric, 2) as spend,
  cs.reservations,
  cs.booking_step_1,
  TO_CHAR(cs.created_at, 'YYYY-MM-DD HH24:MI') as created_at
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
ORDER BY cs.summary_date DESC;

-- ═══════════════════════════════════════════════════════════════════
-- ⚠️ STEP 3: DELETE BELMONTE WEEKLY DATA
-- ⚠️ UNCOMMENT THE DELETE BLOCK BELOW TO PROCEED
-- ═══════════════════════════════════════════════════════════════════

/*
BEGIN;

-- Create backup
CREATE TEMP TABLE belmonte_weekly_backup AS
SELECT cs.*
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta';

-- Show what will be deleted
SELECT 
  '💾 BACKUP CREATED' as status,
  COUNT(*) as records_backed_up
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
  ) as remaining_weekly_records;

COMMIT;

SELECT '✅ Belmonte weekly data deleted successfully' as final_status;
SELECT '💾 Backup available in temp table: belmonte_weekly_backup' as backup_info;
*/

-- ═══════════════════════════════════════════════════════════════════
-- NEXT STEP AFTER DELETION:
-- ═══════════════════════════════════════════════════════════════════
-- Run: npx tsx scripts/recollect-weeks-controlled.ts --weeks=53 --client=belmonte
-- ═══════════════════════════════════════════════════════════════════



