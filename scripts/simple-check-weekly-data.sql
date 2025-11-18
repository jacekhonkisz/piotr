-- SIMPLE CHECK: Is there weekly data in campaign_summaries?
-- Run this in Supabase SQL Editor

-- Quick check
SELECT 
  COUNT(*) as weekly_records_exist
FROM campaign_summaries
WHERE summary_type = 'weekly';

-- If result is > 0: Data still exists
-- If result is 0: Data was deleted (reports should show "No data")

-- Detailed check
SELECT 
  c.name as client,
  cs.summary_date,
  cs.platform,
  cs.created_at
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
ORDER BY cs.created_at DESC
LIMIT 20;

-- This shows the most recent weekly records
-- Check the created_at date:
--   - If it's from before your deletion: deletion didn't work
--   - If it's from after your deletion: automatic collection ran

-- Complete purge command (if needed):
DELETE FROM campaign_summaries WHERE summary_type = 'weekly';

-- Then verify:
SELECT COUNT(*) FROM campaign_summaries WHERE summary_type = 'weekly';
-- Should return: 0

