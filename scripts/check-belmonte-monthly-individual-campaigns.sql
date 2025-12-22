-- Check if MONTHLY November has booking_step_1/2 at INDIVIDUAL campaign level
-- Compare with weekly to see if it's a collection bug or data reality

SELECT 
  summary_type,
  summary_date,
  
  -- Totals
  booking_step_1 AS total_step1,
  booking_step_2 AS total_step2,
  booking_step_3 AS total_step3,
  
  -- First campaign's individual metrics
  (campaign_data->0->>'campaign_name') AS first_campaign,
  (campaign_data->0->>'booking_step_1')::float AS camp1_step1,
  (campaign_data->0->>'booking_step_2')::float AS camp1_step2,
  (campaign_data->0->>'booking_step_3')::float AS camp1_step3,
  
  -- Second campaign's individual metrics (to verify it's consistent)
  (campaign_data->1->>'campaign_name') AS second_campaign,
  (campaign_data->1->>'booking_step_1')::float AS camp2_step1,
  (campaign_data->1->>'booking_step_2')::float AS camp2_step2,
  (campaign_data->1->>'booking_step_3')::float AS camp2_step3,
  
  -- Status
  CASE 
    WHEN (campaign_data->0->>'booking_step_1')::float = 0 
     AND (campaign_data->0->>'booking_step_2')::float = 0 
     AND (campaign_data->0->>'booking_step_3')::float > 0
    THEN '⚠️ INDIVIDUAL_CAMPAIGNS_MISSING_STEP1_2'
    WHEN (campaign_data->0->>'booking_step_1')::float > 0 
    THEN '✅ CAMPAIGNS_HAVE_STEP1'
    ELSE '❓ OTHER'
  END AS individual_campaign_status
  
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE name = 'Belmonte Hotel' LIMIT 1)
  AND platform = 'meta'
  AND summary_date >= '2025-11-01' 
  AND summary_date < '2025-12-01'
ORDER BY summary_type DESC, summary_date;



