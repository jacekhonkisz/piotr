-- Quick check: Belmonte weekly data status

SELECT 
  COUNT(*) as weekly_records,
  MIN(cs.summary_date) as earliest,
  MAX(cs.summary_date) as latest,
  ROUND(SUM(cs.total_spend)::numeric, 2) as total_spend,
  SUM(cs.reservations) as reservations,
  SUM(cs.booking_step_1) as booking_step_1,
  CASE 
    WHEN SUM(cs.reservations) > 0 OR SUM(cs.booking_step_1) > 0 
    THEN '✅ HAS CONVERSIONS' 
    ELSE '❌ NO CONVERSIONS' 
  END as conversion_status
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta';



