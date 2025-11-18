-- Check if Week 46 data exists in campaign_summaries
SELECT 
  period_id,
  COUNT(*) as campaign_count,
  SUM(spend) as total_spend,
  MIN(date_range_start) as start_date,
  MAX(date_range_end) as end_date
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND period_id = '2025-W46'
  AND period_type = 'weekly'
GROUP BY period_id;

-- Also check what weekly periods exist for November 2025
SELECT DISTINCT 
  period_id,
  period_type,
  COUNT(*) as campaigns,
  MIN(date_range_start) as start_date,
  MAX(date_range_end) as end_date
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND period_type = 'weekly'
  AND date_range_start >= '2025-11-01'
ORDER BY period_id DESC;
