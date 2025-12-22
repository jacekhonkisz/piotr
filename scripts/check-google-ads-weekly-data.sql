-- Check Google Ads weekly data completeness
-- This shows which clients have Google Ads configured and their weekly data status

SELECT 
  c.name AS client_name,
  c.google_ads_customer_id IS NOT NULL AS has_google_ads,
  COUNT(cs.id) FILTER (WHERE cs.platform = 'google' AND cs.summary_type = 'weekly') AS google_weekly_count,
  COUNT(cs.id) FILTER (WHERE cs.platform = 'meta' AND cs.summary_type = 'weekly') AS meta_weekly_count,
  CASE 
    WHEN c.google_ads_customer_id IS NOT NULL 
      AND COUNT(cs.id) FILTER (WHERE cs.platform = 'google' AND cs.summary_type = 'weekly') = 0 
    THEN 'NEEDS_COLLECTION'
    WHEN c.google_ads_customer_id IS NULL 
    THEN 'NOT_CONFIGURED'
    ELSE 'OK'
  END AS google_status
FROM clients c
LEFT JOIN campaign_summaries cs ON cs.client_id = c.id
  AND cs.summary_type = 'weekly'
  AND cs.summary_date >= '2025-09-01'  -- Last 3 months
GROUP BY c.id, c.name, c.google_ads_customer_id
ORDER BY google_status, c.name;



