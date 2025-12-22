-- ═══════════════════════════════════════════════════════════════════
-- 🗑️ DELETE TODAY'S BAD WEEKLY DATA
-- ═══════════════════════════════════════════════════════════════════
-- Reason: All records show current month data (identical values for all weeks)
-- Date: November 18, 2025
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- Check what will be deleted
SELECT 
  '📊 DATA TO DELETE' as info,
  COUNT(*) as total_records,
  COUNT(DISTINCT client_id) as clients_affected,
  MIN(summary_date) as earliest_week,
  MAX(summary_date) as latest_week,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND DATE(created_at) = CURRENT_DATE;

-- Delete today's bad weekly data
DELETE FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND DATE(created_at) = CURRENT_DATE;

-- Confirm deletion
SELECT 
  '✅ DELETION COMPLETE' as status,
  'Deleted all weekly records created today (Nov 18)' as message;

-- Verify no weekly records from today remain
SELECT 
  '🔍 VERIFICATION' as check,
  COUNT(*) as weekly_records_from_today
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND DATE(created_at) = CURRENT_DATE;

COMMIT;

SELECT '✅ Bad weekly data deleted successfully' as final_status;




