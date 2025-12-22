-- ═══════════════════════════════════════════════════════════════════
-- 🗑️ DELETE BAD WEEKLY DATA - November 18, 2025
-- ═══════════════════════════════════════════════════════════════════
-- Reason: Weekly collection was doubling/wrong due to data source priority bug
-- Fix Applied: storeWeeklySummary() now matches monthly logic (Meta API primary, daily_kpi_data fallback)
-- ═══════════════════════════════════════════════════════════════════

-- STEP 1: Check what was collected today (Nov 18)
SELECT 
  '📊 RECORDS CREATED TODAY' as info,
  c.name as client_name,
  cs.summary_date as week_start,
  cs.platform,
  ROUND(cs.total_spend::numeric, 2) as spend,
  cs.reservations,
  cs.booking_step_1,
  TO_CHAR(cs.created_at, 'HH24:MI:SS') as created_time
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
  AND DATE(cs.created_at) = CURRENT_DATE
ORDER BY cs.created_at DESC, c.name;

-- STEP 2: Summary Count
SELECT 
  '📈 SUMMARY' as info,
  COUNT(*) as total_records,
  COUNT(DISTINCT cs.client_id) as clients_affected,
  SUM(cs.total_spend) as total_spend_sum,
  MIN(cs.summary_date) as earliest_week,
  MAX(cs.summary_date) as latest_week
FROM campaign_summaries cs
WHERE cs.summary_type = 'weekly'
  AND DATE(cs.created_at) = CURRENT_DATE;

-- STEP 3: Breakdown by platform
SELECT 
  '📊 BY PLATFORM' as info,
  cs.platform,
  COUNT(*) as records,
  SUM(cs.total_spend) as total_spend,
  SUM(cs.reservations) as total_reservations
FROM campaign_summaries cs
WHERE cs.summary_type = 'weekly'
  AND DATE(cs.created_at) = CURRENT_DATE
GROUP BY cs.platform
ORDER BY cs.platform;

-- ═══════════════════════════════════════════════════════════════════
-- ⚠️ STEP 4: DELETE BAD DATA
-- ⚠️ UNCOMMENT THE DELETE BLOCK BELOW TO PROCEED
-- ═══════════════════════════════════════════════════════════════════

/*
BEGIN;

-- Create temporary backup before deletion
CREATE TEMP TABLE deleted_bad_weekly_data_nov18 AS
SELECT * FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND DATE(created_at) = CURRENT_DATE;

-- Delete the bad weekly data
DELETE FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND DATE(created_at) = CURRENT_DATE;

-- Show what was deleted
SELECT 
  '✅ DELETION COMPLETE' as status,
  COUNT(*) as records_deleted,
  SUM(total_spend) as total_spend_removed
FROM deleted_bad_weekly_data_nov18;

COMMIT;

SELECT '✅ Bad weekly data from Nov 18 has been deleted' as final_status;
SELECT '💾 Backup saved in temp table: deleted_bad_weekly_data_nov18' as backup_info;
*/

-- ═══════════════════════════════════════════════════════════════════
-- NEXT STEPS AFTER DELETION:
-- ═══════════════════════════════════════════════════════════════════
-- 1. Test with 1 week: npx tsx scripts/recollect-weeks-controlled.ts --weeks=1
-- 2. Verify: Run scripts/diagnose-doubling-issue.sql
-- 3. Full collection: npx tsx scripts/recollect-weeks-controlled.ts --weeks=53
-- ═══════════════════════════════════════════════════════════════════

