-- Check what's actually in campaign_data for one client
SELECT 
  c.name as client_name,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as month,
  cs.total_spend,
  cs.total_impressions,
  cs.campaign_data IS NULL as is_null,
  jsonb_typeof(cs.campaign_data) as json_type,
  CASE 
    WHEN cs.campaign_data IS NOT NULL THEN jsonb_array_length(cs.campaign_data)
    ELSE NULL
  END as array_length,
  cs.data_source,
  cs.last_updated
FROM clients c
JOIN campaign_summaries cs ON cs.client_id = c.id
WHERE c.id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND cs.summary_type = 'monthly'
  AND cs.summary_date >= '2025-07-01'
ORDER BY cs.summary_date DESC;

-- Show first campaign if exists
SELECT 
  c.name,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as month,
  campaign->>'campaign_name' as campaign_name,
  campaign->>'spend' as spend,
  campaign->>'impressions' as impressions
FROM clients c
JOIN campaign_summaries cs ON cs.client_id = c.id
CROSS JOIN LATERAL jsonb_array_elements(cs.campaign_data) as campaign
WHERE c.id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND cs.summary_type = 'monthly'
  AND cs.summary_date = '2025-09-01'
LIMIT 5;

