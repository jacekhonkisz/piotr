-- ============================================================================
-- Check what data ACTUALLY exists and in what format
-- ============================================================================

-- 1. What summary_types exist?
SELECT 
  summary_type,
  COUNT(*) as count
FROM campaign_summaries
WHERE platform = 'meta'
GROUP BY summary_type;

-- 2. Sample of recent Meta monthly data (what dates are stored?)
SELECT 
  summary_date,
  summary_type,
  platform,
  client_id,
  total_spend,
  total_impressions,
  total_clicks
FROM campaign_summaries
WHERE platform = 'meta'
  AND summary_type = 'monthly'
ORDER BY summary_date DESC
LIMIT 20;

-- 3. Check if dates are EXACTLY first day of month
SELECT 
  summary_date,
  EXTRACT(DAY FROM summary_date) as day_of_month,
  COUNT(*) as count
FROM campaign_summaries
WHERE platform = 'meta'
  AND summary_type = 'monthly'
GROUP BY summary_date, EXTRACT(DAY FROM summary_date)
ORDER BY summary_date DESC
LIMIT 10;

-- 4. Check unique constraint - does it include platform?
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'campaign_summaries'::regclass
  AND contype = 'u';  -- unique constraints

-- 5. How many clients have data?
SELECT 
  COUNT(DISTINCT client_id) as unique_clients,
  MIN(summary_date) as oldest_date,
  MAX(summary_date) as newest_date
FROM campaign_summaries
WHERE platform = 'meta'
  AND summary_type = 'monthly';

-- 6. Check if conversion columns exist and have data
SELECT 
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE click_to_call IS NOT NULL) as has_click_to_call,
  COUNT(*) FILTER (WHERE reservations IS NOT NULL) as has_reservations,
  COUNT(*) FILTER (WHERE campaign_data IS NOT NULL) as has_campaign_data
FROM campaign_summaries
WHERE platform = 'meta'
  AND summary_type = 'monthly';
