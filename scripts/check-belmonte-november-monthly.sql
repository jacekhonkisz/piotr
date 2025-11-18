-- Check if Belmonte's November MONTHLY data has booking_step_1 and booking_step_2

SELECT 
  summary_type,
  summary_date,
  
  -- Funnel metrics
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  
  -- Total spend for context
  total_spend,
  
  -- Campaign count
  jsonb_array_length(campaign_data) AS campaign_count,
  
  -- Check first campaign's raw actions (if stored)
  campaign_data->0->'actions' AS first_campaign_raw_actions,
  
  -- Status
  CASE 
    WHEN booking_step_1 = 0 AND booking_step_2 = 0 
    THEN '❌ MISSING_STEP_1_2'
    WHEN booking_step_1 > 0 AND booking_step_2 > 0 
    THEN '✅ HAS_STEP_1_2'
    ELSE '⚠️ PARTIAL'
  END AS funnel_status
  
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE name = 'Belmonte Hotel' LIMIT 1)
  AND platform = 'meta'
  AND summary_date >= '2025-11-01' 
  AND summary_date < '2025-12-01'  -- November 2025 (both weekly and monthly)
ORDER BY summary_type DESC, summary_date;

