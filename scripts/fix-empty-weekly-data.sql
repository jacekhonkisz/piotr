-- FIX EMPTY WEEKLY DATA
-- 
-- Problem: Many weekly entries have campaign_count = 0 (empty campaign_data arrays)
-- This prevents incremental collection from re-collecting these weeks
-- 
-- Solution: DELETE entries with empty or invalid campaign_data
-- Then trigger incremental collection to re-populate with complete data

BEGIN;

-- Show what will be deleted (for safety)
SELECT 
  c.name AS client_name,
  cs.summary_date,
  cs.summary_type,
  cs.platform,
  jsonb_array_length(cs.campaign_data) AS campaign_count,
  cs.total_spend,
  cs.total_impressions,
  'WILL BE DELETED' AS status
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
  AND cs.platform = 'meta'  -- Only fix Meta data (Google is fine)
  AND (
    -- Empty campaign_data array
    jsonb_array_length(cs.campaign_data) = 0
    OR cs.campaign_data = '[]'::jsonb
    OR cs.campaign_data IS NULL
    -- OR zero spend with zero campaigns (likely empty)
    OR (cs.total_spend = 0 AND jsonb_array_length(cs.campaign_data) = 0)
  )
ORDER BY cs.summary_date DESC, c.name;

-- UNCOMMENT THE FOLLOWING LINES TO ACTUALLY DELETE:
-- (Review the SELECT results first!)

/*
DELETE FROM campaign_summaries
WHERE id IN (
  SELECT cs.id
  FROM campaign_summaries cs
  WHERE cs.summary_type = 'weekly'
    AND cs.platform = 'meta'
    AND (
      jsonb_array_length(cs.campaign_data) = 0
      OR cs.campaign_data = '[]'::jsonb
      OR cs.campaign_data IS NULL
      OR (cs.total_spend = 0 AND jsonb_array_length(cs.campaign_data) = 0)
    )
);
*/

COMMIT;

-- After running this:
-- 1. Review the SELECT results
-- 2. If they look correct, uncomment the DELETE section
-- 3. Run again to actually delete
-- 4. Trigger incremental collection: node scripts/trigger-complete-weekly-collection.js

