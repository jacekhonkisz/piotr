-- DIAGNOSE: Are weekly reports showing monthly data or real weekly data?

-- ============================================================================
-- CHECK 1: Compare weekly vs monthly data for same period
-- ============================================================================

-- Get a specific week's data
SELECT 
  '📅 WEEKLY DATA (Week Nov 10-16)' as type,
  cs.summary_date,
  cs.total_spend,
  cs.total_clicks,
  cs.reservations,
  cs.booking_step_1,
  CASE 
    WHEN cs.campaign_data IS NOT NULL 
    THEN jsonb_array_length(cs.campaign_data::jsonb)
    ELSE 0
  END as campaign_count,
  cs.created_at
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.summary_date = '2025-11-10'  -- Week starting Nov 10
  AND cs.platform = 'meta';

-- Get November monthly data for comparison
SELECT 
  '📅 MONTHLY DATA (Nov 2025)' as type,
  cs.summary_date,
  cs.total_spend,
  cs.total_clicks,
  cs.reservations,
  cs.booking_step_1,
  CASE 
    WHEN cs.campaign_data IS NOT NULL 
    THEN jsonb_array_length(cs.campaign_data::jsonb)
    ELSE 0
  END as campaign_count,
  cs.created_at
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'monthly'
  AND cs.summary_date >= '2025-11-01'
  AND cs.summary_date < '2025-12-01'
  AND cs.platform = 'meta';

-- If weekly spend equals monthly spend, they're the same data!

-- ============================================================================
-- CHECK 2: Look at campaign_data to see actual date ranges
-- ============================================================================

-- Check if campaigns in weekly data have correct date ranges
SELECT 
  '🔍 WEEKLY CAMPAIGNS' as type,
  cs.summary_date as week_start,
  jsonb_array_length(cs.campaign_data::jsonb) as campaign_count,
  (cs.campaign_data::jsonb->0->>'campaign_name') as first_campaign_name,
  (cs.campaign_data::jsonb->0->>'spend') as first_campaign_spend,
  (cs.campaign_data::jsonb->0->>'date_start') as data_start,
  (cs.campaign_data::jsonb->0->>'date_stop') as data_stop
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.summary_date >= '2025-11-01'
  AND cs.platform = 'meta'
ORDER BY cs.summary_date DESC
LIMIT 5;

-- Check monthly campaigns for comparison
SELECT 
  '🔍 MONTHLY CAMPAIGNS' as type,
  cs.summary_date as month_start,
  jsonb_array_length(cs.campaign_data::jsonb) as campaign_count,
  (cs.campaign_data::jsonb->0->>'campaign_name') as first_campaign_name,
  (cs.campaign_data::jsonb->0->>'spend') as first_campaign_spend,
  (cs.campaign_data::jsonb->0->>'date_start') as data_start,
  (cs.campaign_data::jsonb->0->>'date_stop') as data_stop
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'monthly'
  AND cs.summary_date >= '2025-11-01'
  AND cs.platform = 'meta'
ORDER BY cs.summary_date DESC
LIMIT 1;

-- ============================================================================
-- CHECK 3: Sum all weeks in November vs monthly total
-- ============================================================================

SELECT 
  'Weeks in November (should be ~4 weeks)' as period,
  COUNT(*) as record_count,
  SUM(total_spend) as total_spend,
  SUM(reservations) as total_reservations,
  SUM(booking_step_1) as total_booking_step_1,
  MIN(summary_date) as first_week,
  MAX(summary_date) as last_week
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'weekly'
  AND cs.summary_date >= '2025-11-01'
  AND cs.summary_date < '2025-12-01'
  AND cs.platform = 'meta'

UNION ALL

SELECT 
  'November Monthly Total' as period,
  COUNT(*) as record_count,
  SUM(total_spend) as total_spend,
  SUM(reservations) as total_reservations,
  SUM(booking_step_1) as total_booking_step_1,
  MIN(summary_date) as first_week,
  MAX(summary_date) as last_week
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name ILIKE '%Belmonte%'
  AND cs.summary_type = 'monthly'
  AND cs.summary_date >= '2025-11-01'
  AND cs.summary_date < '2025-12-01'
  AND cs.platform = 'meta';

-- If sum of weeks ≈ monthly total, weekly data is correct
-- If they're identical, weekly is just copying monthly

-- ============================================================================
-- EXPECTED RESULTS
-- ============================================================================

/*
CORRECT SCENARIO:
- Weekly records show ~4 weeks for November
- Each week has different spend/metrics
- Sum of 4 weeks ≈ monthly total (should be close)
- campaign_data->date_start/date_stop show 7-day ranges

WRONG SCENARIO (what user is reporting):
- Weekly record shows same total as monthly
- All weeks show identical data
- campaign_data shows month-long date ranges (30 days instead of 7)
*/



