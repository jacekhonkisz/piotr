-- ============================================================================
-- VERIFY: Historical CTR/CPC Updates
-- ============================================================================
-- This query checks how many historical summaries have been updated
-- and shows the distribution of CTR/CPC values
-- ============================================================================

-- 1. Summary of updates
SELECT 
  'SUMMARY' as check_type,
  COUNT(*) as total_summaries,
  COUNT(CASE WHEN last_updated > NOW() - INTERVAL '1 hour' THEN 1 END) as updated_last_hour,
  COUNT(CASE WHEN last_updated > NOW() - INTERVAL '24 hours' THEN 1 END) as updated_last_24h,
  COUNT(CASE WHEN average_ctr > 0 THEN 1 END) as has_ctr,
  COUNT(CASE WHEN average_cpc > 0 THEN 1 END) as has_cpc,
  AVG(average_ctr) as avg_ctr,
  AVG(average_cpc) as avg_cpc
FROM campaign_summaries
WHERE platform = 'meta';

-- 2. Per-client summary
SELECT 
  c.name as client_name,
  COUNT(*) as total_summaries,
  COUNT(CASE WHEN cs.last_updated > NOW() - INTERVAL '1 hour' THEN 1 END) as updated_recently,
  COUNT(CASE WHEN cs.average_ctr > 0 THEN 1 END) as has_ctr,
  COUNT(CASE WHEN cs.average_cpc > 0 THEN 1 END) as has_cpc,
  AVG(cs.average_ctr) as avg_ctr,
  AVG(cs.average_cpc) as avg_cpc,
  MIN(cs.summary_date) as earliest_date,
  MAX(cs.summary_date) as latest_date
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'meta'
GROUP BY c.id, c.name
ORDER BY c.name;

-- 3. Recent updates (last hour)
SELECT 
  c.name as client_name,
  cs.summary_type,
  cs.summary_date,
  cs.average_ctr,
  cs.average_cpc,
  cs.last_updated
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'meta'
  AND cs.last_updated > NOW() - INTERVAL '1 hour'
ORDER BY cs.last_updated DESC
LIMIT 20;

-- 4. Summaries that still need updating (zero values)
SELECT 
  c.name as client_name,
  cs.summary_type,
  cs.summary_date,
  cs.average_ctr,
  cs.average_cpc,
  cs.total_spend,
  cs.total_impressions,
  cs.total_clicks
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'meta'
  AND (cs.average_ctr = 0 OR cs.average_cpc = 0)
  AND (cs.total_spend > 0 OR cs.total_impressions > 0)
ORDER BY cs.summary_date DESC
LIMIT 20;

