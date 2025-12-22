-- Check current Belmonte weekly data status

SELECT 
  '📊 BELMONTE CURRENT STATUS' as check,
  COUNT(*) as total_weekly_records,
  COUNT(CASE WHEN DATE(cs.created_at) = CURRENT_DATE THEN 1 END) as created_today,
  COUNT(CASE WHEN DATE(cs.created_at) < CURRENT_DATE THEN 1 END) as created_before_today,
  MIN(cs.summary_date) as earliest_week,
  MAX(cs.summary_date) as latest_week,
  ROUND(SUM(cs.total_spend)::numeric, 2) as total_spend,
  SUM(cs.reservations) as reservations,
  SUM(cs.booking_step_1) as booking_step_1
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta';

-- Show detailed breakdown
SELECT 
  '📅 BELMONTE WEEKS DETAIL' as info,
  cs.summary_date,
  ROUND(cs.total_spend::numeric, 2) as spend,
  cs.reservations,
  cs.booking_step_1,
  DATE(cs.created_at) as created_date,
  TO_CHAR(cs.created_at, 'HH24:MI:SS') as created_time
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
ORDER BY cs.summary_date DESC;


