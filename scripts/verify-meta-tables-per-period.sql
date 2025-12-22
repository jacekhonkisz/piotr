-- ============================================================================
-- VERIFICATION: Check if each month/week has its own meta_tables data
-- ============================================================================
-- Purpose: Verify that meta_tables JSONB data exists for each period
--          and contains period-specific data (not shared/empty)
-- ============================================================================

-- 1️⃣ MONTHLY: Check meta_tables presence and content for each month
SELECT 
  '1️⃣ MONTHLY META_TABLES VERIFICATION' as check_type,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as period,
  c.name as client_name,
  cs.platform,
  CASE 
    WHEN cs.meta_tables IS NULL THEN '❌ NULL'
    WHEN cs.meta_tables::text = 'null' THEN '❌ JSON NULL'
    WHEN cs.meta_tables::text = '{}' THEN '❌ EMPTY OBJECT'
    WHEN jsonb_typeof(cs.meta_tables) = 'object' THEN '✅ HAS DATA'
    ELSE '⚠️ UNKNOWN FORMAT'
  END as meta_tables_status,
  CASE 
    WHEN cs.meta_tables IS NOT NULL AND cs.meta_tables::text != 'null' AND cs.meta_tables::text != '{}' THEN
      jsonb_array_length(cs.meta_tables->'placementPerformance')::text || ' placements, ' ||
      jsonb_array_length(cs.meta_tables->'demographicPerformance')::text || ' demographics, ' ||
      jsonb_array_length(cs.meta_tables->'adRelevanceResults')::text || ' ad relevance'
    ELSE 'N/A'
  END as meta_tables_content,
  cs.total_spend,
  DATE(cs.created_at) as created_date
FROM campaign_summaries cs
LEFT JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'monthly'
  AND cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')::date
ORDER BY cs.summary_date DESC, c.name, cs.platform;

-- 2️⃣ WEEKLY: Check meta_tables presence and content for each week
SELECT 
  '2️⃣ WEEKLY META_TABLES VERIFICATION' as check_type,
  TO_CHAR(cs.summary_date, 'YYYY-MM-DD') as period,
  TO_CHAR(cs.summary_date, 'YYYY-"W"WW') as week_label,
  c.name as client_name,
  cs.platform,
  CASE 
    WHEN cs.meta_tables IS NULL THEN '❌ NULL'
    WHEN cs.meta_tables::text = 'null' THEN '❌ JSON NULL'
    WHEN cs.meta_tables::text = '{}' THEN '❌ EMPTY OBJECT'
    WHEN jsonb_typeof(cs.meta_tables) = 'object' THEN '✅ HAS DATA'
    ELSE '⚠️ UNKNOWN FORMAT'
  END as meta_tables_status,
  CASE 
    WHEN cs.meta_tables IS NOT NULL AND cs.meta_tables::text != 'null' AND cs.meta_tables::text != '{}' THEN
      jsonb_array_length(cs.meta_tables->'placementPerformance')::text || ' placements, ' ||
      jsonb_array_length(cs.meta_tables->'demographicPerformance')::text || ' demographics, ' ||
      jsonb_array_length(cs.meta_tables->'adRelevanceResults')::text || ' ad relevance'
    ELSE 'N/A'
  END as meta_tables_content,
  cs.total_spend,
  DATE(cs.created_at) as created_date
FROM campaign_summaries cs
LEFT JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
  AND cs.summary_date >= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '12 weeks')::date
ORDER BY cs.summary_date DESC, c.name;

-- 3️⃣ SUMMARY: Count periods with/without meta_tables data
SELECT 
  '3️⃣ SUMMARY STATISTICS' as check_type,
  summary_type,
  platform,
  COUNT(*) as total_periods,
  COUNT(*) FILTER (WHERE meta_tables IS NOT NULL 
                    AND meta_tables::text != 'null' 
                    AND meta_tables::text != '{}'
                    AND jsonb_typeof(meta_tables) = 'object') as periods_with_meta_tables,
  COUNT(*) FILTER (WHERE meta_tables IS NULL 
                    OR meta_tables::text = 'null' 
                    OR meta_tables::text = '{}') as periods_without_meta_tables,
  ROUND(
    (COUNT(*) FILTER (WHERE meta_tables IS NOT NULL 
                      AND meta_tables::text != 'null' 
                      AND meta_tables::text != '{}'
                      AND jsonb_typeof(meta_tables) = 'object')::numeric / 
     NULLIF(COUNT(*), 0)::numeric) * 100, 
    2
  ) as percentage_with_data
FROM campaign_summaries
WHERE summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')::date
GROUP BY summary_type, platform
ORDER BY summary_type, platform;

-- 4️⃣ DETAILED BREAKDOWN: Sample meta_tables content for verification
SELECT 
  '4️⃣ SAMPLE META_TABLES CONTENT' as check_type,
  TO_CHAR(cs.summary_date, 'YYYY-MM') as period,
  cs.summary_type,
  c.name as client_name,
  cs.platform,
  -- Check if placementPerformance exists and has data
  CASE 
    WHEN cs.meta_tables->'placementPerformance' IS NOT NULL 
      AND jsonb_typeof(cs.meta_tables->'placementPerformance') = 'array'
      AND jsonb_array_length(cs.meta_tables->'placementPerformance') > 0
    THEN '✅ ' || jsonb_array_length(cs.meta_tables->'placementPerformance')::text || ' items'
    ELSE '❌ Missing/Empty'
  END as placement_performance,
  -- Check if demographicPerformance exists and has data
  CASE 
    WHEN cs.meta_tables->'demographicPerformance' IS NOT NULL 
      AND jsonb_typeof(cs.meta_tables->'demographicPerformance') = 'array'
      AND jsonb_array_length(cs.meta_tables->'demographicPerformance') > 0
    THEN '✅ ' || jsonb_array_length(cs.meta_tables->'demographicPerformance')::text || ' items'
    ELSE '❌ Missing/Empty'
  END as demographic_performance,
  -- Check if adRelevanceResults exists and has data
  CASE 
    WHEN cs.meta_tables->'adRelevanceResults' IS NOT NULL 
      AND jsonb_typeof(cs.meta_tables->'adRelevanceResults') = 'array'
      AND jsonb_array_length(cs.meta_tables->'adRelevanceResults') > 0
    THEN '✅ ' || jsonb_array_length(cs.meta_tables->'adRelevanceResults')::text || ' items'
    ELSE '❌ Missing/Empty'
  END as ad_relevance_results,
  -- Sample first placement to verify it's period-specific
  CASE 
    WHEN cs.meta_tables->'placementPerformance' IS NOT NULL 
      AND jsonb_array_length(cs.meta_tables->'placementPerformance') > 0
    THEN cs.meta_tables->'placementPerformance'->0->>'placement'
    ELSE NULL
  END as sample_placement
FROM campaign_summaries cs
LEFT JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '6 months')::date
  AND cs.platform = 'meta'
ORDER BY cs.summary_date DESC, cs.summary_type, c.name
LIMIT 30;

-- 5️⃣ GAP ANALYSIS: Find periods missing meta_tables data
SELECT 
  '5️⃣ PERIODS MISSING META_TABLES' as check_type,
  cs.summary_type,
  TO_CHAR(cs.summary_date, 'YYYY-MM-DD') as period,
  c.name as client_name,
  cs.platform,
  cs.total_spend,
  CASE 
    WHEN cs.meta_tables IS NULL THEN 'NULL'
    WHEN cs.meta_tables::text = 'null' THEN 'JSON NULL'
    WHEN cs.meta_tables::text = '{}' THEN 'EMPTY OBJECT'
    ELSE 'UNKNOWN'
  END as missing_reason,
  DATE(cs.created_at) as created_date
FROM campaign_summaries cs
LEFT JOIN clients c ON c.id = cs.client_id
WHERE (cs.meta_tables IS NULL 
       OR cs.meta_tables::text = 'null' 
       OR cs.meta_tables::text = '{}')
  AND cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')::date
ORDER BY cs.summary_date DESC, cs.summary_type, c.name;

-- 6️⃣ BELMONTE SPECIFIC: Detailed check for most active client (platform-aware)
SELECT 
  '6️⃣ BELMONTE TABLES DETAIL' as check_type,
  cs.summary_type,
  TO_CHAR(cs.summary_date, 'YYYY-MM-DD') as period,
  cs.platform,
  CASE 
    WHEN cs.platform = 'meta' THEN
      CASE 
        WHEN cs.meta_tables IS NULL THEN '❌ NULL'
        WHEN cs.meta_tables::text = 'null' THEN '❌ JSON NULL'
        WHEN cs.meta_tables::text = '{}' THEN '❌ EMPTY'
        WHEN jsonb_typeof(cs.meta_tables) = 'object' THEN '✅ HAS DATA'
        ELSE '⚠️ UNKNOWN'
      END
    WHEN cs.platform = 'google' THEN
      CASE 
        WHEN cs.google_ads_tables IS NULL THEN '❌ NULL'
        WHEN cs.google_ads_tables::text = 'null' THEN '❌ JSON NULL'
        WHEN cs.google_ads_tables::text = '{}' THEN '❌ EMPTY'
        WHEN jsonb_typeof(cs.google_ads_tables) = 'object' THEN '✅ HAS DATA'
        ELSE '⚠️ UNKNOWN'
      END
    ELSE '⚠️ UNKNOWN PLATFORM'
  END as status,
  CASE 
    WHEN cs.platform = 'meta' THEN jsonb_array_length(cs.meta_tables->'placementPerformance')
    WHEN cs.platform = 'google' THEN jsonb_array_length(cs.google_ads_tables->'networkPerformance')
    ELSE NULL
  END as placement_count,
  CASE 
    WHEN cs.platform = 'meta' THEN jsonb_array_length(cs.meta_tables->'demographicPerformance')
    WHEN cs.platform = 'google' THEN jsonb_array_length(cs.google_ads_tables->'demographicPerformance')
    ELSE NULL
  END as demographic_count,
  CASE 
    WHEN cs.platform = 'meta' THEN jsonb_array_length(cs.meta_tables->'adRelevanceResults')
    WHEN cs.platform = 'google' THEN jsonb_array_length(cs.google_ads_tables->'qualityScoreMetrics')
    ELSE NULL
  END as ad_relevance_count,
  cs.total_spend,
  DATE(cs.created_at) as created_date
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')::date
ORDER BY cs.summary_date DESC, cs.summary_type, cs.platform;

