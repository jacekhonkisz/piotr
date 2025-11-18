-- Standardize Weekly Data - Run in Supabase SQL Editor
-- This script will:
-- 1. Backup existing data
-- 2. Delete non-Monday weeks
-- 3. Add constraint to prevent future issues

-- ============================================================================
-- STEP 1: BACKUP (Run this first!)
-- ============================================================================

-- Create backup table
CREATE TABLE IF NOT EXISTS campaign_summaries_backup_20251118 AS
SELECT * FROM campaign_summaries
WHERE summary_type = 'weekly';

-- Verify backup
SELECT 
  'Backup created' as status,
  COUNT(*) as backed_up_records
FROM campaign_summaries_backup_20251118;

-- ============================================================================
-- STEP 2: PREVIEW WHAT WILL BE DELETED
-- ============================================================================

-- See what will be deleted
SELECT 
  c.name as client_name,
  cs.summary_date,
  TO_CHAR(cs.summary_date, 'Dy') as day_of_week,
  cs.platform,
  cs.total_spend,
  cs.reservations
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
  AND EXTRACT(DOW FROM cs.summary_date) != 1
ORDER BY c.name, cs.summary_date DESC
LIMIT 50;

-- Count non-Monday weeks
SELECT 
  'Will be deleted' as status,
  COUNT(*) as non_monday_weeks,
  COUNT(DISTINCT client_id) as affected_clients
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND EXTRACT(DOW FROM summary_date) != 1;

-- ============================================================================
-- STEP 3: DELETE NON-MONDAY WEEKS (Review preview first!)
-- ============================================================================

-- ⚠️ UNCOMMENT THE FOLLOWING LINES TO DELETE:

/*
DELETE FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND EXTRACT(DOW FROM summary_date) != 1;
*/

-- ============================================================================
-- STEP 4: ADD CONSTRAINT (After deletion)
-- ============================================================================

-- ⚠️ UNCOMMENT THE FOLLOWING LINES TO ADD CONSTRAINT:

/*
ALTER TABLE campaign_summaries
ADD CONSTRAINT weekly_must_be_monday
CHECK (
  summary_type != 'weekly' OR 
  EXTRACT(DOW FROM summary_date) = 1
);
*/

-- ============================================================================
-- STEP 5: VERIFY CLEANUP
-- ============================================================================

-- Check current state
SELECT 
  'Current state' as status,
  COUNT(*) as total_weekly_records,
  COUNT(*) FILTER (WHERE EXTRACT(DOW FROM summary_date) = 1) as monday_weeks,
  COUNT(*) FILTER (WHERE EXTRACT(DOW FROM summary_date) != 1) as non_monday_weeks,
  MIN(summary_date) as earliest_week,
  MAX(summary_date) as latest_week
FROM campaign_summaries
WHERE summary_type = 'weekly';

-- Expected after cleanup:
-- non_monday_weeks = 0
-- All weekly records start on Monday

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================

/*
-- To restore from backup:

-- 1. Drop constraint (if added)
ALTER TABLE campaign_summaries DROP CONSTRAINT IF EXISTS weekly_must_be_monday;

-- 2. Delete current weekly data
DELETE FROM campaign_summaries WHERE summary_type = 'weekly';

-- 3. Restore from backup
INSERT INTO campaign_summaries 
SELECT * FROM campaign_summaries_backup_20251118;

-- 4. Verify restore
SELECT COUNT(*) FROM campaign_summaries WHERE summary_type = 'weekly';
*/

