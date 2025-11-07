-- ========================================
-- TEST: Which file am I running?
-- ========================================
-- If you see this message, you have the CORRECT file!
-- ========================================

SELECT '✅ CORRECT FILE: FIX_LEGACY_DATA_SOURCES_SAFE.sql' as test_result;

-- Show records that need fixing
SELECT 
  '📋 Records with incorrect data_source:' as info,
  platform,
  data_source,
  COUNT(*) as records_to_fix
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND platform = 'meta'
  AND data_source IN ('historical', 'smart', 'standardized_coverage')
GROUP BY platform, data_source;

-- If you see NO rows above, everything is already fixed! ✅

