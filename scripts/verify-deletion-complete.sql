-- Verify all bad data from today is deleted

SELECT 
  '✅ DELETION VERIFICATION' as status,
  COUNT(*) as records_from_today,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ ALL CLEAN - READY FOR COLLECTION'
    ELSE '⚠️ STILL HAS RECORDS'
  END as result
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND DATE(created_at) = CURRENT_DATE;

-- Show current Belmonte weekly data status
SELECT 
  '📊 BELMONTE CURRENT STATUS' as info,
  COUNT(*) as total_weekly_records,
  MIN(summary_date) as earliest_week,
  MAX(summary_date) as latest_week,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_type = 'weekly';



