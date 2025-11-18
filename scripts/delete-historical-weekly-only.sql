-- DELETE HISTORICAL WEEKLY DATA ONLY
-- This removes ONLY historical weekly summaries from campaign_summaries
-- Does NOT touch: current_week_cache, current_month_cache, monthly data

-- ============================================================================
-- STEP 1: BACKUP (Safety first!)
-- ============================================================================

CREATE TABLE IF NOT EXISTS historical_weekly_backup AS
SELECT * FROM campaign_summaries
WHERE summary_type = 'weekly';

-- Verify backup
SELECT 
  '✅ BACKUP CREATED' as status,
  COUNT(*) as records_backed_up
FROM historical_weekly_backup;

-- ============================================================================
-- STEP 2: PREVIEW what will be deleted
-- ============================================================================

-- Count by client
SELECT 
  c.name as client_name,
  COUNT(*) as weekly_records_to_delete,
  MIN(cs.summary_date) as oldest,
  MAX(cs.summary_date) as newest
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
GROUP BY c.name
ORDER BY weekly_records_to_delete DESC;

-- Total count
SELECT 
  '⚠️ WILL DELETE' as action,
  COUNT(*) as total_historical_weekly_records
FROM campaign_summaries
WHERE summary_type = 'weekly';

-- ============================================================================
-- STEP 3: DELETE HISTORICAL WEEKLY DATA
-- ============================================================================

-- ⚠️ UNCOMMENT TO DELETE:

/*
BEGIN;

DELETE FROM campaign_summaries
WHERE summary_type = 'weekly';

-- Verify deletion
SELECT 
  '✅ DELETED' as status,
  COUNT(*) as remaining_weekly_records
FROM campaign_summaries
WHERE summary_type = 'weekly';
-- Expected: 0

COMMIT;
*/

-- ============================================================================
-- STEP 4: VERIFY WHAT'S LEFT
-- ============================================================================

-- Check what remains in campaign_summaries
SELECT 
  summary_type,
  COUNT(*) as count,
  MIN(summary_date) as earliest,
  MAX(summary_date) as latest
FROM campaign_summaries
GROUP BY summary_type
ORDER BY summary_type;

-- Should show ONLY 'monthly', NOT 'weekly'

-- ============================================================================
-- STEP 5: ADD PROTECTION (Run AFTER deletion)
-- ============================================================================

-- ⚠️ UNCOMMENT AFTER DELETION:

/*
-- Add constraint to enforce Monday-only dates
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
-- ROLLBACK (if needed)
-- ============================================================================

/*
BEGIN;
DELETE FROM campaign_summaries WHERE summary_type = 'weekly';
INSERT INTO campaign_summaries SELECT * FROM historical_weekly_backup;
COMMIT;
*/

