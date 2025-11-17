-- 🔍 FUNNEL AUDIT SQL QUERIES
-- Date: November 5, 2025
-- Purpose: Verify data source consistency for year-over-year comparisons

-- ============================================
-- STEP 0: Find Belmonte's Client ID
-- ============================================

SELECT 
  id,
  name,
  email,
  ad_account_id,
  reporting_frequency
FROM clients
WHERE name ILIKE '%belmonte%' OR name ILIKE '%hotel%'
ORDER BY name;

-- Copy the 'id' value from the result above and use it in the queries below


-- ============================================
-- STEP 1: Check Current Month daily_kpi_data
-- ============================================
-- Purpose: Verify if real conversion data exists for November 2025

SELECT 
  DATE(date) as collection_date,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  total_conversions,
  data_source,
  created_at
FROM daily_kpi_data
WHERE client_id = 'PASTE_CLIENT_ID_HERE'  -- ⬅️ Replace with actual UUID from Step 0
  AND date >= '2025-11-01'
  AND data_source = 'meta_api'
ORDER BY date DESC;

-- ✅ EXPECTED: 5 records (Nov 1-5) with non-zero conversion values
-- ❌ IF MISSING/ZERO: System is using ESTIMATES (causing the 99% drop issue!)


-- ============================================
-- STEP 2: Check Previous Year campaign_summaries
-- ============================================
-- Purpose: Verify historical data for November 2024

SELECT 
  summary_date,
  summary_type,
  platform,
  total_spend,
  total_conversions,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  reservation_value,
  created_at,
  updated_at
FROM campaign_summaries
WHERE client_id = 'PASTE_CLIENT_ID_HERE'  -- ⬅️ Replace with actual UUID from Step 0
  AND summary_date = '2024-11-01'
  AND summary_type = 'monthly'
  AND platform = 'meta'
ORDER BY created_at DESC;

-- ✅ EXPECTED: 1 record with large conversion values (e.g., 25,000+ bookings)
-- ❌ IF MISSING: No historical data to compare against


-- ============================================
-- STEP 3: Compare Data Sources (Advanced)
-- ============================================
-- Purpose: See the actual difference between current and historical data

WITH current_month AS (
  SELECT 
    'November 2025 (Current)' as period,
    'daily_kpi_data' as data_source,
    SUM(booking_step_1) as total_step_1,
    SUM(booking_step_2) as total_step_2,
    SUM(booking_step_3) as total_step_3,
    SUM(reservations) as total_reservations,
    COUNT(*) as days_of_data
  FROM daily_kpi_data
  WHERE client_id = 'PASTE_CLIENT_ID_HERE'  -- ⬅️ Replace with actual UUID
    AND date >= '2025-11-01'
    AND date <= '2025-11-05'
    AND data_source = 'meta_api'
),
previous_year AS (
  SELECT 
    'November 2024 (Previous)' as period,
    'campaign_summaries' as data_source,
    booking_step_1 as total_step_1,
    booking_step_2 as total_step_2,
    booking_step_3 as total_step_3,
    reservations as total_reservations,
    NULL as days_of_data
  FROM campaign_summaries
  WHERE client_id = 'PASTE_CLIENT_ID_HERE'  -- ⬅️ Replace with actual UUID
    AND summary_date = '2024-11-01'
    AND summary_type = 'monthly'
    AND platform = 'meta'
  LIMIT 1
)
SELECT 
  period,
  data_source,
  total_step_1,
  total_step_2,
  total_step_3,
  total_reservations,
  days_of_data,
  -- Calculate year-over-year change
  CASE 
    WHEN LAG(total_step_1) OVER (ORDER BY period DESC) > 0 THEN
      ROUND(((total_step_1 - LAG(total_step_1) OVER (ORDER BY period DESC)) / 
             LAG(total_step_1) OVER (ORDER BY period DESC)::numeric * 100), 1)
    ELSE NULL
  END as step_1_yoy_change_percent
FROM (
  SELECT * FROM current_month
  UNION ALL
  SELECT * FROM previous_year
) combined
ORDER BY period DESC;

-- 🎯 This will show you EXACTLY what data is being compared


-- ============================================
-- STEP 4: Check ALL Historical Months
-- ============================================
-- Purpose: See all available historical data

SELECT 
  summary_date,
  summary_type,
  platform,
  total_spend,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  CASE 
    WHEN booking_step_1 = 0 AND booking_step_2 = 0 AND booking_step_3 = 0 
    THEN '❌ MISSING CONVERSIONS'
    ELSE '✅ HAS CONVERSIONS'
  END as data_quality
FROM campaign_summaries
WHERE client_id = 'PASTE_CLIENT_ID_HERE'  -- ⬅️ Replace with actual UUID
  AND platform = 'meta'
ORDER BY summary_date DESC
LIMIT 12;  -- Last 12 months

-- This shows which months have good historical data


-- ============================================
-- STEP 5: Check Daily Collection Status
-- ============================================
-- Purpose: Verify if daily collection job is working

SELECT 
  DATE(date) as collection_date,
  COUNT(*) as records_collected,
  SUM(total_spend) as daily_spend,
  SUM(total_conversions) as daily_conversions,
  SUM(booking_step_1) as daily_step_1,
  MAX(created_at) as last_collection_time,
  STRING_AGG(DISTINCT data_source, ', ') as sources
FROM daily_kpi_data
WHERE client_id = 'PASTE_CLIENT_ID_HERE'  -- ⬅️ Replace with actual UUID
  AND date >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY DATE(date)
ORDER BY collection_date DESC;

-- ✅ EXPECTED: One record per day, collected daily
-- ❌ IF MISSING: Daily collection job not running!


-- ============================================
-- STEP 6: Find Latest Data Collection
-- ============================================
-- Purpose: When was the last time data was collected?

SELECT 
  'daily_kpi_data' as table_name,
  MAX(date) as latest_data_date,
  MAX(created_at) as latest_collection_time,
  NOW() - MAX(created_at) as time_since_last_collection
FROM daily_kpi_data
WHERE client_id = 'PASTE_CLIENT_ID_HERE'  -- ⬅️ Replace with actual UUID

UNION ALL

SELECT 
  'campaign_summaries' as table_name,
  MAX(summary_date) as latest_data_date,
  MAX(created_at) as latest_collection_time,
  NOW() - MAX(created_at) as time_since_last_collection
FROM campaign_summaries
WHERE client_id = 'PASTE_CLIENT_ID_HERE';  -- ⬅️ Replace with actual UUID

-- Shows freshness of your data


-- ============================================
-- INTERPRETATION GUIDE
-- ============================================

/*

SCENARIO 1: Current month HAS daily_kpi_data ✅
  → Step 1 returns 5 records with non-zero conversions
  → System is using REAL data for current month
  → YoY comparison SHOULD be accurate (if using same source)

SCENARIO 2: Current month MISSING daily_kpi_data ❌
  → Step 1 returns 0 records OR all zeros
  → System falls back to ESTIMATES
  → YoY comparison is WRONG (estimates vs real historical data)
  → THIS IS YOUR 99% DROP PROBLEM!

SCENARIO 3: Historical data MISSING ⚠️
  → Step 2 returns 0 records
  → No data to compare against
  → YoY comparison should be disabled

NEXT STEPS BASED ON RESULTS:

IF SCENARIO 2 (Missing current data):
  1. Check if daily collection job is running
  2. Manually trigger data collection
  3. Verify Meta API credentials
  4. Check background-data-collector logs

IF SCENARIO 1 (Has current data):
  1. Verify YoY API is using daily_kpi_data for both periods
  2. Check if attribution windows are consistent
  3. Run Step 3 query to see actual comparison

*/





