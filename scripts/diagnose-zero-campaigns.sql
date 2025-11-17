-- Diagnose why cache has 0 campaigns
-- Check the raw cache data to see what was stored

SELECT 
  '=== CACHE CONTENTS ===' as section,
  period_id,
  last_updated,
  AGE(NOW(), last_updated) as cache_age,
  
  -- Check campaigns array
  jsonb_array_length(cache_data->'campaigns') as campaigns_count,
  
  -- Check if campaigns key exists
  CASE 
    WHEN cache_data ? 'campaigns' THEN '✅ campaigns key exists'
    ELSE '❌ campaigns key missing'
  END as campaigns_key_status,
  
  -- Check stats
  (cache_data->'stats'->>'totalSpend')::numeric as total_spend,
  (cache_data->'stats'->>'totalClicks')::int as total_clicks,
  (cache_data->'stats'->>'totalImpressions')::int as total_impressions,
  
  -- Check conversionMetrics
  (cache_data->'conversionMetrics'->>'booking_step_1')::int as total_step1,
  (cache_data->'conversionMetrics'->>'reservations')::int as total_reservations,
  
  -- Check debug info
  cache_data->'debug' as debug_info,
  
  -- Sample first campaign (if any)
  cache_data->'campaigns'->0 as first_campaign_sample

FROM current_month_cache
WHERE client_id = (SELECT id FROM clients WHERE name ILIKE '%belmonte%' LIMIT 1)
  AND period_id = TO_CHAR(CURRENT_DATE, 'YYYY-MM');


