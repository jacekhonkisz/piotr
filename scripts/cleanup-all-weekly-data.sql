-- Cleanup Weekly Data for ALL CLIENTS
-- Run in Supabase SQL Editor
-- This will clean up 937 non-Monday weekly records across all clients

-- ============================================================================
-- STEP 1: CREATE BACKUP (CRITICAL - Run this first!)
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaign_summaries_backup_20251118_all_clients AS
SELECT * FROM campaign_summaries
WHERE summary_type = 'weekly';

-- Verify backup
SELECT 
  '✅ BACKUP CREATED' as status,
  COUNT(*) as total_backed_up,
  COUNT(*) FILTER (WHERE EXTRACT(DOW FROM summary_date) = 1) as monday_weeks_backed_up,
  COUNT(*) FILTER (WHERE EXTRACT(DOW FROM summary_date) != 1) as non_monday_backed_up
FROM campaign_summaries_backup_20251118_all_clients;

-- Expected: total_backed_up = 1315, non_monday_backed_up = 937

-- ============================================================================
-- STEP 2: ANALYZE WHAT WILL BE DELETED
-- ============================================================================

-- See which clients are affected
SELECT 
  c.name as client_name,
  COUNT(*) as non_monday_weeks,
  COUNT(*) FILTER (WHERE cs.platform = 'meta') as meta_bad,
  COUNT(*) FILTER (WHERE cs.platform = 'google') as google_bad,
  MIN(cs.summary_date) as earliest_bad_week,
  MAX(cs.summary_date) as latest_bad_week
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
  AND EXTRACT(DOW FROM cs.summary_date) != 1
GROUP BY c.name
ORDER BY non_monday_weeks DESC;

-- See sample of what will be deleted
SELECT 
  c.name as client_name,
  cs.summary_date,
  TO_CHAR(cs.summary_date, 'Dy') as day_of_week,
  cs.platform,
  cs.total_spend,
  cs.reservations,
  cs.created_at
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
  AND EXTRACT(DOW FROM cs.summary_date) != 1
ORDER BY c.name, cs.summary_date DESC
LIMIT 50;

-- Count by platform
SELECT 
  platform,
  COUNT(*) as non_monday_weeks,
  COUNT(DISTINCT client_id) as affected_clients
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND EXTRACT(DOW FROM summary_date) != 1
GROUP BY platform;

-- Total summary
SELECT 
  '⚠️ WILL DELETE' as action,
  COUNT(*) as total_records,
  COUNT(DISTINCT client_id) as affected_clients,
  SUM(total_spend) as total_spend_deleted,
  SUM(reservations) as total_reservations_deleted
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND EXTRACT(DOW FROM summary_date) != 1;

-- ============================================================================
-- STEP 3: DELETE NON-MONDAY WEEKS (⚠️ REVIEW STEP 2 FIRST!)
-- ============================================================================

-- ⚠️ UNCOMMENT THE FOLLOWING LINES AFTER REVIEWING STEP 2:

/*
BEGIN;

-- Delete all non-Monday weekly records
DELETE FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND EXTRACT(DOW FROM summary_date) != 1;

-- Verify deletion
SELECT 
  '✅ DELETION COMPLETE' as status,
  COUNT(*) FILTER (WHERE summary_type = 'weekly') as remaining_weekly_records,
  COUNT(*) FILTER (WHERE summary_type = 'weekly' AND EXTRACT(DOW FROM summary_date) = 1) as monday_weeks,
  COUNT(*) FILTER (WHERE summary_type = 'weekly' AND EXTRACT(DOW FROM summary_date) != 1) as non_monday_weeks
FROM campaign_summaries;

-- Expected: non_monday_weeks = 0

COMMIT;
*/

-- ============================================================================
-- STEP 4: ADD DATABASE CONSTRAINT (After deletion)
-- ============================================================================

-- ⚠️ UNCOMMENT AFTER STEP 3 COMPLETES SUCCESSFULLY:

/*
-- Add constraint to prevent future non-Monday weeks
ALTER TABLE campaign_summaries
ADD CONSTRAINT weekly_must_be_monday
CHECK (
  summary_type != 'weekly' OR 
  EXTRACT(DOW FROM summary_date) = 1
);

-- Verify constraint was added
SELECT 
  '✅ CONSTRAINT ADDED' as status,
  conname as constraint_name
FROM pg_constraint
WHERE conname = 'weekly_must_be_monday';
*/

-- ============================================================================
-- STEP 5: VERIFY FINAL STATE
-- ============================================================================

-- Check current state (run after steps 3 & 4)
SELECT 
  '📊 FINAL STATE' as status,
  COUNT(*) FILTER (WHERE summary_type = 'weekly') as total_weekly_records,
  COUNT(*) FILTER (WHERE summary_type = 'weekly' AND EXTRACT(DOW FROM summary_date) = 1) as monday_weeks,
  COUNT(*) FILTER (WHERE summary_type = 'weekly' AND EXTRACT(DOW FROM summary_date) != 1) as non_monday_weeks,
  MIN(summary_date) FILTER (WHERE summary_type = 'weekly') as earliest_week,
  MAX(summary_date) FILTER (WHERE summary_type = 'weekly') as latest_week
FROM campaign_summaries;

-- Expected:
-- total_weekly_records: 378 (was 1315)
-- monday_weeks: 378 (100%)
-- non_monday_weeks: 0 (0%)

-- Check by client
SELECT 
  c.name as client_name,
  COUNT(*) as weekly_records,
  COUNT(*) FILTER (WHERE EXTRACT(DOW FROM cs.summary_date) = 1) as monday_weeks,
  COUNT(*) FILTER (WHERE EXTRACT(DOW FROM cs.summary_date) != 1) as non_monday_weeks,
  MIN(cs.summary_date) as earliest_week,
  MAX(cs.summary_date) as latest_week
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
GROUP BY c.name
ORDER BY weekly_records DESC;

-- All clients should show non_monday_weeks = 0

-- ============================================================================
-- STEP 6: TRIGGER RE-COLLECTION
-- ============================================================================

-- After cleanup, trigger incremental collection to fill missing weeks
-- Run this in your terminal (NOT in SQL Editor):

/*
curl -X POST 'https://piotr-gamma.vercel.app/api/automated/incremental-weekly-collection' \
  -H 'Authorization: Bearer YOUR_CRON_SECRET' \
  -w "\n⏱️  Time: %{time_total}s\n"
*/

-- This will:
-- 1. Detect missing weeks for all clients
-- 2. Collect last 12 weeks with correct Monday dates
-- 3. Take ~2-5 minutes depending on number of clients
-- 4. Fill database with ISO-compliant data

-- ============================================================================
-- ROLLBACK PROCEDURE (if something goes wrong)
-- ============================================================================

/*
-- To restore from backup:

BEGIN;

-- 1. Drop constraint (if added)
ALTER TABLE campaign_summaries DROP CONSTRAINT IF EXISTS weekly_must_be_monday;

-- 2. Delete current weekly data
DELETE FROM campaign_summaries WHERE summary_type = 'weekly';

-- 3. Restore from backup
INSERT INTO campaign_summaries 
SELECT * FROM campaign_summaries_backup_20251118_all_clients;

-- 4. Verify restore
SELECT COUNT(*) FROM campaign_summaries WHERE summary_type = 'weekly';
-- Expected: 1315 (original count)

COMMIT;
*/

-- ============================================================================
-- CLEANUP BACKUP TABLE (After verifying everything works)
-- ============================================================================

-- Wait 1-2 days, then remove backup:
-- DROP TABLE campaign_summaries_backup_20251118_all_clients;

-- ============================================================================
-- SUMMARY
-- ============================================================================

/*
📊 CLEANUP SUMMARY

Before:
  Total records: 1,315
  Monday weeks: 378 (29%)
  Non-Monday: 937 (71%) ❌

After:
  Total records: 378
  Monday weeks: 378 (100%) ✅
  Non-Monday: 0 (0%) ✅

Action Required:
  1. ✅ Run Step 1 (Backup)
  2. 📊 Review Step 2 (See what will be deleted)
  3. 🗑️ Uncomment & run Step 3 (Delete)
  4. 🔒 Uncomment & run Step 4 (Add constraint)
  5. ✅ Run Step 5 (Verify)
  6. 🔄 Run Step 6 (Re-collect data)

Time Required: 10-15 minutes
Risk Level: LOW (backup created, rollback available)
Result: 100% ISO-compliant weekly data
*/

