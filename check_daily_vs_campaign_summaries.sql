-- Compare daily_kpi_data vs campaign_summaries for September

-- 1. Check daily_kpi_data
SELECT 
  'daily_kpi_data' as source,
  COUNT(*) as record_count,
  SUM(total_spend) as total_spend,
  SUM(total_impressions) as total_impressions,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM daily_kpi_data
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND date >= '2025-09-01'
  AND date <= '2025-09-30';

-- 2. Check campaign_summaries
SELECT 
  'campaign_summaries' as source,
  1 as record_count,
  total_spend,
  total_impressions,
  summary_date,
  jsonb_array_length(campaign_data) as campaigns_count,
  data_source
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_type = 'monthly'
  AND summary_date = '2025-09-01';

