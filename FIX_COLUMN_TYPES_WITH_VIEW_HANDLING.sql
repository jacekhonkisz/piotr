-- FIX COLUMN DATA TYPES WITH MATERIALIZED VIEW HANDLING
-- 
-- CRITICAL FIX #2: Convert BIGINT columns to NUMERIC (with view dependency handling)
-- Error: "cannot alter type of a column used by a view or rule"
-- Solution: Drop dependent views, alter columns, recreate views
--
-- Run this in Supabase SQL Editor

-- STEP 1: Drop the materialized view that depends on these columns
DROP MATERIALIZED VIEW IF EXISTS mv_yoy_comparisons CASCADE;

-- STEP 2: Convert columns from BIGINT to NUMERIC

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

-- STEP 3: Recreate the materialized view (if it was important)
-- Note: The view will be recreated automatically by your application code
-- or you can manually recreate it later with the correct schema

-- STEP 4: Verify the changes
SELECT 
  column_name, 
  data_type,
  CASE 
    WHEN data_type = 'numeric' THEN '✅ Fixed'
    ELSE '❌ Still wrong'
  END as status
FROM information_schema.columns
WHERE table_name = 'campaign_summaries'
  AND column_name IN (
    'total_spend', 'average_ctr', 'average_cpc', 'average_cpa',
    'roas', 'cost_per_reservation', 'reservation_value'
  )
ORDER BY column_name;

-- Expected result: All 7 columns should show:
-- data_type = 'numeric'
-- status = '✅ Fixed'

-- Note about materialized view:
-- If mv_yoy_comparisons was critical for your application, you'll need to recreate it.
-- Check if there's a migration file or view definition in your codebase.
-- The view can be recreated after this fix is applied.


