-- Inspect ALL campaigns in Week 2025-11-03 to understand the massive numbers

SELECT 
  summary_date,
  
  -- Extract ALL campaigns with their individual metrics
  jsonb_array_length(campaign_data) AS total_campaigns,
  
  -- Show each campaign
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'name', camp->>'campaign_name',
        'spend', (camp->>'spend')::float,
        'step1', (camp->>'booking_step_1')::float,
        'step2', (camp->>'booking_step_2')::float,
        'step3', (camp->>'booking_step_3')::float,
        'reservations', (camp->>'reservations')::float
      )
      ORDER BY (camp->>'booking_step_1')::float DESC
    )
    FROM jsonb_array_elements(campaign_data) AS camp
  ) AS all_campaigns_ordered_by_step1,
  
  -- Summary stats
  booking_step_1 AS total_step1,
  booking_step_2 AS total_step2,
  booking_step_3 AS total_step3,
  total_spend,
  reservations AS total_reservations
  
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE name = 'Belmonte Hotel' LIMIT 1)
  AND platform = 'meta'
  AND summary_type = 'weekly'
  AND summary_date = '2025-11-03';

