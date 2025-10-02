-- Check if September record has correct platform field

SELECT 
  summary_date,
  platform,
  CASE 
    WHEN platform IS NULL THEN '❌ NULL - This is the problem!'
    WHEN platform = 'meta' THEN '✅ Correct'
    ELSE '⚠️ Wrong value: ' || platform
  END as platform_status,
  jsonb_array_length(COALESCE(campaign_data, '[]'::jsonb)) as campaigns_count,
  total_spend,
  data_source,
  last_updated
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_date = '2025-09-01'
  AND summary_type = 'monthly';

-- This will show if the platform field is NULL or has wrong value
-- If platform is NULL, the query `.eq('platform', 'meta')` won't find it!

