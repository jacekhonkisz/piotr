-- Diagnose why weekly data is doubled/wrong
-- Check if the issue is with data source priority

WITH belmonte_data AS (
  SELECT 
    c.name,
    cs.summary_type,
    cs.summary_date,
    cs.platform,
    cs.total_spend,
    cs.reservations,
    cs.booking_step_1,
    cs.booking_step_2,
    cs.booking_step_3,
    cs.data_source,
    cs.created_at,
    -- Check if campaign_data has conversion metrics
    (SELECT SUM((camp->>'reservations')::numeric)
     FROM jsonb_array_elements(cs.campaign_data::jsonb) AS camp
    ) as campaign_data_reservations,
    (SELECT SUM((camp->>'booking_step_1')::numeric)
     FROM jsonb_array_elements(cs.campaign_data::jsonb) AS camp
    ) as campaign_data_booking_step_1
  FROM campaign_summaries cs
  JOIN clients c ON c.id = cs.client_id
  WHERE c.name ILIKE '%Belmonte%'
    AND cs.summary_date >= '2025-11-01'
    AND cs.platform = 'meta'
  ORDER BY cs.summary_type, cs.summary_date DESC
)
SELECT 
  name,
  summary_type,
  summary_date,
  total_spend,
  reservations,
  booking_step_1,
  data_source,
  campaign_data_reservations,
  campaign_data_booking_step_1,
  CASE 
    WHEN campaign_data_reservations > 0 AND reservations != campaign_data_reservations 
    THEN '⚠️ MISMATCH: campaign_data vs stored metrics'
    WHEN campaign_data_reservations = 0 AND reservations > 0 
    THEN '✅ Used daily_kpi_data fallback (correct)'
    WHEN campaign_data_reservations > 0 AND reservations = campaign_data_reservations 
    THEN '✅ Used Meta API (correct)'
    ELSE '❓ Unknown'
  END as diagnostic,
  DATE(created_at) as created_date
FROM belmonte_data
ORDER BY summary_type, summary_date DESC;

-- Summary
SELECT 
  '📊 SUMMARY' as info,
  summary_type,
  COUNT(*) as records,
  SUM(total_spend) as total_spend,
  SUM(reservations) as total_reservations,
  SUM(booking_step_1) as total_booking_step_1
FROM belmonte_data
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY summary_type;



