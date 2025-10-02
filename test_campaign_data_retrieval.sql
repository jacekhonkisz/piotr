-- Test what Supabase actually returns for campaign_data
SELECT 
  id,
  client_id,
  summary_date,
  campaign_data IS NULL as is_null,
  jsonb_typeof(campaign_data) as data_type,
  jsonb_array_length(campaign_data) as array_length,
  -- Show first element
  campaign_data->0->>'campaign_name' as first_campaign_name,
  campaign_data->0->>'spend' as first_campaign_spend
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_type = 'monthly'
  AND summary_date = '2025-09-01';

