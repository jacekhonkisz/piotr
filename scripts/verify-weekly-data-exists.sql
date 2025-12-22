-- Verify weekly data exists in campaign_summaries
-- Check Belmonte specifically and week 46

SELECT 
  '📊 BELMONTE WEEKLY DATA SUMMARY' as section,
  COUNT(*) as total_weeks,
  MIN(summary_date) as earliest_week,
  MAX(summary_date) as latest_week,
  SUM(total_spend) as total_spend,
  SUM(reservations) as total_reservations
FROM campaign_summaries cs
JOIN clients c ON cs.client_id = c.id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta';

-- Check specific week 46 data (2025-11-10)
SELECT 
  '📅 WEEK 46 DATA (2025-11-10)' as section,
  c.name,
  cs.summary_date,
  cs.summary_type,
  cs.platform,
  cs.total_spend,
  cs.total_impressions,
  cs.total_clicks,
  cs.reservations,
  cs.booking_step_1,
  cs.click_to_call,
  cs.email_contacts,
  DATE(cs.created_at) as created_date,
  TO_CHAR(cs.created_at, 'HH24:MI:SS') as created_time
FROM campaign_summaries cs
JOIN clients c ON cs.client_id = c.id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_date = '2025-11-10'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta';

-- List all weeks for Belmonte
SELECT 
  '📋 ALL BELMONTE WEEKS' as section,
  summary_date,
  total_spend,
  reservations,
  booking_step_1,
  DATE(cs.created_at) as created_date
FROM campaign_summaries cs
JOIN clients c ON cs.client_id = c.id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
ORDER BY summary_date DESC
LIMIT 20;

