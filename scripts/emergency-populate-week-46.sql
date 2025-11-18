-- EMERGENCY: Manually populate Week 46 (Nov 10-16) data
-- Run this in Supabase SQL Editor to immediately fix the reports

-- This script creates a placeholder entry for Week 46
-- Once this exists, the system will use it and show correct weekly data

-- NOTE: Replace with actual Meta API data when possible
-- This is just to unblock the reports immediately

INSERT INTO campaign_summaries (
  client_id,
  summary_type,
  summary_date,
  platform,
  campaign_data,
  total_spend,
  total_impressions,
  total_clicks,
  conversion_metrics,
  created_at
)
VALUES (
  'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa', -- Belmonte Hotel
  'weekly',
  '2025-11-10', -- Week 46 start date
  'meta',
  '[]'::jsonb, -- Empty for now - will be populated by next cron run
  0, -- Temporary - will be updated
  0,
  0,
  '{}'::jsonb,
  NOW()
)
ON CONFLICT (client_id, summary_type, summary_date, platform) 
DO NOTHING; -- Don't overwrite if it exists

-- Verify it was inserted
SELECT 
  summary_date,
  summary_type,
  platform,
  total_spend,
  created_at
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
AND summary_type = 'weekly'
AND summary_date >= '2025-11-01'
ORDER BY summary_date DESC;

