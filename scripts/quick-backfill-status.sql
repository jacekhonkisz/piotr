-- ============================================================================
-- QUICK STATUS: Historical CTR/CPC Backfill Progress
-- ============================================================================
-- Quick check of backfill progress
-- ============================================================================

-- Overall Status
SELECT 
  COUNT(*) as total_meta_summaries,
  COUNT(CASE WHEN last_updated > NOW() - INTERVAL '1 hour' THEN 1 END) as updated_last_hour,
  COUNT(CASE WHEN last_updated > NOW() - INTERVAL '24 hours' THEN 1 END) as updated_last_24h,
  COUNT(CASE WHEN average_ctr > 0 AND average_cpc > 0 THEN 1 END) as has_both_values,
  COUNT(CASE WHEN (average_ctr = 0 OR average_cpc = 0) AND (total_spend > 0 OR total_impressions > 0) THEN 1 END) as needs_update
FROM campaign_summaries
WHERE platform = 'meta';

-- Per-Client Status
SELECT 
  c.name as client,
  COUNT(*) as total,
  COUNT(CASE WHEN cs.last_updated > NOW() - INTERVAL '1 hour' THEN 1 END) as updated_recently,
  COUNT(CASE WHEN cs.average_ctr > 0 AND cs.average_cpc > 0 THEN 1 END) as has_values,
  COUNT(CASE WHEN (cs.average_ctr = 0 OR cs.average_cpc = 0) AND (cs.total_spend > 0 OR cs.total_impressions > 0) THEN 1 END) as needs_update,
  ROUND(AVG(cs.average_ctr), 2) as avg_ctr,
  ROUND(AVG(cs.average_cpc), 2) as avg_cpc
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'meta'
GROUP BY c.id, c.name
ORDER BY c.name;

-- Recent Updates (Last 10)
SELECT 
  c.name as client,
  cs.summary_type,
  cs.summary_date,
  ROUND(cs.average_ctr, 2) as ctr,
  ROUND(cs.average_cpc, 2) as cpc,
  cs.last_updated
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'meta'
  AND cs.last_updated > NOW() - INTERVAL '1 hour'
ORDER BY cs.last_updated DESC
LIMIT 10;

