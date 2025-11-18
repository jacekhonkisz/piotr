-- Migration: Weekly Data Standardization
-- Created: November 18, 2025
-- Purpose: Backup, clean, and enforce ISO week standards for weekly reports

-- ============================================================================
-- STEP 1: BACKUP CURRENT DATA
-- ============================================================================

-- Create backup table with all existing weekly data
CREATE TABLE IF NOT EXISTS campaign_summaries_backup_20251118 AS
SELECT * FROM campaign_summaries
WHERE summary_type = 'weekly';

-- Add metadata about the backup
COMMENT ON TABLE campaign_summaries_backup_20251118 IS 
'Backup of weekly campaign summaries before ISO week standardization (Nov 18, 2025)';

-- Verify backup was created
DO $$
DECLARE
  backup_count INTEGER;
  original_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO backup_count FROM campaign_summaries_backup_20251118;
  SELECT COUNT(*) INTO original_count FROM campaign_summaries WHERE summary_type = 'weekly';
  
  RAISE NOTICE '✅ Backup created: % weekly records backed up (original: %)', backup_count, original_count;
  
  IF backup_count != original_count THEN
    RAISE EXCEPTION 'Backup verification failed! Expected % records, got %', original_count, backup_count;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: ANALYZE NON-MONDAY WEEKS BEFORE DELETION
-- ============================================================================

-- Log what will be deleted
DO $$
DECLARE
  non_monday_count INTEGER;
  affected_clients INTEGER;
BEGIN
  SELECT COUNT(*) INTO non_monday_count
  FROM campaign_summaries
  WHERE summary_type = 'weekly'
    AND EXTRACT(DOW FROM summary_date) != 1;
  
  SELECT COUNT(DISTINCT client_id) INTO affected_clients
  FROM campaign_summaries
  WHERE summary_type = 'weekly'
    AND EXTRACT(DOW FROM summary_date) != 1;
  
  RAISE NOTICE '⚠️  Found % non-Monday weekly records across % clients', non_monday_count, affected_clients;
  RAISE NOTICE '📊 These records will be deleted and re-collected with correct dates';
END $$;

-- Create a temporary log of what's being deleted (for reference)
CREATE TEMP TABLE deleted_weeks_log AS
SELECT 
  cs.id,
  c.name as client_name,
  cs.summary_date,
  EXTRACT(DOW FROM cs.summary_date) as day_of_week,
  TO_CHAR(cs.summary_date, 'Dy') as day_name,
  cs.platform,
  cs.total_spend,
  cs.reservations,
  cs.created_at
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
  AND EXTRACT(DOW FROM cs.summary_date) != 1
ORDER BY c.name, cs.summary_date DESC;

-- ============================================================================
-- STEP 3: DELETE NON-MONDAY WEEKS
-- ============================================================================

-- Delete weekly records that don't start on Monday
WITH deleted AS (
  DELETE FROM campaign_summaries
  WHERE summary_type = 'weekly'
    AND EXTRACT(DOW FROM summary_date) != 1
  RETURNING *
)
SELECT 
  COUNT(*) as deleted_count,
  COUNT(DISTINCT client_id) as affected_clients,
  SUM(total_spend) as total_spend_deleted
FROM deleted;

-- Verify deletion
DO $$
DECLARE
  remaining_non_monday INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_non_monday
  FROM campaign_summaries
  WHERE summary_type = 'weekly'
    AND EXTRACT(DOW FROM summary_date) != 1;
  
  IF remaining_non_monday > 0 THEN
    RAISE EXCEPTION 'Cleanup verification failed! Still have % non-Monday weeks', remaining_non_monday;
  ELSE
    RAISE NOTICE '✅ Cleanup complete: All weekly records now start on Monday';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: ADD DATABASE CONSTRAINT
-- ============================================================================

-- Add check constraint to enforce Monday-only dates for weekly reports
ALTER TABLE campaign_summaries
ADD CONSTRAINT weekly_must_be_monday
CHECK (
  summary_type != 'weekly' OR 
  EXTRACT(DOW FROM summary_date) = 1
);

-- Add helpful comment
COMMENT ON CONSTRAINT weekly_must_be_monday ON campaign_summaries IS 
'Ensures weekly reports always start on Monday (ISO 8601 standard). This prevents data quality issues from incorrect week boundaries.';

-- ============================================================================
-- STEP 5: VERIFY FINAL STATE
-- ============================================================================

DO $$
DECLARE
  total_weekly INTEGER;
  all_monday BOOLEAN;
  date_range TEXT;
BEGIN
  SELECT 
    COUNT(*),
    BOOL_AND(EXTRACT(DOW FROM summary_date) = 1),
    MIN(summary_date)::TEXT || ' to ' || MAX(summary_date)::TEXT
  INTO total_weekly, all_monday, date_range
  FROM campaign_summaries
  WHERE summary_type = 'weekly';
  
  RAISE NOTICE '📊 Final state:';
  RAISE NOTICE '   Total weekly records: %', total_weekly;
  RAISE NOTICE '   All weeks start on Monday: %', CASE WHEN all_monday THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE '   Date range: %', date_range;
  RAISE NOTICE '   Constraint added: weekly_must_be_monday';
END $$;

-- ============================================================================
-- ROLLBACK PROCEDURE (if needed)
-- ============================================================================

-- If you need to rollback, run this:
-- BEGIN;
-- ALTER TABLE campaign_summaries DROP CONSTRAINT IF EXISTS weekly_must_be_monday;
-- DELETE FROM campaign_summaries WHERE summary_type = 'weekly';
-- INSERT INTO campaign_summaries SELECT * FROM campaign_summaries_backup_20251118;
-- COMMIT;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==========================================================================';
  RAISE NOTICE '✅ WEEKLY DATA STANDARDIZATION COMPLETE';
  RAISE NOTICE '==========================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'What was done:';
  RAISE NOTICE '  1. ✅ Backed up all weekly data to campaign_summaries_backup_20251118';
  RAISE NOTICE '  2. ✅ Deleted non-Monday weekly records';
  RAISE NOTICE '  3. ✅ Added database constraint to enforce Monday-only dates';
  RAISE NOTICE '  4. ✅ Verified data quality';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Deploy updated collection code (uses getMondayOfWeek helper)';
  RAISE NOTICE '  2. Trigger incremental collection to fill missing weeks';
  RAISE NOTICE '  3. Run audit: npx tsx scripts/check-weekly-duplicates.ts';
  RAISE NOTICE '';
  RAISE NOTICE 'Backup table: campaign_summaries_backup_20251118';
  RAISE NOTICE '(Can be dropped after verifying everything works)';
  RAISE NOTICE '';
  RAISE NOTICE '==========================================================================';
END $$;

