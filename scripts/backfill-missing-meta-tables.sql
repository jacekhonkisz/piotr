-- ============================================================================
-- BACKFILL: Missing Meta Tables for November 2024
-- ============================================================================
-- Purpose: Identify periods that need meta_tables backfilling
--          This script finds periods with NULL meta_tables that should have data
-- ============================================================================

-- 1️⃣ IDENTIFY PERIODS NEEDING BACKFILL (Meta platform)
SELECT 
  'PERIODS NEEDING META_TABLES BACKFILL' as action,
  cs.summary_type,
  TO_CHAR(cs.summary_date, 'YYYY-MM-DD') as period,
  c.name as client_name,
  cs.client_id,
  cs.platform,
  cs.total_spend,
  CASE 
    WHEN cs.total_spend > 0 THEN '⚠️ Has spend but no meta_tables'
    ELSE 'ℹ️ No spend (may be OK)'
  END as priority,
  DATE(cs.created_at) as created_date
FROM campaign_summaries cs
LEFT JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'meta'
  AND (cs.meta_tables IS NULL 
       OR cs.meta_tables::text = 'null' 
       OR cs.meta_tables::text = '{}')
  AND cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')::date
  AND cs.summary_type IN ('monthly', 'weekly')
ORDER BY 
  CASE WHEN cs.total_spend > 0 THEN 0 ELSE 1 END, -- Prioritize periods with spend
  cs.summary_date DESC,
  cs.summary_type;

-- 2️⃣ IDENTIFY PERIODS NEEDING BACKFILL (Google platform)
SELECT 
  'PERIODS NEEDING GOOGLE_ADS_TABLES BACKFILL' as action,
  cs.summary_type,
  TO_CHAR(cs.summary_date, 'YYYY-MM-DD') as period,
  c.name as client_name,
  cs.client_id,
  cs.platform,
  cs.total_spend,
  CASE 
    WHEN cs.total_spend > 0 THEN '⚠️ Has spend but no google_ads_tables'
    ELSE 'ℹ️ No spend (may be OK)'
  END as priority,
  DATE(cs.created_at) as created_date
FROM campaign_summaries cs
LEFT JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'google'
  AND (cs.google_ads_tables IS NULL 
       OR cs.google_ads_tables::text = 'null' 
       OR cs.google_ads_tables::text = '{}')
  AND cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')::date
  AND cs.summary_type IN ('monthly', 'weekly')
ORDER BY 
  CASE WHEN cs.total_spend > 0 THEN 0 ELSE 1 END, -- Prioritize periods with spend
  cs.summary_date DESC,
  cs.summary_type;

-- 3️⃣ SPECIFIC: Belmonte November 2024 (known missing)
SELECT 
  'BELMONTE NOVEMBER 2024 - NEEDS BACKFILL' as action,
  cs.summary_type,
  TO_CHAR(cs.summary_date, 'YYYY-MM-DD') as period,
  cs.platform,
  cs.total_spend,
  cs.total_impressions,
  cs.total_clicks,
  CASE 
    WHEN cs.meta_tables IS NULL THEN '❌ NULL - Needs backfill'
    WHEN cs.meta_tables::text = 'null' THEN '❌ JSON NULL - Needs backfill'
    WHEN cs.meta_tables::text = '{}' THEN '❌ EMPTY - Needs backfill'
    ELSE '✅ Has data'
  END as status,
  DATE(cs.created_at) as created_date
FROM campaign_summaries cs
WHERE cs.client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND cs.summary_date = '2024-11-01'
  AND cs.summary_type = 'monthly'
  AND cs.platform = 'meta';

-- 4️⃣ SUMMARY: Count of periods needing backfill
SELECT 
  'BACKFILL SUMMARY' as report_type,
  cs.platform,
  cs.summary_type,
  COUNT(*) as total_periods,
  COUNT(*) FILTER (WHERE cs.total_spend > 0) as periods_with_spend,
  COUNT(*) FILTER (WHERE cs.total_spend = 0) as periods_without_spend,
  CASE 
    WHEN cs.platform = 'meta' THEN
      COUNT(*) FILTER (WHERE cs.meta_tables IS NULL 
                       OR cs.meta_tables::text = 'null' 
                       OR cs.meta_tables::text = '{}')
    WHEN cs.platform = 'google' THEN
      COUNT(*) FILTER (WHERE cs.google_ads_tables IS NULL 
                       OR cs.google_ads_tables::text = 'null' 
                       OR cs.google_ads_tables::text = '{}')
    ELSE 0
  END as periods_needing_backfill
FROM campaign_summaries cs
WHERE cs.summary_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')::date
  AND cs.summary_type IN ('monthly', 'weekly')
GROUP BY cs.platform, cs.summary_type
ORDER BY cs.platform, cs.summary_type;



