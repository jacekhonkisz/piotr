-- ============================================================================
-- VERIFY META WEEKLY CACHE IS NOW POPULATED
-- ============================================================================

SELECT 
  '✅ Meta Weekly Cache Status' as status,
  COUNT(*) as total_entries,
  COUNT(DISTINCT client_id) as unique_clients,
  MAX(last_updated) as newest_entry,
  MIN(last_updated) as oldest_entry,
  CASE 
    WHEN COUNT(*) > 0 THEN '🎉 SUCCESS - Cache is populated!'
    ELSE '❌ FAILED - Cache is still empty'
  END as result
FROM current_week_cache;

-- Show sample data
SELECT 
  c.name as client_name,
  cwc.period_id,
  cwc.last_updated,
  (cwc.cache_data->>'fetchedAt')::text as fetched_at,
  jsonb_array_length(COALESCE(cwc.cache_data->'campaigns', '[]'::jsonb)) as campaign_count
FROM current_week_cache cwc
JOIN clients c ON c.id = cwc.client_id
ORDER BY cwc.last_updated DESC
LIMIT 10;







