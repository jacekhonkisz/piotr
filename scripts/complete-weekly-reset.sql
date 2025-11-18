-- COMPLETE WEEKLY DATA RESET
-- This will DELETE ALL weekly data and allow fresh re-collection
-- Run in Supabase SQL Editor

-- ============================================================================
-- STEP 1: CREATE COMPLETE BACKUP
-- ============================================================================

-- Backup ALL data (not just weekly) for safety
CREATE TABLE IF NOT EXISTS campaign_summaries_complete_backup_20251118 AS
SELECT * FROM campaign_summaries;

-- Verify backup
SELECT 
  '✅ COMPLETE BACKUP CREATED' as status,
  COUNT(*) as total_all_records,
  COUNT(*) FILTER (WHERE summary_type = 'weekly') as weekly_records_backed_up,
  COUNT(*) FILTER (WHERE summary_type = 'monthly') as monthly_records_backed_up
FROM campaign_summaries_complete_backup_20251118;

-- Expected: weekly_records_backed_up = 378 (or 1315 if you didn't run cleanup yet)

-- ============================================================================
-- STEP 2: REVIEW WHAT WILL BE DELETED
-- ============================================================================

-- Show all weekly data that will be deleted
SELECT 
  c.name as client_name,
  COUNT(*) as weekly_records_to_delete,
  MIN(cs.summary_date) as earliest_week,
  MAX(cs.summary_date) as latest_week,
  COUNT(*) FILTER (WHERE cs.platform = 'meta') as meta_records,
  COUNT(*) FILTER (WHERE cs.platform = 'google') as google_records
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
GROUP BY c.name
ORDER BY weekly_records_to_delete DESC;

-- Count total
SELECT 
  '⚠️ WILL DELETE ALL WEEKLY DATA' as action,
  COUNT(*) as total_weekly_records,
  COUNT(DISTINCT client_id) as affected_clients,
  COUNT(*) FILTER (WHERE platform = 'meta') as meta_records,
  COUNT(*) FILTER (WHERE platform = 'google') as google_records
FROM campaign_summaries
WHERE summary_type = 'weekly';

-- ============================================================================
-- STEP 3: DELETE ALL WEEKLY DATA
-- ============================================================================

-- ⚠️ UNCOMMENT TO DELETE ALL WEEKLY RECORDS:

/*
BEGIN;

-- Delete ALL weekly summaries
DELETE FROM campaign_summaries
WHERE summary_type = 'weekly';

-- Verify deletion
SELECT 
  '✅ ALL WEEKLY DATA DELETED' as status,
  COUNT(*) FILTER (WHERE summary_type = 'weekly') as remaining_weekly_records,
  COUNT(*) FILTER (WHERE summary_type = 'monthly') as monthly_records_kept,
  COUNT(*) as total_remaining_records
FROM campaign_summaries;

-- Expected: remaining_weekly_records = 0

COMMIT;
*/

-- ============================================================================
-- STEP 4: ADD CONSTRAINT (Prevents future bad dates)
-- ============================================================================

-- ⚠️ UNCOMMENT AFTER STEP 3:

/*
-- Drop if exists (in case it was already added)
ALTER TABLE campaign_summaries DROP CONSTRAINT IF EXISTS weekly_must_be_monday;

-- Add constraint to enforce Monday-only dates
ALTER TABLE campaign_summaries
ADD CONSTRAINT weekly_must_be_monday
CHECK (
  summary_type != 'weekly' OR 
  EXTRACT(DOW FROM summary_date) = 1
);

SELECT '✅ CONSTRAINT ADDED' as status;
*/

-- ============================================================================
-- STEP 5: VERIFY CLEAN STATE
-- ============================================================================

-- Check final state (after steps 3 & 4)
SELECT 
  '📊 CLEAN STATE VERIFIED' as status,
  COUNT(*) FILTER (WHERE summary_type = 'weekly') as weekly_records,
  COUNT(*) FILTER (WHERE summary_type = 'monthly') as monthly_records,
  COUNT(*) as total_records
FROM campaign_summaries;

-- Expected:
-- weekly_records = 0 (clean slate!)
-- monthly_records = unchanged
-- ready for fresh collection

-- Check constraint exists
SELECT 
  '🔒 CONSTRAINTS' as info,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conname LIKE '%weekly%'
  AND conrelid = 'campaign_summaries'::regclass;

-- ============================================================================
-- ROLLBACK PROCEDURE (if needed)
-- ============================================================================

/*
-- To restore from backup:

BEGIN;

-- 1. Drop constraint
ALTER TABLE campaign_summaries DROP CONSTRAINT IF EXISTS weekly_must_be_monday;

-- 2. Restore weekly data from backup
INSERT INTO campaign_summaries 
SELECT * FROM campaign_summaries_complete_backup_20251118
WHERE summary_type = 'weekly';

-- 3. Verify restore
SELECT COUNT(*) FROM campaign_summaries WHERE summary_type = 'weekly';

COMMIT;
*/

-- ============================================================================
-- NEXT STEP: RE-COLLECT DATA
-- ============================================================================

/*
After running this script:

1. Deploy the fixed code:
   git push

2. Manually trigger collection for each client OR use the batch script:
   
   Option A - Use the API endpoint (recommended):
   See: scripts/recollect-all-weeks-batch.sh
   
   Option B - Wait for automatic collection:
   Runs Monday 2 AM (will only collect last 12 weeks)
   
   Option C - Manual trigger:
   curl -X POST 'https://piotr-gamma.vercel.app/api/automated/incremental-weekly-collection'

3. For COMPLETE historical data (53 weeks):
   Use the manual collection script
   See: scripts/recollect-53-weeks-all-clients.sh

4. Verify:
   npx tsx scripts/check-weekly-duplicates.ts
*/

-- ============================================================================
-- SUMMARY
-- ============================================================================

/*
📊 COMPLETE RESET SUMMARY

What this does:
  ✅ Creates complete backup of all data
  ✅ Deletes ALL weekly records (clean slate)
  ✅ Adds database constraint (Monday-only)
  ✅ Preserves monthly data (untouched)
  ✅ Rollback available if needed

After reset:
  Weekly records: 0
  Ready for: Fresh collection with correct ISO weeks
  
Next action:
  Deploy fixed code → Trigger re-collection → Verify

Time to complete:
  - This script: 2 minutes
  - Code deployment: 2 minutes  
  - Re-collection (12 weeks): 3-5 minutes
  - Re-collection (53 weeks): 15-30 minutes
  - Total: 10-40 minutes depending on scope
*/

