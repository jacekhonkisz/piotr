-- ============================================================================
-- CHECK GOOGLE ADS WEEKLY CACHE STATUS
-- ============================================================================

SELECT 
  '🔵 Google Ads Weekly Cache Status' as info,
  COUNT(*) as total_entries,
  COUNT(DISTINCT client_id) as unique_clients,
  MAX(last_updated) as newest_entry,
  MIN(last_updated) as oldest_entry,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Has data'
    ELSE '❌ Empty'
  END as status
FROM google_ads_current_week_cache;

-- Show sample records
SELECT 
  c.name as client_name,
  gwc.period_id,
  gwc.last_updated,
  (gwc.cache_data->>'fetchedAt')::text as fetched_at,
  jsonb_array_length(COALESCE(gwc.cache_data->'campaigns', '[]'::jsonb)) as campaign_count
FROM google_ads_current_week_cache gwc
JOIN clients c ON c.id = gwc.client_id
ORDER BY gwc.last_updated DESC
LIMIT 10;

-- Compare with Meta weekly cache
SELECT 
  'Meta vs Google Weekly Cache Comparison' as comparison,
  (SELECT COUNT(*) FROM current_week_cache) as meta_entries,
  (SELECT COUNT(*) FROM google_ads_current_week_cache) as google_entries,
  (SELECT COUNT(*) FROM current_week_cache) - (SELECT COUNT(*) FROM google_ads_current_week_cache) as difference;

