-- Clean up old Hotel Lambert data (54 weeks from 2024)
-- This is leftover data that should have been deleted

-- Check what will be deleted
SELECT 
  c.name,
  cs.summary_date,
  cs.platform,
  cs.total_spend,
  cs.created_at
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Lambert%'
  AND cs.summary_type = 'weekly'
  AND cs.summary_date < '2025-08-01'  -- Old data before August 2025
ORDER BY cs.summary_date DESC;

-- Delete old Lambert data
-- ⚠️ UNCOMMENT TO DELETE:

/*
DELETE FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%Lambert%')
  AND summary_type = 'weekly'
  AND summary_date < '2025-08-01';

-- Verify
SELECT 
  c.name,
  COUNT(*) as weeks_remaining,
  MIN(cs.summary_date) as oldest,
  MAX(cs.summary_date) as newest
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Lambert%'
  AND cs.summary_type = 'weekly'
GROUP BY c.name;
*/



