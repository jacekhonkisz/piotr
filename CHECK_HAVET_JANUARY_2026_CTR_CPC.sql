-- Check Havet's Meta Ads CTR and CPC for January 2026
-- This query checks both campaign_summaries and current_month_cache

-- Check campaign_summaries (archived monthly data)
SELECT 
  'campaign_summaries' as source,
  cs.summary_date,
  cs.total_spend,
  cs.total_impressions,
  cs.total_clicks,
  cs.average_ctr,
  cs.average_cpc,
  cs.platform,
  cs.data_source,
  cs.last_updated,
  CASE 
    WHEN cs.total_impressions > 0 
    THEN (cs.total_clicks::DECIMAL / cs.total_impressions::DECIMAL) * 100 
    ELSE 0 
  END as calculated_ctr,
  CASE 
    WHEN cs.total_clicks > 0 
    THEN cs.total_spend / cs.total_clicks::DECIMAL 
    ELSE 0 
  END as calculated_cpc
FROM campaign_summaries cs
WHERE cs.client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
  AND cs.summary_type = 'monthly'
  AND cs.summary_date = '2026-01-01'
  AND cs.platform = 'meta'
ORDER BY cs.last_updated DESC
LIMIT 1;

-- Also check current_month_cache (if January 2026 is current month)
SELECT 
  'current_month_cache' as source,
  cmc.client_id,
  cmc.total_spend,
  cmc.total_impressions,
  cmc.total_clicks,
  cmc.average_ctr,
  cmc.average_cpc,
  cmc.last_updated
FROM current_month_cache cmc
WHERE cmc.client_id = (SELECT id FROM clients WHERE LOWER(name) LIKE '%havet%' LIMIT 1)
ORDER BY cmc.last_updated DESC
LIMIT 1;

