-- Verify if stored totals match the SUM of individual campaigns
-- This will catch any aggregation bugs

WITH campaign_sums AS (
  SELECT 
    summary_date,
    
    -- Stored totals
    booking_step_1 AS stored_total_step1,
    booking_step_2 AS stored_total_step2,
    booking_step_3 AS stored_total_step3,
    total_spend AS stored_total_spend,
    
    -- Calculate actual sum from campaign_data array
    (
      SELECT COALESCE(SUM((camp->>'booking_step_1')::float), 0)
      FROM jsonb_array_elements(campaign_data) AS camp
    ) AS calculated_step1,
    
    (
      SELECT COALESCE(SUM((camp->>'booking_step_2')::float), 0)
      FROM jsonb_array_elements(campaign_data) AS camp
    ) AS calculated_step2,
    
    (
      SELECT COALESCE(SUM((camp->>'booking_step_3')::float), 0)
      FROM jsonb_array_elements(campaign_data) AS camp
    ) AS calculated_step3,
    
    (
      SELECT COALESCE(SUM((camp->>'spend')::float), 0)
      FROM jsonb_array_elements(campaign_data) AS camp
    ) AS calculated_spend,
    
    jsonb_array_length(campaign_data) AS campaign_count
    
  FROM campaign_summaries
  WHERE client_id = (SELECT id FROM clients WHERE name = 'Belmonte Hotel' LIMIT 1)
    AND platform = 'meta'
    AND summary_type = 'weekly'
    AND summary_date >= '2025-11-01' 
    AND summary_date < '2025-12-01'
)
SELECT 
  summary_date,
  campaign_count,
  
  -- Stored vs Calculated
  stored_total_step1,
  calculated_step1,
  (stored_total_step1 - calculated_step1) AS step1_diff,
  
  stored_total_spend,
  calculated_spend,
  ROUND((stored_total_spend - calculated_spend)::numeric, 2) AS spend_diff,
  
  -- Status
  CASE 
    WHEN ABS(stored_total_step1 - calculated_step1) > 1 
    THEN '🔴 TOTALS_DONT_MATCH'
    WHEN campaign_count = 0
    THEN '⚠️ EMPTY_CAMPAIGNS'
    ELSE '✅ OK'
  END AS status
  
FROM campaign_sums
ORDER BY summary_date;

