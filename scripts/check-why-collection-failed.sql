-- Check what actually happened during the collection
-- This will show if data was inserted at all in the last 10 minutes

SELECT 
  c.name,
  cs.summary_date,
  cs.platform,
  cs.created_at,
  jsonb_array_length(cs.campaign_data) AS campaign_count,
  cs.total_spend,
  'RECENTLY_CREATED' AS status
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND cs.created_at >= NOW() - INTERVAL '10 minutes'  -- Last 10 minutes
ORDER BY cs.created_at DESC
LIMIT 50;

-- If this returns 0 rows, the upsert is failing silently



