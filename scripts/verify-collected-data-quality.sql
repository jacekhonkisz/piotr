-- Verify the quality of newly collected weekly data
-- This checks if Meta API actions were properly parsed

SELECT 
  c.name AS client_name,
  cs.summary_date,
  cs.platform,
  
  -- Campaign data quality
  jsonb_array_length(cs.campaign_data) AS campaign_count,
  
  -- Main metrics
  cs.total_spend,
  cs.total_impressions,
  cs.total_clicks,
  
  -- ✅ Check if funnel metrics are PARSED (not 0)
  cs.click_to_call,
  cs.email_contacts,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.booking_step_3,
  cs.reservations,
  cs.reservation_value,
  cs.roas,
  
  -- Check if campaign-level data has parsed metrics
  cs.campaign_data->0->'booking_step_1' AS first_campaign_b1,
  cs.campaign_data->0->'reservations' AS first_campaign_res,
  
  -- Data quality indicator
  CASE 
    WHEN jsonb_array_length(cs.campaign_data) = 0 THEN '❌ EMPTY'
    WHEN cs.total_spend = 0 AND cs.total_impressions = 0 THEN '⚠️ NO_SPEND'
    WHEN cs.booking_step_1 = 0 AND cs.booking_step_2 = 0 AND cs.reservations = 0 THEN '⚠️ NO_CONVERSIONS'
    ELSE '✅ OK'
  END AS data_quality
  
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND cs.summary_date >= '2025-11-01'  -- Recent weeks only
ORDER BY cs.summary_date DESC, c.name
LIMIT 30;



