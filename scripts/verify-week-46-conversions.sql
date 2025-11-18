-- Check if Week 46 has conversion metrics in database
SELECT 
  summary_date,
  summary_type,
  platform,
  total_spend,
  total_impressions,
  total_clicks,
  total_conversions,
  -- Conversion funnel metrics
  click_to_call,
  email_contacts,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  roas,
  cost_per_reservation,
  reach,
  -- Campaign count
  COALESCE(jsonb_array_length(campaign_data::jsonb), 0) as campaign_count
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND summary_type = 'weekly'
  AND platform = 'meta'
  AND summary_date = '2025-11-10';
