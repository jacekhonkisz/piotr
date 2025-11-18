-- Check which clients have Meta Ads configured and if their data is working

SELECT 
  c.name,
  c.ad_account_id IS NOT NULL AS has_ad_account,
  c.meta_access_token IS NOT NULL AS has_meta_token,
  
  -- Check if they have ANY successful weekly data
  COUNT(cs.id) FILTER (
    WHERE cs.platform = 'meta' 
    AND cs.summary_type = 'weekly'
    AND jsonb_array_length(cs.campaign_data) > 0
  ) AS weeks_with_data,
  
  -- Check empty weeks
  COUNT(cs.id) FILTER (
    WHERE cs.platform = 'meta' 
    AND cs.summary_type = 'weekly'
    AND jsonb_array_length(cs.campaign_data) = 0
  ) AS empty_weeks,
  
  CASE 
    WHEN c.meta_access_token IS NULL THEN '❌ NO_TOKEN'
    WHEN COUNT(cs.id) FILTER (
      WHERE cs.platform = 'meta' 
      AND cs.summary_type = 'weekly'
      AND jsonb_array_length(cs.campaign_data) > 0
    ) = 0 THEN '⚠️ TOKEN_EXPIRED_OR_NO_ADS'
    ELSE '✅ OK'
  END AS status

FROM clients c
LEFT JOIN campaign_summaries cs ON cs.client_id = c.id
  AND cs.summary_date >= '2025-09-01'
GROUP BY c.id, c.name, c.ad_account_id, c.meta_access_token
ORDER BY status, c.name;

