-- Quick verification: Check if newly collected data has conversion metrics

SELECT 
  '🔍 NEWLY COLLECTED DATA (Today)' as check_type,
  c.name as client_name,
  cs.summary_date,
  cs.platform,
  ROUND(cs.total_spend::numeric, 2) as spend,
  cs.total_impressions as impressions,
  cs.reservations,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  CASE 
    WHEN cs.reservations > 0 OR cs.booking_step_1 > 0 THEN '✅ HAS CONVERSIONS'
    WHEN cs.total_spend > 0 THEN '⚠️ SPEND BUT NO CONVERSIONS'
    ELSE '⚪ NO SPEND'
  END as conversion_status,
  TO_CHAR(cs.created_at, 'HH24:MI:SS') as created_time
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
  AND DATE(cs.created_at) = CURRENT_DATE
ORDER BY cs.created_at DESC
LIMIT 20;

-- Summary of today's collection
SELECT 
  '📊 TODAY COLLECTION SUMMARY' as info,
  COUNT(*) as records_created,
  COUNT(DISTINCT client_id) as clients,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend,
  SUM(reservations) as total_reservations,
  SUM(booking_step_1) as total_booking_step_1,
  COUNT(CASE WHEN reservations > 0 OR booking_step_1 > 0 THEN 1 END) as with_conversions,
  COUNT(CASE WHEN total_spend > 0 AND reservations = 0 AND booking_step_1 = 0 THEN 1 END) as spend_no_conversions,
  ROUND(100.0 * COUNT(CASE WHEN reservations > 0 OR booking_step_1 > 0 THEN 1 END) / NULLIF(COUNT(*), 0), 1) || '%' as conversion_rate
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND DATE(created_at) = CURRENT_DATE;



