-- COMPLETE FIX: Column Types + Materialized View Recreation
-- 
-- CRITICAL FIX #2: Convert BIGINT columns to NUMERIC (complete with view handling)
-- 
-- This script:
-- 1. Drops the materialized view that blocks the column changes
-- 2. Alters all 7 columns from BIGINT to NUMERIC
-- 3. Recreates the materialized view with the correct definition
-- 4. Recreates the index on the view
-- 5. Verifies everything is correct
--
-- Run this ENTIRE script in Supabase SQL Editor

-- ============================================
-- STEP 1: Drop dependent materialized view
-- ============================================

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
-- STEP 3: Recreate materialized view
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

-- ============================================
-- STEP 4: Recreate index on materialized view
-- ============================================

CREATE INDEX IF NOT EXISTS idx_mv_yoy_lookup 
ON mv_yoy_comparisons (client_id, platform, summary_date);

-- ============================================
-- STEP 5: Verify the changes
-- ============================================

-- Check column types
SELECT 
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
  schemaname,
  matviewname,
  CASE 
    WHEN matviewname = 'mv_yoy_comparisons' THEN '✅ View recreated'
    ELSE 'View name'
  END as status
FROM pg_matviews
WHERE matviewname = 'mv_yoy_comparisons';

-- Expected results:
-- 1. All 7 columns should show data_type = 'numeric' and status = '✅ Fixed'
-- 2. Materialized view should show status = '✅ View recreated'

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

-- If you see this message, the fix was successful!
-- Next steps:
-- 1. Restart your Next.js server (so it picks up the new schema)
-- 2. Re-trigger collection: curl -X POST http://localhost:3000/api/automated/collect-weekly-summaries
-- 3. Wait 60 minutes for collection to complete
-- 4. Verify 1,950 total records (100% coverage)

