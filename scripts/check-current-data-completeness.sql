-- Check what conversion metrics are actually stored for recent weeks
-- This will show us if funnel metrics are missing (0s or NULL)

SELECT 
  c.name AS client_name,
  cs.summary_date,
  cs.summary_type,
  cs.platform,
  
  -- Main metrics
  cs.total_spend,
  cs.total_impressions,
  cs.total_clicks,
  cs.total_conversions,
  
  -- Funnel metrics (these might be 0 or NULL)
  cs.click_to_call,
  cs.email_contacts,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  cs.reservations,
  cs.reservation_value,
  cs.roas,
  cs.cost_per_reservation,
  
  -- Check campaign_data structure
  jsonb_array_length(cs.campaign_data) AS campaign_count,
  
  -- Sample first campaign to see what fields it has
  cs.campaign_data->0->'booking_step_1' AS first_campaign_booking_step_1,
  cs.campaign_data->0->'reservations' AS first_campaign_reservations,
  cs.campaign_data->0->'reservation_value' AS first_campaign_reservation_value
  
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
  AND cs.summary_date >= '2025-11-01'  -- Recent weeks only
ORDER BY cs.summary_date DESC, c.name
LIMIT 20;

