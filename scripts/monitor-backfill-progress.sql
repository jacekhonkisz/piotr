-- ============================================================================
-- MONITOR: Historical CTR/CPC Backfill Progress
-- ============================================================================
-- Run this to check progress of the backfill script
-- ============================================================================

-- 1. Overall Progress Summary
SELECT 
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' as section,
  '' as metric,
  '' as value
UNION ALL
SELECT 
  '📊 OVERALL PROGRESS SUMMARY',
  '',
  ''
UNION ALL
SELECT 
  '  Total Meta Summaries',
  COUNT(*)::text,
  ''
FROM campaign_summaries
WHERE platform = 'meta'
UNION ALL
SELECT 
  '  Updated Last Hour',
  COUNT(CASE WHEN last_updated > NOW() - INTERVAL '1 hour' THEN 1 END)::text,
  ''
FROM campaign_summaries
WHERE platform = 'meta'
UNION ALL
SELECT 
  '  Updated Last 24 Hours',
  COUNT(CASE WHEN last_updated > NOW() - INTERVAL '24 hours' THEN 1 END)::text,
  ''
FROM campaign_summaries
WHERE platform = 'meta'
UNION ALL
SELECT 
  '  Has CTR Value (> 0)',
  COUNT(CASE WHEN average_ctr > 0 THEN 1 END)::text,
  ''
FROM campaign_summaries
WHERE platform = 'meta'
UNION ALL
SELECT 
  '  Has CPC Value (> 0)',
  COUNT(CASE WHEN average_cpc > 0 THEN 1 END)::text,
  ''
FROM campaign_summaries
WHERE platform = 'meta'
UNION ALL
SELECT 
  '  Average CTR',
  ROUND(AVG(average_ctr), 2)::text || '%',
  ''
FROM campaign_summaries
WHERE platform = 'meta' AND average_ctr > 0
UNION ALL
SELECT 
  '  Average CPC',
  ROUND(AVG(average_cpc), 2)::text || ' zł',
  ''
FROM campaign_summaries
WHERE platform = 'meta' AND average_cpc > 0;

-- 2. Per-Client Progress
SELECT 
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' as section,
  '' as metric,
  '' as value
UNION ALL
SELECT 
  '📋 PER-CLIENT PROGRESS',
  '',
  ''
UNION ALL
SELECT 
  '  Client',
  c.name,
  ''
FROM clients c
WHERE EXISTS (
  SELECT 1 FROM campaign_summaries cs 
  WHERE cs.client_id = c.id AND cs.platform = 'meta'
)
ORDER BY c.name
LIMIT 1
UNION ALL
SELECT 
  '    Total Summaries',
  COUNT(*)::text,
  ''
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'meta'
GROUP BY c.id, c.name
ORDER BY c.name
LIMIT 1
UNION ALL
SELECT 
  '    Updated Recently',
  COUNT(CASE WHEN cs.last_updated > NOW() - INTERVAL '1 hour' THEN 1 END)::text,
  ''
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'meta'
GROUP BY c.id, c.name
ORDER BY c.name
LIMIT 1
UNION ALL
SELECT 
  '    Has CTR/CPC',
  COUNT(CASE WHEN cs.average_ctr > 0 AND cs.average_cpc > 0 THEN 1 END)::text,
  ''
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'meta'
GROUP BY c.id, c.name
ORDER BY c.name
LIMIT 1;

-- 3. Detailed Per-Client Breakdown
WITH client_stats AS (
  SELECT 
    c.id,
    c.name,
    COUNT(*) as total_summaries,
    COUNT(CASE WHEN cs.last_updated > NOW() - INTERVAL '1 hour' THEN 1 END) as updated_recently,
    COUNT(CASE WHEN cs.average_ctr > 0 THEN 1 END) as has_ctr,
    COUNT(CASE WHEN cs.average_cpc > 0 THEN 1 END) as has_cpc,
    COUNT(CASE WHEN cs.average_ctr > 0 AND cs.average_cpc > 0 THEN 1 END) as has_both,
    AVG(cs.average_ctr) as avg_ctr,
    AVG(cs.average_cpc) as avg_cpc,
    MIN(cs.summary_date) as earliest_date,
    MAX(cs.summary_date) as latest_date
  FROM campaign_summaries cs
  JOIN clients c ON c.id = cs.client_id
  WHERE cs.platform = 'meta'
  GROUP BY c.id, c.name
)
SELECT 
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' as section,
  '' as metric,
  '' as value
UNION ALL
SELECT 
  '📊 DETAILED PER-CLIENT BREAKDOWN',
  '',
  ''
UNION ALL
SELECT 
  '  Client',
  cs.name,
  ''
FROM client_stats cs
ORDER BY cs.name
LIMIT 1
UNION ALL
SELECT 
  '    Total Summaries',
  cs.total_summaries::text,
  ''
FROM client_stats cs
ORDER BY cs.name
LIMIT 1
UNION ALL
SELECT 
  '    Updated Recently (last hour)',
  cs.updated_recently::text,
  ''
FROM client_stats cs
ORDER BY cs.name
LIMIT 1
UNION ALL
SELECT 
  '    Has CTR',
  cs.has_ctr::text || ' / ' || cs.total_summaries::text,
  ''
FROM client_stats cs
ORDER BY cs.name
LIMIT 1
UNION ALL
SELECT 
  '    Has CPC',
  cs.has_cpc::text || ' / ' || cs.total_summaries::text,
  ''
FROM client_stats cs
ORDER BY cs.name
LIMIT 1
UNION ALL
SELECT 
  '    Has Both CTR & CPC',
  cs.has_both::text || ' / ' || cs.total_summaries::text,
  ''
FROM client_stats cs
ORDER BY cs.name
LIMIT 1
UNION ALL
SELECT 
  '    Average CTR',
  ROUND(cs.avg_ctr, 2)::text || '%',
  ''
FROM client_stats cs
WHERE cs.avg_ctr > 0
ORDER BY cs.name
LIMIT 1
UNION ALL
SELECT 
  '    Average CPC',
  ROUND(cs.avg_cpc, 2)::text || ' zł',
  ''
FROM client_stats cs
WHERE cs.avg_cpc > 0
ORDER BY cs.name
LIMIT 1
UNION ALL
SELECT 
  '    Date Range',
  cs.earliest_date::text || ' to ' || cs.latest_date::text,
  ''
FROM client_stats cs
ORDER BY cs.name
LIMIT 1;

-- 4. Recent Updates (Last Hour)
SELECT 
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' as section,
  '' as metric,
  '' as value
UNION ALL
SELECT 
  '🔄 RECENT UPDATES (Last Hour)',
  '',
  ''
UNION ALL
SELECT 
  '  Client',
  c.name,
  ''
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'meta'
  AND cs.last_updated > NOW() - INTERVAL '1 hour'
ORDER BY cs.last_updated DESC
LIMIT 1
UNION ALL
SELECT 
  '    Period',
  cs.summary_type || ' ' || cs.summary_date::text,
  ''
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'meta'
  AND cs.last_updated > NOW() - INTERVAL '1 hour'
ORDER BY cs.last_updated DESC
LIMIT 1
UNION ALL
SELECT 
  '    CTR',
  ROUND(cs.average_ctr, 2)::text || '%',
  ''
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'meta'
  AND cs.last_updated > NOW() - INTERVAL '1 hour'
ORDER BY cs.last_updated DESC
LIMIT 1
UNION ALL
SELECT 
  '    CPC',
  ROUND(cs.average_cpc, 2)::text || ' zł',
  ''
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'meta'
  AND cs.last_updated > NOW() - INTERVAL '1 hour'
ORDER BY cs.last_updated DESC
LIMIT 1
UNION ALL
SELECT 
  '    Updated At',
  cs.last_updated::text,
  ''
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'meta'
  AND cs.last_updated > NOW() - INTERVAL '1 hour'
ORDER BY cs.last_updated DESC
LIMIT 1;

-- 5. Summaries Still Needing Update
SELECT 
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' as section,
  '' as metric,
  '' as value
UNION ALL
SELECT 
  '⚠️  SUMMARIES STILL NEEDING UPDATE',
  '',
  ''
UNION ALL
SELECT 
  '  Count',
  COUNT(*)::text,
  ''
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'meta'
  AND (cs.average_ctr = 0 OR cs.average_cpc = 0)
  AND (cs.total_spend > 0 OR cs.total_impressions > 0)
UNION ALL
SELECT 
  '  Client',
  c.name,
  ''
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'meta'
  AND (cs.average_ctr = 0 OR cs.average_cpc = 0)
  AND (cs.total_spend > 0 OR cs.total_impressions > 0)
ORDER BY cs.summary_date DESC
LIMIT 1
UNION ALL
SELECT 
  '    Period',
  cs.summary_type || ' ' || cs.summary_date::text,
  ''
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'meta'
  AND (cs.average_ctr = 0 OR cs.average_cpc = 0)
  AND (cs.total_spend > 0 OR cs.total_impressions > 0)
ORDER BY cs.summary_date DESC
LIMIT 1
UNION ALL
SELECT 
  '    Spend',
  cs.total_spend::text || ' zł',
  ''
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'meta'
  AND (cs.average_ctr = 0 OR cs.average_cpc = 0)
  AND (cs.total_spend > 0 OR cs.total_impressions > 0)
ORDER BY cs.summary_date DESC
LIMIT 1;

