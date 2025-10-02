-- ============================================================================
-- VERIFY AND FIX - Run this in Supabase before deploying
-- ============================================================================

-- Step 1: Fix NULL platforms
UPDATE campaign_summaries 
SET platform = 'meta' 
WHERE platform IS NULL;

-- Step 2: Verify September data
SELECT 
  'September Verification' as check_name,
  summary_date,
  platform,
  jsonb_array_length(COALESCE(campaign_data, '[]'::jsonb)) as campaigns,
  total_spend
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_date = '2025-09-01'
  AND summary_type = 'monthly';

-- Step 3: Check how many clients have August data
SELECT 
  'August Coverage' as check_name,
  COUNT(DISTINCT client_id) as clients_with_august_data,
  SUM(jsonb_array_length(COALESCE(campaign_data, '[]'::jsonb))) as total_campaigns
FROM campaign_summaries
WHERE summary_date = '2025-08-01'
  AND summary_type = 'monthly'
  AND platform = 'meta';

