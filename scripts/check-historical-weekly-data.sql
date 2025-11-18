-- CHECK HISTORICAL WEEKLY DATA ONLY
-- Focus: campaign_summaries table (where reports get historical data)
-- Ignore: current_week_cache (that's for current week only)

-- ============================================================================
-- CHECK 1: How much historical weekly data exists?
-- ============================================================================

SELECT 
  '📊 HISTORICAL WEEKLY DATA' as source,
  COUNT(*) as total_records,
  COUNT(DISTINCT client_id) as clients,
  COUNT(*) FILTER (WHERE platform = 'meta') as meta_records,
  COUNT(*) FILTER (WHERE platform = 'google') as google_records,
  MIN(summary_date) as earliest,
  MAX(summary_date) as latest
FROM campaign_summaries
WHERE summary_type = 'weekly';

-- This is what historical reports use!
-- Expected after your deletion: 0 or very few recent records

-- ============================================================================
-- CHECK 2: Show sample of historical weekly data
-- ============================================================================

SELECT 
  c.name as client,
  cs.summary_date as week_start,
  TO_CHAR(cs.summary_date, 'Dy DD.MM') as day_date,
  cs.platform,
  cs.total_spend,
  cs.reservations,
  TO_CHAR(cs.created_at, 'DD.MM HH24:MI') as created
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
ORDER BY cs.created_at DESC
LIMIT 20;

-- Check the 'created' column:
-- - If dates are OLD (before today): Deletion didn't work
-- - If dates are TODAY: Automatic collection ran after deletion

-- ============================================================================
-- CHECK 3: Data by creation date
-- ============================================================================

SELECT 
  DATE(created_at) as when_created,
  COUNT(*) as records,
  MIN(summary_date) as oldest_week,
  MAX(summary_date) as newest_week
FROM campaign_summaries
WHERE summary_type = 'weekly'
GROUP BY DATE(created_at)
ORDER BY when_created DESC;

-- This shows WHEN the weekly data was created
-- If you see today's date: automatic collection ran!

-- ============================================================================
-- CHECK 4: Monday vs Non-Monday breakdown
-- ============================================================================

SELECT 
  CASE 
    WHEN EXTRACT(DOW FROM summary_date) = 1 THEN '✅ Monday (correct)'
    ELSE '❌ Non-Monday (wrong)'
  END as week_start_day,
  COUNT(*) as record_count,
  ARRAY_AGG(DISTINCT summary_date ORDER BY summary_date DESC) as sample_dates
FROM campaign_summaries
WHERE summary_type = 'weekly'
GROUP BY EXTRACT(DOW FROM summary_date)
ORDER BY record_count DESC;

-- Shows if you have any non-Monday weeks left

