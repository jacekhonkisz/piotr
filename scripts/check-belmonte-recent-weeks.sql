-- Check what weekly data exists for Belmonte, especially recent weeks

-- 1. Summary of all Belmonte weekly data
SELECT 
  '📊 BELMONTE WEEKLY DATA SUMMARY' as info,
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

-- 2. Check if week 2025-11-10 exists (current week / week 46)
SELECT 
  '📅 CHECK WEEK 2025-11-10' as info,
  cs.summary_date,
  cs.total_spend,
  cs.reservations,
  cs.booking_step_1,
  DATE(cs.created_at) as created_date
FROM campaign_summaries cs
JOIN clients c ON cs.client_id = c.id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_date = '2025-11-10'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta';

-- 3. List all recent weeks (last 20)
SELECT 
  '📋 RECENT WEEKS (LAST 20)' as info,
  cs.summary_date,
  cs.total_spend,
  cs.reservations,
  cs.booking_step_1,
  DATE(cs.created_at) as created_date,
  TO_CHAR(cs.created_at, 'HH24:MI:SS') as created_time
FROM campaign_summaries cs
JOIN clients c ON cs.client_id = c.id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
ORDER BY cs.summary_date DESC
LIMIT 20;

-- 4. Check what weeks are missing (should have weeks up to 2025-11-10)
SELECT 
  '🔍 MISSING WEEKS CHECK' as info,
  COUNT(*) as weeks_before_nov10,
  MAX(summary_date) as latest_week_found,
  CASE 
    WHEN MAX(summary_date) < '2025-11-10' THEN '❌ Missing recent weeks'
    WHEN MAX(summary_date) = '2025-11-10' THEN '✅ Latest week found'
    ELSE '⚠️ Data beyond expected'
  END as status
FROM campaign_summaries cs
JOIN clients c ON cs.client_id = c.id
WHERE c.name = 'Belmonte Hotel'
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND cs.summary_date <= '2025-11-10';



