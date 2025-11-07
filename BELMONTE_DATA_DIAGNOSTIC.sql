-- ============================================================================
-- BELMONTE HOTEL DATA DIAGNOSTIC
-- ============================================================================
-- Client Email: belmonte@hotel.com
-- User ID: 0f2ff3cb-896c-4688-841a-1a9851ec1746
-- ============================================================================

-- 1. Find the actual client_id for Belmonte (clients table uses different ID than auth.users)
SELECT 
  id as client_id,
  name,
  email,
  company,
  created_at
FROM clients
WHERE email = 'belmonte@hotel.com';

-- 2. Check what data exists for Belmonte in campaign_summaries
-- (Replace CLIENT_ID_FROM_STEP_1 with the id from step 1)
SELECT 
  summary_date,
  summary_type,
  platform,
  total_spend,
  total_impressions,
  total_clicks,
  total_conversions,
  (campaign_data IS NOT NULL) as has_campaigns,
  CASE 
    WHEN campaign_data IS NOT NULL 
    THEN JSONB_ARRAY_LENGTH(campaign_data)
    ELSE 0
  END as campaign_count,
  last_updated
FROM campaign_summaries
WHERE client_id = (
  SELECT id FROM clients 
  WHERE email = 'belmonte@hotel.com' 
  LIMIT 1
)
  AND platform = 'meta'
  AND summary_type = 'monthly'
ORDER BY summary_date DESC
LIMIT 20;

-- 3. Check for zero-data records (validation would reject these)
SELECT 
  summary_date,
  summary_type,
  total_spend,
  total_impressions,
  total_clicks,
  (campaign_data IS NOT NULL) as has_campaigns
FROM campaign_summaries
WHERE client_id = (
  SELECT id FROM clients 
  WHERE email = 'belmonte@hotel.com' 
  LIMIT 1
)
  AND platform = 'meta'
  AND summary_type = 'monthly'
  AND total_spend = 0
  AND total_impressions = 0
  AND total_clicks = 0
ORDER BY summary_date DESC;

-- 4. Check Belmonte's data for a specific month (e.g., October 2024)
SELECT 
  *
FROM campaign_summaries
WHERE client_id = (
  SELECT id FROM clients 
  WHERE email = 'belmonte@hotel.com' 
  LIMIT 1
)
  AND summary_type = 'monthly'
  AND platform = 'meta'
  AND summary_date = '2024-10-01';

-- 5. Get Belmonte's complete data overview
SELECT 
  'Total Records' as metric,
  COUNT(*) as count
FROM campaign_summaries
WHERE client_id = (
  SELECT id FROM clients 
  WHERE email = 'belmonte@hotel.com' 
  LIMIT 1
)
  AND platform = 'meta'
UNION ALL
SELECT 
  'Monthly Records',
  COUNT(*)
FROM campaign_summaries
WHERE client_id = (
  SELECT id FROM clients 
  WHERE email = 'belmonte@hotel.com' 
  LIMIT 1
)
  AND platform = 'meta'
  AND summary_type = 'monthly'
UNION ALL
SELECT 
  'Weekly Records',
  COUNT(*)
FROM campaign_summaries
WHERE client_id = (
  SELECT id FROM clients 
  WHERE email = 'belmonte@hotel.com' 
  LIMIT 1
)
  AND platform = 'meta'
  AND summary_type = 'weekly'
UNION ALL
SELECT 
  'Records with Data',
  COUNT(*)
FROM campaign_summaries
WHERE client_id = (
  SELECT id FROM clients 
  WHERE email = 'belmonte@hotel.com' 
  LIMIT 1
)
  AND platform = 'meta'
  AND (total_spend > 0 OR total_impressions > 0 OR total_clicks > 0)
UNION ALL
SELECT 
  'Records with Zero Data',
  COUNT(*)
FROM campaign_summaries
WHERE client_id = (
  SELECT id FROM clients 
  WHERE email = 'belmonte@hotel.com' 
  LIMIT 1
)
  AND platform = 'meta'
  AND total_spend = 0
  AND total_impressions = 0
  AND total_clicks = 0;

-- 6. Check date range available for Belmonte
SELECT 
  MIN(summary_date) as oldest_date,
  MAX(summary_date) as newest_date,
  COUNT(DISTINCT summary_date) as unique_dates
FROM campaign_summaries
WHERE client_id = (
  SELECT id FROM clients 
  WHERE email = 'belmonte@hotel.com' 
  LIMIT 1
)
  AND platform = 'meta'
  AND summary_type = 'monthly';

-- 7. Check recent 6 months for Belmonte
SELECT 
  TO_CHAR(summary_date, 'YYYY-MM') as month,
  summary_type,
  total_spend,
  total_impressions,
  total_clicks,
  total_conversions,
  CASE 
    WHEN campaign_data IS NOT NULL 
    THEN JSONB_ARRAY_LENGTH(campaign_data)
    ELSE 0
  END as campaign_count
FROM campaign_summaries
WHERE client_id = (
  SELECT id FROM clients 
  WHERE email = 'belmonte@hotel.com' 
  LIMIT 1
)
  AND platform = 'meta'
  AND summary_type = 'monthly'
  AND summary_date >= NOW() - INTERVAL '6 months'
ORDER BY summary_date DESC;

-- 8. Check if Belmonte has data in current_month_cache
SELECT 
  period_id,
  last_updated,
  (cache_data -> 'stats' ->> 'totalSpend')::numeric as total_spend,
  (cache_data -> 'stats' ->> 'totalImpressions')::numeric as total_impressions,
  (cache_data ->> 'campaigns')::jsonb IS NOT NULL as has_campaigns
FROM current_month_cache
WHERE client_id = (
  SELECT id FROM clients 
  WHERE email = 'belmonte@hotel.com' 
  LIMIT 1
)
ORDER BY last_updated DESC
LIMIT 5;

-- 9. Check if Belmonte has data in daily_kpi_data
SELECT 
  date,
  data_source,
  total_spend,
  total_impressions,
  total_clicks,
  total_conversions,
  reservations,
  reservation_value
FROM daily_kpi_data
WHERE client_id = (
  SELECT id FROM clients 
  WHERE email = 'belmonte@hotel.com' 
  LIMIT 1
)
  AND data_source = 'meta_api'
ORDER BY date DESC
LIMIT 20;

-- ============================================================================
-- DIAGNOSTIC SUMMARY FOR BELMONTE
-- ============================================================================

-- Run this to get a complete picture
WITH belmonte_client AS (
  SELECT id FROM clients 
  WHERE email = 'belmonte@hotel.com' 
  LIMIT 1
)
SELECT 
  'Client Found' as check_type,
  CASE WHEN EXISTS (SELECT 1 FROM belmonte_client) THEN '✅ YES' ELSE '❌ NO' END as result
UNION ALL
SELECT 
  'Campaign Summaries Records',
  COUNT(*)::text
FROM campaign_summaries
WHERE client_id = (SELECT id FROM belmonte_client)
UNION ALL
SELECT 
  'Meta Platform Records',
  COUNT(*)::text
FROM campaign_summaries
WHERE client_id = (SELECT id FROM belmonte_client)
  AND platform = 'meta'
UNION ALL
SELECT 
  'Monthly Records',
  COUNT(*)::text
FROM campaign_summaries
WHERE client_id = (SELECT id FROM belmonte_client)
  AND platform = 'meta'
  AND summary_type = 'monthly'
UNION ALL
SELECT 
  'Records with Actual Data',
  COUNT(*)::text
FROM campaign_summaries
WHERE client_id = (SELECT id FROM belmonte_client)
  AND platform = 'meta'
  AND summary_type = 'monthly'
  AND (total_spend > 0 OR total_impressions > 0)
UNION ALL
SELECT 
  'Records with Zero Data',
  COUNT(*)::text
FROM campaign_summaries
WHERE client_id = (SELECT id FROM belmonte_client)
  AND platform = 'meta'
  AND summary_type = 'monthly'
  AND total_spend = 0
  AND total_impressions = 0
UNION ALL
SELECT 
  'Oldest Data Date',
  MIN(summary_date)::text
FROM campaign_summaries
WHERE client_id = (SELECT id FROM belmonte_client)
  AND platform = 'meta'
  AND summary_type = 'monthly'
UNION ALL
SELECT 
  'Newest Data Date',
  MAX(summary_date)::text
FROM campaign_summaries
WHERE client_id = (SELECT id FROM belmonte_client)
  AND platform = 'meta'
  AND summary_type = 'monthly';

