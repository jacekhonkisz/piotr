-- ============================================================================
-- DIAGNOSTIC AUDIT - FIND OUT WHAT'S WRONG
-- ============================================================================
-- Purpose: Check what tables exist and what's causing issues
-- ============================================================================

-- Check if basic tables exist
SELECT 
  'TABLE CHECK' as check_type,
  table_name,
  CASE 
    WHEN table_name = 'clients' THEN 'CRITICAL - Core table'
    WHEN table_name = 'profiles' THEN 'CRITICAL - Auth table'
    WHEN table_name = 'campaign_summaries' THEN 'IMPORTANT - Reports data'
    WHEN table_name = 'current_month_cache' THEN 'IMPORTANT - Cache'
    WHEN table_name = 'daily_kpi_data' THEN 'IMPORTANT - Daily metrics'
    ELSE 'OTHER'
  END as importance,
  'EXISTS' as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('clients', 'profiles', 'campaign_summaries', 'current_month_cache', 'daily_kpi_data')
ORDER BY 
  CASE 
    WHEN table_name IN ('clients', 'profiles') THEN 1
    WHEN table_name IN ('campaign_summaries', 'current_month_cache', 'daily_kpi_data') THEN 2
    ELSE 3
  END;

-- Check clients table specifically
SELECT 
  'CLIENTS COUNT' as check_type,
  COUNT(*) as client_count,
  COUNT(CASE WHEN api_status = 'valid' THEN 1 END) as valid_clients,
  COUNT(CASE WHEN meta_access_token IS NOT NULL THEN 1 END) as clients_with_meta,
  COUNT(CASE WHEN google_ads_access_token IS NOT NULL THEN 1 END) as clients_with_google
FROM clients;

-- Check campaign_summaries if it exists
SELECT 
  'CAMPAIGN SUMMARIES COUNT' as check_type,
  COUNT(*) as total_records,
  COUNT(DISTINCT client_id) as unique_clients,
  COUNT(CASE WHEN summary_type = 'monthly' THEN 1 END) as monthly_records,
  MIN(summary_date) as earliest_date,
  MAX(summary_date) as latest_date
FROM campaign_summaries;

-- Check current_month_cache if it exists
SELECT 
  'CURRENT MONTH CACHE COUNT' as check_type,
  COUNT(*) as cache_records,
  COUNT(DISTINCT client_id) as clients_with_cache,
  MIN(period_id) as earliest_period,
  MAX(period_id) as latest_period
FROM current_month_cache;

-- Check daily_kpi_data if it exists
SELECT 
  'DAILY KPI DATA COUNT' as check_type,
  COUNT(*) as daily_records,
  COUNT(DISTINCT client_id) as clients_with_daily_data,
  MIN(date) as earliest_date,
  MAX(date) as latest_date
FROM daily_kpi_data;

-- Simple missing months check
WITH last_6_months AS (
  SELECT 
    generate_series(
      DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months')::date,
      DATE_TRUNC('month', CURRENT_DATE)::date,
      '1 month'::interval
    )::date as month_date
),
client_months AS (
  SELECT 
    c.id as client_id,
    c.name as client_name,
    m.month_date
  FROM clients c
  CROSS JOIN last_6_months m
)
SELECT 
  'MISSING MONTHS CHECK' as check_type,
  cm.client_name,
  COUNT(*) as months_expected,
  COUNT(cs.id) as months_with_data,
  (COUNT(*) - COUNT(cs.id)) as missing_months
FROM client_months cm
LEFT JOIN campaign_summaries cs 
  ON cs.client_id = cm.client_id 
  AND cs.summary_date = cm.month_date
  AND cs.summary_type = 'monthly'
GROUP BY cm.client_id, cm.client_name
ORDER BY missing_months DESC;

