-- Check if data exists for week 46 (2025-W46)
-- Week 46 should correspond to Monday 2025-11-10

SELECT 
  '📅 WEEK 46 DATA CHECK' as info,
  c.name as client_name,
  cs.summary_date,
  cs.summary_type,
  cs.platform,
  cs.total_spend,
  cs.reservations,
  cs.booking_step_1,
  DATE(cs.created_at) as created_date
FROM campaign_summaries cs
JOIN clients c ON cs.client_id = c.id
WHERE cs.summary_type = 'weekly'
  AND cs.summary_date >= '2025-11-10'
  AND cs.summary_date <= '2025-11-16'
ORDER BY cs.summary_date DESC, c.name;

-- Also check what weeks are available
SELECT 
  '📊 AVAILABLE WEEKLY DATA' as info,
  COUNT(*) as total_records,
  MIN(summary_date) as earliest_week,
  MAX(summary_date) as latest_week,
  COUNT(DISTINCT client_id) as num_clients
FROM campaign_summaries
WHERE summary_type = 'weekly';



