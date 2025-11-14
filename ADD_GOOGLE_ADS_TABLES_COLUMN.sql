-- ADD MISSING google_ads_tables COLUMN TO campaign_summaries
-- 
-- CRITICAL FIX: This column is required for Google Ads weekly data collection
-- Without it, Google Ads weekly collection fails with:
-- "Could not find the 'google_ads_tables' column of 'campaign_summaries' in the schema cache"
--
-- Run this in Supabase SQL Editor

-- 1. Add the column (JSONB type, same as meta_tables)
ALTER TABLE campaign_summaries
ADD COLUMN IF NOT EXISTS google_ads_tables JSONB;

-- 2. Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'campaign_summaries'
  AND column_name IN ('meta_tables', 'google_ads_tables')
ORDER BY column_name;

-- Expected result:
-- google_ads_tables | jsonb | YES
-- meta_tables       | jsonb | YES



