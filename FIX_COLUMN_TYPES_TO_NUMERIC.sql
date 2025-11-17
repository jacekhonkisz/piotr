-- FIX COLUMN DATA TYPES IN campaign_summaries
-- 
-- CRITICAL FIX #2: Convert BIGINT columns to NUMERIC to support decimal values
-- Error: "invalid input syntax for type bigint: "33.973622""
--
-- These columns store monetary values and percentages (decimals), not integers
--
-- Run this in Supabase SQL Editor

-- 1. Convert total_spend from BIGINT to NUMERIC
ALTER TABLE campaign_summaries
ALTER COLUMN total_spend TYPE NUMERIC USING total_spend::NUMERIC;

-- 2. Convert average_ctr from BIGINT to NUMERIC
ALTER TABLE campaign_summaries
ALTER COLUMN average_ctr TYPE NUMERIC USING average_ctr::NUMERIC;

-- 3. Convert average_cpc from BIGINT to NUMERIC
ALTER TABLE campaign_summaries
ALTER COLUMN average_cpc TYPE NUMERIC USING average_cpc::NUMERIC;

-- 4. Convert average_cpa from BIGINT to NUMERIC
ALTER TABLE campaign_summaries
ALTER COLUMN average_cpa TYPE NUMERIC USING average_cpa::NUMERIC;

-- 5. Convert roas (Return on Ad Spend) from BIGINT to NUMERIC
ALTER TABLE campaign_summaries
ALTER COLUMN roas TYPE NUMERIC USING roas::NUMERIC;

-- 6. Convert cost_per_reservation from BIGINT to NUMERIC
ALTER TABLE campaign_summaries
ALTER COLUMN cost_per_reservation TYPE NUMERIC USING cost_per_reservation::NUMERIC;

-- 7. Convert reservation_value from BIGINT to NUMERIC
ALTER TABLE campaign_summaries
ALTER COLUMN reservation_value TYPE NUMERIC USING reservation_value::NUMERIC;

-- 8. Verify the changes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'campaign_summaries'
  AND column_name IN (
    'total_spend', 'average_ctr', 'average_cpc', 'average_cpa',
    'roas', 'cost_per_reservation', 'reservation_value'
  )
ORDER BY column_name;

-- Expected result: All 7 columns should show data_type = 'numeric'




