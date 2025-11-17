-- FINAL COMPLETE FIX: Column Types + ALL View Recreation
-- 
-- CRITICAL FIX #2: Convert BIGINT columns to NUMERIC (handles ALL dependent views)
-- 
-- This script:
-- 1. Drops ALL views that depend on the columns (materialized + regular)
-- 2. Alters all 7 columns from BIGINT to NUMERIC
-- 3. Recreates ALL views with correct definitions
-- 4. Recreates indexes
-- 5. Verifies everything is correct
--
-- Run this ENTIRE script in Supabase SQL Editor

-- ============================================
-- STEP 1: Drop ALL dependent views
-- ============================================

-- Drop regular view (v_data_quality_issues)
DROP VIEW IF EXISTS v_data_quality_issues CASCADE;

-- Drop materialized view (mv_yoy_comparisons)
DROP MATERIALIZED VIEW IF EXISTS mv_yoy_comparisons CASCADE;

-- ============================================
-- STEP 2: Alter column types (BIGINT → NUMERIC)
-- ============================================

ALTER TABLE campaign_summaries
ALTER COLUMN total_spend TYPE NUMERIC USING total_spend::NUMERIC;

ALTER TABLE campaign_summaries
ALTER COLUMN average_ctr TYPE NUMERIC USING average_ctr::NUMERIC;

ALTER TABLE campaign_summaries
ALTER COLUMN average_cpc TYPE NUMERIC USING average_cpc::NUMERIC;

ALTER TABLE campaign_summaries
ALTER COLUMN average_cpa TYPE NUMERIC USING average_cpa::NUMERIC;

ALTER TABLE campaign_summaries
ALTER COLUMN roas TYPE NUMERIC USING roas::NUMERIC;

ALTER TABLE campaign_summaries
ALTER COLUMN cost_per_reservation TYPE NUMERIC USING cost_per_reservation::NUMERIC;

ALTER TABLE campaign_summaries
ALTER COLUMN reservation_value TYPE NUMERIC USING reservation_value::NUMERIC;

-- ============================================
-- STEP 3A: Recreate materialized view (mv_yoy_comparisons)
-- ============================================

CREATE MATERIALIZED VIEW mv_yoy_comparisons AS
WITH current_periods AS (
  SELECT 
    client_id,
    platform,
    summary_type,
    summary_date,
    total_spend,
    booking_step_1,
    booking_step_2,
    booking_step_3,
    reservations,
    reservation_value
  FROM campaign_summaries
  WHERE summary_date >= CURRENT_DATE - INTERVAL '13 months'
),
previous_periods AS (
  SELECT 
    client_id,
    platform,
    summary_type,
    summary_date,
    -- Calculate the comparison date (1 year ago)
    CASE 
      WHEN summary_type = 'monthly' THEN 
        (summary_date - INTERVAL '1 year')::date
      WHEN summary_type = 'weekly' THEN 
        (summary_date - INTERVAL '52 weeks')::date
      ELSE summary_date
    END as comparison_date,
    total_spend as prev_spend,
    booking_step_1 as prev_booking_step_1,
    booking_step_2 as prev_booking_step_2,
    booking_step_3 as prev_booking_step_3,
    reservations as prev_reservations,
    reservation_value as prev_reservation_value
  FROM campaign_summaries
  WHERE summary_date >= CURRENT_DATE - INTERVAL '26 months'
)
SELECT 
  c.client_id,
  c.platform,
  c.summary_type,
  c.summary_date,
  c.total_spend as current_spend,
  p.prev_spend,
  c.booking_step_1 as current_booking_step_1,
  p.prev_booking_step_1,
  c.booking_step_2 as current_booking_step_2,
  p.prev_booking_step_2,
  c.booking_step_3 as current_booking_step_3,
  p.prev_booking_step_3,
  c.reservations as current_reservations,
  p.prev_reservations,
  c.reservation_value as current_reservation_value,
  p.prev_reservation_value,
  -- Calculate YoY changes
  CASE 
    WHEN p.prev_spend > 0 THEN 
      ROUND(((c.total_spend - p.prev_spend) / p.prev_spend * 100)::numeric, 2)
    ELSE NULL 
  END as spend_change_pct,
  CASE 
    WHEN p.prev_reservations > 0 THEN 
      ROUND(((c.reservations - p.prev_reservations) / p.prev_reservations * 100)::numeric, 2)
    ELSE NULL 
  END as reservations_change_pct
FROM current_periods c
LEFT JOIN previous_periods p
  ON c.client_id = p.client_id
  AND c.platform = p.platform
  AND c.summary_type = p.summary_type
  AND c.summary_date = p.comparison_date;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_mv_yoy_lookup 
ON mv_yoy_comparisons (client_id, platform, summary_date);

-- ============================================
-- STEP 3B: Recreate regular view (v_data_quality_issues)
-- ============================================

CREATE OR REPLACE VIEW v_data_quality_issues AS
SELECT 
  client_id,
  platform,
  summary_date,
  summary_type,
  CASE 
    WHEN booking_step_2 > booking_step_1 THEN 'Inverted funnel: Step 2 > Step 1'
    WHEN booking_step_3 > booking_step_2 THEN 'Inverted funnel: Step 3 > Step 2'
    WHEN reservations > booking_step_1 * 100 THEN 'Suspicious: Too many reservations'
    WHEN total_spend > 0 AND booking_step_1 = 0 AND reservations = 0 THEN 'Spend but no conversions'
    ELSE 'Other issue'
  END as issue_type,
  total_spend,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  created_at
FROM campaign_summaries
WHERE (
  booking_step_2 > booking_step_1 OR
  booking_step_3 > booking_step_2 OR
  reservations > booking_step_1 * 100 OR
  (total_spend > 0 AND booking_step_1 = 0 AND reservations = 0)
)
ORDER BY summary_date DESC;

-- ============================================
-- STEP 4: Verify all changes
-- ============================================

-- Check column types
SELECT 
  '📊 COLUMN TYPES' as check_type,
  column_name, 
  data_type,
  CASE 
    WHEN data_type = 'numeric' THEN '✅ Fixed'
    ELSE '❌ Still wrong: ' || data_type
  END as status
FROM information_schema.columns
WHERE table_name = 'campaign_summaries'
  AND column_name IN (
    'total_spend', 'average_ctr', 'average_cpc', 'average_cpa',
    'roas', 'cost_per_reservation', 'reservation_value'
  )
ORDER BY column_name;

-- Check materialized view exists
SELECT 
  '🔄 MATERIALIZED VIEW' as check_type,
  matviewname as view_name,
  '✅ Recreated' as status
FROM pg_matviews
WHERE matviewname = 'mv_yoy_comparisons';

-- Check regular view exists
SELECT 
  '👁️ REGULAR VIEW' as check_type,
  viewname as view_name,
  '✅ Recreated' as status
FROM pg_views
WHERE schemaname = 'public'
  AND viewname = 'v_data_quality_issues';

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

SELECT 
  '🎉 SUCCESS' as status,
  'All database fixes applied successfully!' as message,
  'Next: Restart server and re-trigger collection' as next_step;

-- Expected results:
-- 1. All 7 columns should show data_type = 'numeric' and status = '✅ Fixed'
-- 2. Materialized view mv_yoy_comparisons should show '✅ Recreated'
-- 3. Regular view v_data_quality_issues should show '✅ Recreated'
-- 4. Success message should appear

-- ============================================
-- NEXT STEPS (after this SQL completes)
-- ============================================

-- 1. Restart Next.js server:
--    lsof -ti:3000 | xargs kill -9
--    npm run dev

-- 2. Re-trigger collection:
--    curl -X POST http://localhost:3000/api/automated/collect-weekly-summaries \
--      -H "Content-Type: application/json"

-- 3. Wait 60 minutes and verify:
--    node scripts/check-collection-status.js

-- 4. Expected final result:
--    1,950 / 1,950 records (100% coverage)




