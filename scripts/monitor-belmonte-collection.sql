-- Monitor Belmonte's 53-week collection progress

SELECT 
  '📊 COLLECTION PROGRESS' as status,
  COUNT(*) as weeks_collected,
  53 as total_weeks_needed,
  ROUND(COUNT(*)::numeric / 53.0 * 100, 1) as progress_pct,
  MIN(summary_date) as earliest_week,
  MAX(summary_date) as latest_week
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND cs.created_at >= CURRENT_DATE;

-- Show recent weeks collected
SELECT 
  '📅 RECENT WEEKS COLLECTED' as info,
  cs.summary_date,
  ROUND(cs.total_spend::numeric, 2) as spend,
  cs.reservations,
  cs.booking_step_1,
  TO_CHAR(cs.created_at, 'HH24:MI:SS') as collected_at
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND cs.created_at >= CURRENT_DATE
ORDER BY cs.summary_date DESC
LIMIT 10;

-- Check for any duplicate weeks (should be 0)
SELECT 
  '🔍 DUPLICATE CHECK' as check,
  cs.summary_date,
  COUNT(*) as duplicate_count
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND cs.created_at >= CURRENT_DATE
GROUP BY cs.summary_date
HAVING COUNT(*) > 1;



