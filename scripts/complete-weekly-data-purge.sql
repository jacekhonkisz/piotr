-- COMPLETE WEEKLY DATA PURGE
-- This removes weekly data from ALL sources, not just campaign_summaries
-- Run in Supabase SQL Editor

-- ============================================================================
-- STEP 1: CREATE COMPREHENSIVE BACKUP
-- ============================================================================

-- Backup campaign_summaries
CREATE TABLE IF NOT EXISTS campaign_summaries_backup_complete AS
SELECT * FROM campaign_summaries;

-- Backup smart_cache
CREATE TABLE IF NOT EXISTS smart_cache_backup_complete AS
SELECT * FROM smart_cache;

-- Verify backups
SELECT 
  '✅ BACKUPS CREATED' as status,
  (SELECT COUNT(*) FROM campaign_summaries_backup_complete) as campaign_summaries_backup,
  (SELECT COUNT(*) FROM smart_cache_backup_complete) as smart_cache_backup;

-- ============================================================================
-- STEP 2: CHECK CURRENT STATE
-- ============================================================================

-- Check campaign_summaries
SELECT 
  '📊 campaign_summaries' as source,
  COUNT(*) as weekly_records
FROM campaign_summaries
WHERE summary_type = 'weekly';

-- Check smart_cache
SELECT 
  '🔄 smart_cache' as source,
  COUNT(*) as week_related_caches,
  COUNT(*) FILTER (WHERE cache_type = 'current_week') as current_week,
  COUNT(*) FILTER (WHERE cache_type LIKE '%week%') as all_week_caches
FROM smart_cache;

-- ============================================================================
-- STEP 3: DELETE FROM campaign_summaries
-- ============================================================================

-- ⚠️ UNCOMMENT TO DELETE:

/*
BEGIN;

DELETE FROM campaign_summaries
WHERE summary_type = 'weekly';

-- Verify
SELECT 
  '✅ DELETED from campaign_summaries' as status,
  COUNT(*) FILTER (WHERE summary_type = 'weekly') as remaining_weekly
FROM campaign_summaries;
-- Expected: 0

COMMIT;
*/

-- ============================================================================
-- STEP 4: CLEAR SMART CACHE (Weekly entries)
-- ============================================================================

-- ⚠️ UNCOMMENT TO CLEAR CACHE:

/*
BEGIN;

-- Delete all week-related cache entries
DELETE FROM smart_cache
WHERE cache_type LIKE '%week%';

-- Verify
SELECT 
  '✅ CLEARED smart_cache' as status,
  COUNT(*) as remaining_week_caches
FROM smart_cache
WHERE cache_type LIKE '%week%';
-- Expected: 0

COMMIT;
*/

-- ============================================================================
-- STEP 5: VERIFY COMPLETE PURGE
-- ============================================================================

-- Run after steps 3 & 4
SELECT 
  'campaign_summaries' as source,
  COUNT(*) FILTER (WHERE summary_type = 'weekly') as weekly_records
FROM campaign_summaries
UNION ALL
SELECT 
  'smart_cache' as source,
  COUNT(*) as weekly_records
FROM smart_cache
WHERE cache_type LIKE '%week%';

-- Expected: Both show 0

-- ============================================================================
-- STEP 6: ADD PROTECTION
-- ============================================================================

-- ⚠️ UNCOMMENT AFTER PURGE:

/*
-- Ensure constraint exists
ALTER TABLE campaign_summaries DROP CONSTRAINT IF EXISTS weekly_must_be_monday;

ALTER TABLE campaign_summaries
ADD CONSTRAINT weekly_must_be_monday
CHECK (
  summary_type != 'weekly' OR 
  EXTRACT(DOW FROM summary_date) = 1
);

SELECT '✅ CONSTRAINT ADDED' as status;
*/

-- ============================================================================
-- ROLLBACK PROCEDURE
-- ============================================================================

/*
-- To restore everything:

BEGIN;

-- Restore campaign_summaries
DELETE FROM campaign_summaries WHERE summary_type = 'weekly';
INSERT INTO campaign_summaries 
SELECT * FROM campaign_summaries_backup_complete
WHERE summary_type = 'weekly';

-- Restore smart_cache
DELETE FROM smart_cache WHERE cache_type LIKE '%week%';
INSERT INTO smart_cache 
SELECT * FROM smart_cache_backup_complete
WHERE cache_type LIKE '%week%';

COMMIT;
*/

-- ============================================================================
-- NEXT STEPS AFTER PURGE
-- ============================================================================

/*
After running this complete purge:

1. Deploy fixed code:
   git push

2. Restart your application (if needed):
   - Clear browser cache (Ctrl+Shift+R)
   - Restart Next.js dev server if running locally

3. Trigger fresh collection:
   npx tsx scripts/recollect-weeks-controlled.ts --weeks=53

4. Verify reports show no data until collection completes

5. After collection, verify reports show correct data
*/

