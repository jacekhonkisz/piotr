-- ============================================================================
-- QUICK DATA SOURCE CHECK - SIMPLIFIED VERSION
-- ============================================================================
-- Quick check to see what data sources exist for a client/period
-- ============================================================================

-- Replace these values:
\set CLIENT_ID 'PASTE_CLIENT_ID_HERE'
\set PERIOD_START '2026-01-01'
\set PERIOD_END '2026-01-31'
\set PLATFORM 'meta'

-- Check all sources at once
SELECT 
  'SMART_CACHE' as source,
  EXISTS(
    SELECT 1 FROM current_month_cache 
    WHERE client_id = :'CLIENT_ID'
      AND period_id = TO_CHAR(TO_DATE(:'PERIOD_START', 'YYYY-MM-DD'), 'YYYY-MM')
  ) as exists,
  (SELECT last_updated FROM current_month_cache 
   WHERE client_id = :'CLIENT_ID'
     AND period_id = TO_CHAR(TO_DATE(:'PERIOD_START', 'YYYY-MM-DD'), 'YYYY-MM')
   ORDER BY last_updated DESC LIMIT 1) as last_updated
UNION ALL
SELECT 
  'CAMPAIGN_SUMMARIES' as source,
  EXISTS(
    SELECT 1 FROM campaign_summaries 
    WHERE client_id = :'CLIENT_ID'
      AND platform = :'PLATFORM'
      AND summary_date >= :'PERIOD_START'
      AND summary_date <= :'PERIOD_END'
  ) as exists,
  (SELECT MAX(last_updated) FROM campaign_summaries 
   WHERE client_id = :'CLIENT_ID'
     AND platform = :'PLATFORM'
     AND summary_date >= :'PERIOD_START'
     AND summary_date <= :'PERIOD_END') as last_updated
UNION ALL
SELECT 
  'DAILY_KPI_DATA' as source,
  EXISTS(
    SELECT 1 FROM daily_kpi_data 
    WHERE client_id = :'CLIENT_ID'
      AND data_source = CASE 
        WHEN :'PLATFORM' = 'meta' THEN 'meta_api'
        WHEN :'PLATFORM' = 'google' THEN 'google_ads_api'
        ELSE :'PLATFORM'
      END
      AND date >= :'PERIOD_START'
      AND date <= :'PERIOD_END'
  ) as exists,
  (SELECT MAX(updated_at) FROM daily_kpi_data 
   WHERE client_id = :'CLIENT_ID'
     AND data_source = CASE 
       WHEN :'PLATFORM' = 'meta' THEN 'meta_api'
       WHEN :'PLATFORM' = 'google' THEN 'google_ads_api'
       ELSE :'PLATFORM'
     END
     AND date >= :'PERIOD_START'
     AND date <= :'PERIOD_END') as last_updated;

