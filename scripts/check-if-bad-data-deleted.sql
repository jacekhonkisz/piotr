-- Check if today's bad data was deleted

SELECT 
  '📊 WEEKLY DATA CREATED TODAY' as check,
  COUNT(*) as records_from_today,
  COUNT(DISTINCT client_id) as clients,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ ALL DELETED'
    ELSE '⚠️ STILL EXISTS'
  END as status
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND DATE(created_at) = CURRENT_DATE;

-- Show what exists if any
SELECT 
  '📅 REMAINING RECORDS (if any)' as info,
  c.name,
  cs.summary_date,
  ROUND(cs.total_spend::numeric, 2) as spend,
  cs.reservations,
  TO_CHAR(cs.created_at, 'HH24:MI:SS') as created_time
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
  AND DATE(cs.created_at) = CURRENT_DATE
ORDER BY cs.created_at DESC
LIMIT 10;



