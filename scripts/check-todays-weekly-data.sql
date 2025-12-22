-- Quick check: Is there any weekly data created today that needs deletion?

SELECT 
  '📊 WEEKLY DATA CREATED TODAY' as check_type,
  DATE(created_at) as creation_date,
  COUNT(*) as records,
  COUNT(DISTINCT client_id) as clients,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend,
  SUM(reservations) as reservations,
  MIN(summary_date) as earliest_week,
  MAX(summary_date) as latest_week
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND DATE(created_at) = CURRENT_DATE
GROUP BY DATE(created_at);

-- If no results, then no data to delete - proceed directly to re-collection



