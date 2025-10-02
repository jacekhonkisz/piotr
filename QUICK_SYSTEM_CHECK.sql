-- ============================================================================
-- QUICK SYSTEM CHECK - Run this ONE query in Supabase
-- ============================================================================

WITH september_data AS (
  SELECT 
    'campaign_summaries' as source,
    total_spend,
    total_impressions,
    jsonb_array_length(COALESCE(campaign_data, '[]'::jsonb)) as items_count,
    'campaigns' as items_type,
    platform,
    data_source,
    last_updated
  FROM campaign_summaries
  WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
    AND summary_type = 'monthly'
    AND summary_date = '2025-09-01'
  
  UNION ALL
  
  SELECT 
    'daily_kpi_data' as source,
    ROUND(SUM(total_spend), 2) as total_spend,
    SUM(total_impressions) as total_impressions,
    COUNT(DISTINCT date) as items_count,
    'days' as items_type,
    data_source as platform,
    data_source,
    MAX(last_updated) as last_updated
  FROM daily_kpi_data
  WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
    AND date >= '2025-09-01'
    AND date <= '2025-09-30'
  GROUP BY data_source
),
duplicates AS (
  SELECT COUNT(*) as duplicate_count
  FROM campaign_summaries
  WHERE summary_type = 'monthly'
    AND summary_date >= '2025-07-01'
  GROUP BY client_id, summary_type, summary_date, platform
  HAVING COUNT(*) > 1
)
SELECT 
  -- Data Sources
  json_agg(
    json_build_object(
      'source', source,
      'total_spend', total_spend,
      'impressions', total_impressions,
      'items_count', items_count,
      'items_type', items_type,
      'platform', platform,
      'age_hours', EXTRACT(EPOCH FROM (NOW() - last_updated))/3600
    ) ORDER BY source
  ) as data_sources,
  -- Duplicate Check
  (SELECT COALESCE(SUM(duplicate_count), 0) FROM duplicates) as total_duplicates,
  -- Status
  CASE 
    WHEN (SELECT COALESCE(SUM(duplicate_count), 0) FROM duplicates) = 0 
    THEN '✅ SYSTEM UNIFIED - NO DUPLICATES'
    ELSE '❌ DUPLICATES FOUND'
  END as system_status
FROM september_data;

-- Expected Result:
-- {
--   "data_sources": [
--     {
--       "source": "campaign_summaries",
--       "total_spend": 12735.18,
--       "impressions": 1271746,
--       "items_count": 22,
--       "items_type": "campaigns",
--       "platform": "meta",
--       "age_hours": <some number>
--     },
--     {
--       "source": "daily_kpi_data",
--       "total_spend": 7118.30,
--       "impressions": <some number>,
--       "items_count": 30,
--       "items_type": "days",
--       "platform": "meta_api",
--       "age_hours": <some number>
--     }
--   ],
--   "total_duplicates": 0,
--   "system_status": "✅ SYSTEM UNIFIED - NO DUPLICATES"
-- }

