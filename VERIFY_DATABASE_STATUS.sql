-- ============================================================================
-- DATABASE STATUS VERIFICATION SCRIPT
-- ============================================================================
-- Run this in Supabase SQL Editor to diagnose your current database state
-- Copy entire contents and paste into SQL Editor, then click "Run"
-- ============================================================================

-- ============================================================================
-- 1. CHECK WHICH CRITICAL TABLES EXIST
-- ============================================================================
SELECT 
  t.table_name as "Table Name",
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = t.table_name AND table_schema = 'public'
    ) THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as "Status"
FROM (
  VALUES 
    ('campaign_summaries'),
    ('current_month_cache'),
    ('current_week_cache'),
    ('daily_kpi_data'),
    ('clients'),
    ('profiles'),
    ('reports')
) AS t(table_name)
ORDER BY t.table_name;

-- ============================================================================
-- 2. CHECK DATA IN EACH TABLE (if exists)
-- ============================================================================

-- Campaign Summaries
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_summaries') THEN
    RAISE NOTICE '📊 campaign_summaries data:';
    PERFORM 1; -- Execute the following query
  ELSE
    RAISE NOTICE '❌ campaign_summaries table does not exist - CRITICAL!';
  END IF;
END $$;

-- Only run if table exists
SELECT 
  '📊 CAMPAIGN SUMMARIES' as "Section",
  TO_CHAR(summary_date, 'YYYY-MM') as "Month",
  summary_type as "Type",
  COUNT(*) as "Records",
  ROUND(SUM(total_spend), 2) as "Total Spend",
  MAX(last_updated) as "Last Updated"
FROM campaign_summaries
WHERE summary_date >= '2025-01-01'
GROUP BY "Month", summary_type
ORDER BY "Month" DESC, summary_type

UNION ALL

-- Current Month Cache
SELECT 
  '💾 CURRENT MONTH CACHE' as "Section",
  period_id as "Month",
  'cache' as "Type",
  COUNT(*) as "Records",
  NULL as "Total Spend",
  MAX(last_refreshed) as "Last Updated"
FROM current_month_cache
WHERE period_id >= '2025-01'
GROUP BY period_id
ORDER BY period_id DESC

UNION ALL

-- Current Week Cache  
SELECT 
  '📅 CURRENT WEEK CACHE' as "Section",
  period_id as "Month",
  'cache' as "Type",
  COUNT(*) as "Records",
  NULL as "Total Spend",
  MAX(last_refreshed) as "Last Updated"
FROM current_week_cache
WHERE period_id >= '2025-W01'
GROUP BY period_id
ORDER BY period_id DESC

UNION ALL

-- Daily KPI Data (last 60 days)
SELECT 
  '📈 DAILY KPI DATA' as "Section",
  TO_CHAR(date, 'YYYY-MM') as "Month",
  'daily' as "Type",
  COUNT(*) as "Records",
  ROUND(SUM(total_spend), 2) as "Total Spend",
  MAX(date)::text as "Last Updated"
FROM daily_kpi_data
WHERE date >= CURRENT_DATE - INTERVAL '60 days'
GROUP BY "Month"
ORDER BY "Month" DESC;

-- ============================================================================
-- 3. CHECK FOR DATA GAPS IN LAST 13 MONTHS
-- ============================================================================
WITH RECURSIVE months AS (
  SELECT DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')::date as month
  UNION ALL
  SELECT (month + INTERVAL '1 month')::date
  FROM months
  WHERE month < DATE_TRUNC('month', CURRENT_DATE)::date
),
summaries AS (
  SELECT DISTINCT summary_date as month
  FROM campaign_summaries
  WHERE summary_type = 'monthly'
)
SELECT 
  TO_CHAR(m.month, 'YYYY-MM') as "Month",
  CASE 
    WHEN s.month IS NOT NULL THEN '✅ Has Data'
    WHEN m.month = DATE_TRUNC('month', CURRENT_DATE)::date THEN '⏳ Current Month'
    ELSE '❌ MISSING'
  END as "Status"
FROM months m
LEFT JOIN summaries s ON s.month = m.month
ORDER BY m.month DESC;

-- ============================================================================
-- 4. CHECK CURRENT MONTH CACHE STATUS (Is it fresh?)
-- ============================================================================
SELECT 
  client_id,
  period_id,
  platform,
  last_refreshed,
  ROUND(EXTRACT(EPOCH FROM (NOW() - last_refreshed)) / 3600, 1) as "Hours Old",
  CASE 
    WHEN EXTRACT(EPOCH FROM (NOW() - last_refreshed)) / 3600 < 3 THEN '✅ Fresh'
    WHEN EXTRACT(EPOCH FROM (NOW() - last_refreshed)) / 3600 < 6 THEN '⚠️ Stale'
    ELSE '❌ Very Old'
  END as "Cache Status"
FROM current_month_cache
ORDER BY last_refreshed DESC;

-- ============================================================================
-- 5. CHECK FOR SEPTEMBER 2025 DATA SPECIFICALLY
-- ============================================================================
SELECT 
  'September 2025 Check' as "Check",
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM campaign_summaries 
      WHERE summary_date = '2025-09-01' 
      AND summary_type = 'monthly'
    ) THEN '✅ September data EXISTS in campaign_summaries'
    ELSE '❌ September data MISSING from campaign_summaries'
  END as "Status";

SELECT 
  'September Daily Data' as "Check",
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM daily_kpi_data 
      WHERE date >= '2025-09-01' 
      AND date <= '2025-09-30'
    ) THEN CONCAT(
      '✅ Has ',
      (SELECT COUNT(DISTINCT date) FROM daily_kpi_data 
       WHERE date >= '2025-09-01' AND date <= '2025-09-30'),
      ' days of September daily data'
    )
    ELSE '❌ No September daily data'
  END as "Status";

-- ============================================================================
-- 6. CHECK CLIENT CONFIGURATION
-- ============================================================================
SELECT 
  id,
  name,
  email,
  CASE WHEN meta_access_token IS NOT NULL THEN '✅ Has Meta Token' ELSE '❌ No Meta Token' END as "Meta Status",
  CASE WHEN google_ads_enabled THEN '✅ Google Ads Enabled' ELSE '❌ Google Ads Disabled' END as "Google Status",
  reporting_frequency as "Report Frequency"
FROM clients
ORDER BY name;

-- ============================================================================
-- 7. CHECK CRON JOB EXECUTION STATUS
-- ============================================================================
-- Note: This checks if archival has been creating data recently

SELECT 
  'Last Monthly Archival' as "Check",
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM campaign_summaries 
      WHERE summary_type = 'monthly' 
      AND last_updated >= CURRENT_DATE - INTERVAL '5 days'
    ) THEN CONCAT(
      '✅ Data created/updated in last 5 days (',
      (SELECT MAX(last_updated)::date FROM campaign_summaries 
       WHERE summary_type = 'monthly' AND last_updated >= CURRENT_DATE - INTERVAL '5 days'),
      ')'
    )
    ELSE '❌ No recent monthly archival activity'
  END as "Status";

-- ============================================================================
-- 8. RECOMMENDATIONS BASED ON CURRENT STATE
-- ============================================================================

DO $$
DECLARE
  has_campaign_summaries BOOLEAN;
  has_september_data BOOLEAN;
  has_september_daily BOOLEAN;
  has_current_cache BOOLEAN;
BEGIN
  -- Check conditions
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'campaign_summaries'
  ) INTO has_campaign_summaries;
  
  IF has_campaign_summaries THEN
    SELECT EXISTS (
      SELECT 1 FROM campaign_summaries 
      WHERE summary_date = '2025-09-01' AND summary_type = 'monthly'
    ) INTO has_september_data;
    
    SELECT EXISTS (
      SELECT 1 FROM daily_kpi_data 
      WHERE date >= '2025-09-01' AND date <= '2025-09-30'
    ) INTO has_september_daily;
    
    SELECT EXISTS (
      SELECT 1 FROM current_month_cache 
      WHERE last_refreshed >= NOW() - INTERVAL '4 hours'
    ) INTO has_current_cache;
  END IF;
  
  -- Provide recommendations
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '📋 RECOMMENDATIONS:';
  RAISE NOTICE '============================================';
  
  IF NOT has_campaign_summaries THEN
    RAISE NOTICE '🔴 CRITICAL: campaign_summaries table missing!';
    RAISE NOTICE '   → ACTION: Run DATABASE_SCHEMA_EMERGENCY_FIX.sql IMMEDIATELY';
    RAISE NOTICE '   → This is blocking ALL historical data functionality';
  ELSIF NOT has_september_data THEN
    IF has_september_daily THEN
      RAISE NOTICE '🟡 WARNING: September 2025 not in campaign_summaries but daily data exists';
      RAISE NOTICE '   → ACTION: Run monthly aggregation for September';
      RAISE NOTICE '   → Command: POST /api/automated/monthly-aggregation {year: 2025, month: 9}';
    ELSE
      RAISE NOTICE '🔴 CRITICAL: September 2025 data completely missing';
      RAISE NOTICE '   → ACTION: Fetch from Meta/Google Ads API';
      RAISE NOTICE '   → Command: POST /api/generate-report for Sept 1-30';
    END IF;
  ELSE
    RAISE NOTICE '✅ September 2025 data exists in campaign_summaries';
  END IF;
  
  IF NOT has_current_cache THEN
    RAISE NOTICE '⚠️  Current month cache is stale (>4 hours old)';
    RAISE NOTICE '   → ACTION: Check if cache refresh cron is running';
    RAISE NOTICE '   → Expected: Refresh every 3 hours';
  ELSE
    RAISE NOTICE '✅ Current month cache is fresh';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'For detailed instructions, see: EMERGENCY_FIX_INSTRUCTIONS.md';
  RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- VERIFICATION COMPLETE
-- ============================================================================
-- Review the output above to understand your current database state
-- Follow recommendations in EMERGENCY_FIX_INSTRUCTIONS.md
-- ============================================================================





