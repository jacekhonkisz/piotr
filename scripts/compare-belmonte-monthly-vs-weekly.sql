-- Compare Belmonte's monthly vs weekly data for November 2025
-- This will show if the 0s are consistent across both periods

SELECT 
  summary_type,
  summary_date,
  platform,
  
  -- Main metrics
  total_spend,
  total_impressions,
  total_clicks,
  
  -- Funnel metrics
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  roas,
  
  -- Campaign count
  jsonb_array_length(campaign_data) AS campaign_count,
  
  -- Status
  CASE 
    WHEN booking_step_1 = 0 AND booking_step_2 = 0 AND booking_step_3 > 0 
    THEN '⚠️ MISSING_STEP_1_2'
    WHEN booking_step_1 > 0 AND booking_step_2 > 0 AND booking_step_3 > 0 
    THEN '✅ COMPLETE_FUNNEL'
    ELSE '❓ OTHER'
  END AS funnel_status
  
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE name = 'Belmonte Hotel' LIMIT 1)
  AND platform = 'meta'
  AND summary_date >= '2025-11-01'
ORDER BY summary_type, summary_date;



