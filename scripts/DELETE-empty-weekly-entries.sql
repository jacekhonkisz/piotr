-- DELETE EMPTY WEEKLY ENTRIES - IMMEDIATE FIX
-- 
-- This will DELETE all weekly Meta entries with empty campaign_data
-- so the incremental collection can re-populate them with complete data

-- Step 1: See what will be deleted
SELECT 
  c.name,
  cs.summary_date,
  cs.platform,
  jsonb_array_length(cs.campaign_data) AS campaigns,
  cs.total_spend,
  'WILL DELETE' AS action
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND jsonb_array_length(cs.campaign_data) = 0
ORDER BY cs.summary_date DESC;

-- Step 2: EXECUTE THIS TO DELETE (copy and run separately)
/*
DELETE FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND platform = 'meta'
  AND jsonb_array_length(campaign_data) = 0;

SELECT 'Deleted ' || COUNT(*) || ' empty weekly entries' AS result
FROM campaign_summaries
WHERE FALSE; -- This is just a placeholder
*/

-- After deleting, run: node scripts/trigger-complete-weekly-collection.js

