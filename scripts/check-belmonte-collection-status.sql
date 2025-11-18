-- Check Belmonte Hotel weekly collection status
-- Run this in Supabase SQL Editor

-- 1. Find Belmonte client ID
SELECT 
  id,
  name,
  ad_account_id,
  meta_access_token IS NOT NULL as has_meta_token
FROM clients
WHERE name ILIKE '%belmonte%';

-- 2. Check what weekly data was collected recently
SELECT 
  cs.summary_date,
  cs.summary_type,
  cs.total_spend,
  cs.total_impressions,
  cs.total_clicks,
  cs.reservations,
  cs.booking_step_1,
  cs.booking_step_2,
  cs.reservation_value,
  cs.created_at
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.created_at > NOW() - INTERVAL '1 hour'
ORDER BY cs.summary_date DESC
LIMIT 20;

-- 3. Check total weekly summaries for Belmonte (all time)
SELECT 
  COUNT(*) as total_weeks,
  MIN(cs.summary_date) as earliest_week,
  MAX(cs.summary_date) as latest_week,
  SUM(cs.total_spend) as total_spend,
  SUM(cs.reservations) as total_reservations
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%belmonte%'
  AND cs.summary_type = 'weekly';

