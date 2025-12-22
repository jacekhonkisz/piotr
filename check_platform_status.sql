-- Check if platform fix was applied
SELECT 
  'Platform Status Check' as check_name,
  COUNT(*) FILTER (WHERE platform IS NULL) as null_platforms,
  COUNT(*) FILTER (WHERE platform = 'meta') as meta_platforms,
  COUNT(*) FILTER (WHERE platform = 'google') as google_platforms,
  COUNT(*) as total_records
FROM campaign_summaries;

-- Check September specifically
SELECT 
  'September Status' as check_name,
  client_id,
  summary_date,
  platform,
  jsonb_array_length(COALESCE(campaign_data, '[]'::jsonb)) as campaigns,
  total_spend
FROM campaign_summaries
WHERE summary_date = '2025-09-01'
  AND summary_type = 'monthly'
ORDER BY client_id;












