-- ============================================================================
-- BELMONTE GOOGLE ADS - QUICK CHECK
-- ============================================================================
-- Run this for immediate verification
-- ============================================================================

-- 1️⃣ GET CLIENT ID (CORRECTED)
SELECT id, name, email, google_ads_enabled, google_ads_customer_id
FROM clients
WHERE email = 'belmonte@hotel.com';
-- Save the 'id' value for next queries


-- 2️⃣ CHECK CURRENT MONTH CACHE (Replace YOUR_CLIENT_ID)
SELECT 
  period_id,
  last_updated,
  ROUND(EXTRACT(EPOCH FROM (NOW() - last_updated))/3600, 2) as hours_old,
  jsonb_array_length(cache_data->'campaigns') as campaigns,
  ROUND((cache_data->'stats'->>'totalSpend')::numeric, 2) as spend,
  (cache_data->'conversionMetrics'->>'reservations')::integer as reservations,
  CASE 
    WHEN (cache_data->'googleAdsTables') IS NOT NULL THEN '✅ Yes'
    ELSE '❌ No'
  END as has_tables_data
FROM google_ads_current_month_cache
WHERE client_id = 'YOUR_CLIENT_ID'  -- Replace with ID from query #1
AND period_id = to_char(NOW(), 'YYYY-MM');


-- 3️⃣ QUICK HEALTH CHECK (Replace YOUR_CLIENT_ID)
SELECT 
  CASE 
    WHEN COUNT(*) > 0 AND MAX(last_updated) > NOW() - INTERVAL '6 hours' THEN '✅ HEALTHY'
    WHEN COUNT(*) > 0 AND MAX(last_updated) > NOW() - INTERVAL '24 hours' THEN '⚠️ STALE'
    WHEN COUNT(*) > 0 THEN '❌ VERY OLD'
    ELSE '❌ NO DATA'
  END as cache_status,
  COUNT(*) as cache_entries,
  MAX(last_updated) as last_refresh,
  jsonb_array_length(MAX(cache_data)->'campaigns') as campaign_count,
  ROUND((MAX(cache_data)->'stats'->>'totalSpend')::numeric, 2) as total_spend
FROM google_ads_current_month_cache
WHERE client_id = 'YOUR_CLIENT_ID'  -- Replace with ID from query #1
AND period_id = to_char(NOW(), 'YYYY-MM');


-- 4️⃣ CHECK HISTORICAL DATA (Replace YOUR_CLIENT_ID)
SELECT 
  to_char(summary_date, 'YYYY-MM') as month,
  COUNT(*) as records,
  ROUND(SUM(total_spend), 2) as spend,
  SUM(reservations) as reservations
FROM campaign_summaries
WHERE client_id = 'YOUR_CLIENT_ID'  -- Replace with ID from query #1
AND platform = 'google'
AND summary_date >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY to_char(summary_date, 'YYYY-MM')
ORDER BY month DESC;


-- ============================================================================
-- EXPECTED RESULTS:
-- ============================================================================
-- Query #2: Should show:
--   - period_id: '2025-11'
--   - hours_old: < 6 (if cron running correctly)
--   - campaigns: > 0
--   - spend: > 0
--   - has_tables_data: '✅ Yes'
--
-- Query #3: Should show:
--   - cache_status: '✅ HEALTHY'
--   - cache_entries: 1
--   - campaign_count: > 0
--
-- Query #4: Should show recent months with data
-- ============================================================================

