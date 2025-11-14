-- Check September conversion metrics in campaign_summaries
SELECT 
  'SUMMARY LEVEL CONVERSIONS' as source,
  summary_date,
  platform,
  total_spend,
  total_impressions,
  -- Conversion metrics from summary
  click_to_call,
  email_contacts,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  roas,
  -- Campaign data
  jsonb_array_length(COALESCE(campaign_data, '[]'::jsonb)) as campaigns_count
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_date = '2025-09-01'
  AND summary_type = 'monthly';

-- Check if conversion data is in individual campaigns
SELECT 
  'CAMPAIGN LEVEL CONVERSIONS' as source,
  campaign->>'campaign_name' as campaign_name,
  (campaign->>'spend')::numeric as spend,
  (campaign->>'impressions')::bigint as impressions,
  campaign->>'click_to_call' as click_to_call,
  campaign->>'email_contacts' as email_contacts,
  campaign->>'booking_step_1' as booking_step_1,
  campaign->>'booking_step_2' as booking_step_2,
  campaign->>'reservations' as reservations,
  campaign->>'reservation_value' as reservation_value
FROM campaign_summaries,
  jsonb_array_elements(campaign_data) as campaign
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_date = '2025-09-01'
  AND summary_type = 'monthly'
LIMIT 3;

-- Compare with August
SELECT 
  'AUGUST CONVERSIONS' as source,
  summary_date,
  click_to_call,
  email_contacts,
  booking_step_1,
  booking_step_2,
  reservations,
  reservation_value,
  roas
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_date = '2025-08-01'
  AND summary_type = 'monthly';









