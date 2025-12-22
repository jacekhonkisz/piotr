-- Inspect Belmonte Week 46 campaign data to see what Meta API actually returned
-- This will show us why booking_step_1 and booking_step_2 are 0

SELECT 
  -- Campaign info
  campaign->'campaign_name' AS campaign_name,
  campaign->'spend' AS spend,
  
  -- Parsed metrics (what we're storing)
  campaign->'booking_step_1' AS stored_booking_step_1,
  campaign->'booking_step_2' AS stored_booking_step_2,
  campaign->'booking_step_3' AS stored_booking_step_3,
  campaign->'reservations' AS stored_reservations,
  
  -- Raw actions from Meta API (if stored)
  campaign->'actions' AS raw_actions,
  campaign->'action_values' AS raw_action_values
  
FROM campaign_summaries cs
CROSS JOIN LATERAL jsonb_array_elements(cs.campaign_data) AS campaign
WHERE cs.client_id = (SELECT id FROM clients WHERE name = 'Belmonte Hotel' LIMIT 1)
  AND cs.summary_type = 'weekly'
  AND cs.summary_date = '2025-11-10'
  AND cs.platform = 'meta'
ORDER BY campaign->'spend' DESC
LIMIT 5;  -- Top 5 campaigns by spend



