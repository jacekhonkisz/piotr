-- ============================================================================
-- FIX: Update NULL platform values to 'meta' for historical data
-- ============================================================================
-- This fixes records created before the platform column was added
-- ============================================================================

-- First, check how many records have NULL platform
SELECT 
  'BEFORE FIX - Records with NULL platform' as status,
  COUNT(*) as count,
  STRING_AGG(DISTINCT TO_CHAR(summary_date, 'YYYY-MM'), ', ') as months_affected
FROM campaign_summaries
WHERE platform IS NULL;

-- Update NULL platforms to 'meta' (since all old data is from Meta Ads)
UPDATE campaign_summaries
SET platform = 'meta'
WHERE platform IS NULL;

-- Verify the fix
SELECT 
  'AFTER FIX - Records with NULL platform' as status,
  COUNT(*) as count
FROM campaign_summaries
WHERE platform IS NULL;

-- Show September record after fix
SELECT 
  'SEPTEMBER AFTER FIX' as status,
  summary_date,
  platform,
  jsonb_array_length(COALESCE(campaign_data, '[]'::jsonb)) as campaigns_count,
  total_spend,
  total_impressions
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_date = '2025-09-01'
  AND summary_type = 'monthly';

