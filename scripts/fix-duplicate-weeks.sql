-- FIX: Remove duplicate weekly summaries and add UNIQUE constraint
-- This will ensure weekly collection works properly with UPSERT logic

-- STEP 1: Identify and keep only the LATEST entry for each duplicate week
-- (We'll delete older entries and keep the most recent one)

BEGIN;

-- Create a temp table with IDs to DELETE (keep only the latest created_at for each unique week)
CREATE TEMP TABLE duplicate_weeks_to_delete AS
SELECT cs.id
FROM campaign_summaries cs
WHERE cs.summary_type = 'weekly'
  AND cs.id NOT IN (
    -- Keep only the LATEST entry for each unique (client_id, summary_date, platform) combination
    SELECT DISTINCT ON (client_id, summary_date, platform) id
    FROM campaign_summaries
    WHERE summary_type = 'weekly'
    ORDER BY client_id, summary_date, platform, created_at DESC
  );

-- Show what will be deleted (for review)
SELECT 
  cs.id,
  c.name as client_name,
  cs.summary_date,
  cs.platform,
  cs.total_spend,
  cs.reservations,
  cs.created_at
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.id IN (SELECT id FROM duplicate_weeks_to_delete)
ORDER BY c.name, cs.summary_date DESC
LIMIT 50;

-- COUNT how many will be deleted
SELECT 
  COUNT(*) as total_duplicates_to_delete,
  COUNT(DISTINCT cs.client_id) as affected_clients
FROM campaign_summaries cs
WHERE cs.id IN (SELECT id FROM duplicate_weeks_to_delete);

-- ⚠️ UNCOMMENT THE FOLLOWING LINES TO ACTUALLY DELETE DUPLICATES:
-- DELETE FROM campaign_summaries
-- WHERE id IN (SELECT id FROM duplicate_weeks_to_delete);

-- STEP 2: Add UNIQUE constraint to prevent future duplicates
-- ⚠️ UNCOMMENT THE FOLLOWING LINE AFTER DELETING DUPLICATES:
-- ALTER TABLE campaign_summaries
-- ADD CONSTRAINT unique_weekly_summary 
-- UNIQUE (client_id, summary_type, summary_date, platform);

ROLLBACK; -- Change to COMMIT after reviewing and uncommenting DELETE/ALTER

