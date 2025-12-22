-- Verify if the missing weeks are now in the database after re-collection

-- Check for the specific missing weeks
SELECT 
  '✅ CHECK MISSING WEEKS NOW' as check_step,
  cs.summary_date,
  cs.total_spend,
  cs.reservations,
  cs.booking_step_1,
  DATE(cs.created_at) as created_date,
  TO_CHAR(cs.created_at, 'HH24:MI:SS') as created_time
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND cs.summary_date IN ('2025-10-06', '2025-10-13', '2025-10-20', '2025-10-27', '2025-11-03', '2025-11-10')
ORDER BY cs.summary_date DESC;

-- Check the latest date now
SELECT 
  '📊 LATEST DATE CHECK' as check_step,
  MAX(cs.summary_date) as latest_date,
  COUNT(*) as total_records,
  CASE 
    WHEN MAX(cs.summary_date) >= '2025-11-10' THEN '✅ Recent weeks found'
    WHEN MAX(cs.summary_date) >= '2025-10-01' THEN '⚠️ Some recent weeks missing'
    ELSE '❌ Still missing recent weeks'
  END as status
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta';



