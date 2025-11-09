-- Force Supabase PostgREST to reload the schema cache
-- Run this in Supabase SQL Editor

-- Send notification to PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- Verify columns are NUMERIC (should show numeric, not bigint)
SELECT 
  '🔍 COLUMN TYPES' as check,
  column_name,
  data_type,
  CASE 
    WHEN data_type = 'numeric' THEN '✅ Correct'
    WHEN data_type = 'bigint' THEN '❌ Wrong - still BIGINT!'
    ELSE '⚠️ Unexpected type'
  END as status
FROM information_schema.columns
WHERE table_name = 'campaign_summaries'
  AND column_name IN ('total_spend', 'average_cpc', 'average_ctr', 'average_cpa', 'roas', 'cost_per_reservation', 'reservation_value')
ORDER BY column_name;

-- Test insert with decimal value
-- This will FAIL if schema cache is still using BIGINT
INSERT INTO campaign_summaries (
  client_id,
  summary_type,
  summary_date,
  platform,
  total_spend,
  average_cpc
) VALUES (
  'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa',
  'monthly',
  '2099-01-01',  -- Far future date to avoid conflicts
  'google',
  55.973622,  -- DECIMAL VALUE - will fail if BIGINT
  1.234567
)
ON CONFLICT (client_id, summary_type, summary_date, platform) 
DO UPDATE SET total_spend = 55.973622;

-- Clean up test record
DELETE FROM campaign_summaries 
WHERE summary_date = '2099-01-01' 
  AND client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

-- Final confirmation
SELECT 
  '✅ SCHEMA CACHE REFRESHED' as status,
  'Decimal values accepted' as result;

