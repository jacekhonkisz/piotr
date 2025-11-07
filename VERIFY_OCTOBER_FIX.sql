-- Verify October 2025 data is now in database for fast loading

-- 1. Check if October 2025 monthly data now exists
SELECT 
  '✅ OCTOBER DATA IN DATABASE' as status,
  summary_date,
  platform,
  summary_type,
  total_spend as spend,
  total_impressions as impressions,
  total_clicks as clicks,
  reservations,
  TO_CHAR(last_updated, 'YYYY-MM-DD HH24:MI:SS') as last_updated
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'google'
  AND summary_type = 'monthly'
  AND summary_date >= '2025-10-01'
  AND summary_date <= '2025-10-31'
ORDER BY summary_date DESC;

-- 2. Check data quality
SELECT 
  'DATA QUALITY CHECK' as check_type,
  CASE 
    WHEN total_spend > 0 THEN '✅ Has spend data'
    ELSE '❌ No spend data'
  END as spend_check,
  CASE 
    WHEN total_impressions > 0 THEN '✅ Has impressions'
    ELSE '❌ No impressions'
  END as impressions_check,
  CASE
    WHEN total_clicks > 0 THEN '✅ Has clicks'
    ELSE '❌ No clicks'  
  END as clicks_check,
  total_spend,
  total_impressions,
  total_clicks
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'google'
  AND summary_type = 'monthly'
  AND summary_date >= '2025-10-01'
  AND summary_date <= '2025-10-31';

-- 3. Performance expectation
SELECT 
  'PERFORMANCE EXPECTATION' as info,
  'October should now load in <50ms instead of ~9 seconds' as expectation,
  '180x faster!' as improvement;

