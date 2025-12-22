-- DIAGNOSE: Why is Week 2025-11-03 so large and Week 2025-11-10 missing data?

-- Check what date ranges and campaigns are stored in each weekly summary
SELECT 
  summary_date,
  summary_type,
  
  -- Date range from campaign_data (first and last campaign)
  (campaign_data->0->>'date_start') AS first_campaign_date_start,
  (campaign_data->0->>'date_stop') AS first_campaign_date_stop,
  (campaign_data->(jsonb_array_length(campaign_data)-1)->>'date_start') AS last_campaign_date_start,
  (campaign_data->(jsonb_array_length(campaign_data)-1)->>'date_stop') AS last_campaign_date_stop,
  
  -- Totals
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  total_spend,
  
  -- Campaign count
  jsonb_array_length(campaign_data) AS campaign_count,
  
  -- Sample: First campaign's metrics
  (campaign_data->0->>'campaign_name') AS first_campaign_name,
  (campaign_data->0->>'booking_step_1')::float AS first_camp_step1,
  (campaign_data->0->>'booking_step_2')::float AS first_camp_step2,
  (campaign_data->0->>'booking_step_3')::float AS first_camp_step3,
  (campaign_data->0->>'reservations')::float AS first_camp_reservations,
  
  -- Status
  CASE 
    WHEN booking_step_1 = 0 AND booking_step_2 = 0 AND booking_step_3 > 0 
    THEN '⚠️ MISSING_STEP_1_2'
    WHEN booking_step_1 > 1000 
    THEN '🔴 SUSPICIOUSLY_HIGH_STEP_1'
    WHEN booking_step_1 > 0 AND booking_step_2 > 0 
    THEN '✅ OK'
    ELSE '❓ OTHER'
  END AS status
  
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE name = 'Belmonte Hotel' LIMIT 1)
  AND platform = 'meta'
  AND summary_type = 'weekly'
  AND summary_date >= '2025-11-01' 
  AND summary_date < '2025-12-01'
ORDER BY summary_date;



