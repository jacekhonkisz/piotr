-- ============================================================================
-- DIAGNOSTIC: Check if past data actually exists in database
-- ============================================================================

-- 1. Check if campaign_summaries table has any data
SELECT 
  'Total records' as check_type,
  COUNT(*) as count,
  MIN(summary_date) as oldest_date,
  MAX(summary_date) as newest_date
FROM campaign_summaries;

-- 2. Check records by platform
SELECT 
  platform,
  summary_type,
  COUNT(*) as count,
  MIN(summary_date) as oldest_date,
  MAX(summary_date) as newest_date
FROM campaign_summaries
GROUP BY platform, summary_type
ORDER BY platform, summary_type;

-- 3. Check for specific client (replace with actual client_id)
-- SELECT 
--   summary_date,
--   summary_type,
--   platform,
--   total_spend,
--   total_impressions,
--   total_clicks,
--   total_conversions
-- FROM campaign_summaries
-- WHERE client_id = 'YOUR-CLIENT-ID-HERE'
-- ORDER BY summary_date DESC
-- LIMIT 10;

-- 4. Check table structure (columns)
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'campaign_summaries'
ORDER BY ordinal_position;

-- 5. Check unique constraint
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'campaign_summaries'::regclass;

-- 6. Check if there's data but query is failing
SELECT 
  client_id,
  COUNT(*) as total_records,
  COUNT(DISTINCT summary_date) as unique_dates,
  COUNT(DISTINCT platform) as platforms,
  SUM(total_spend) as total_spend_all
FROM campaign_summaries
GROUP BY client_id;
