-- ============================================================================
-- VERIFICATION SCRIPT: Cron Job Health Check
-- ============================================================================
-- Purpose: Verify all automated collection jobs are running correctly
-- Expected: All jobs should have run within their scheduled intervals
-- ============================================================================

-- 1️⃣ Daily KPI Collection Status (should run daily at 1:00 AM)
SELECT 
  '1. Daily KPI Collection' as job_name,
  'Runs: Daily at 1:00 AM' as schedule,
  MAX(created_at) as last_run,
  AGE(NOW(), MAX(created_at)) as time_since_last,
  COUNT(DISTINCT client_id) as clients_collected,
  COUNT(*) as records_created,
  CASE 
    WHEN AGE(NOW(), MAX(created_at)) < INTERVAL '36 hours' THEN '✅ HEALTHY'
    WHEN AGE(NOW(), MAX(created_at)) < INTERVAL '48 hours' THEN '⚠️ WARNING'
    ELSE '❌ FAILED - Not run recently'
  END as status
FROM daily_kpi_data
WHERE created_at >= NOW() - INTERVAL '7 days';

-- 2️⃣ Weekly Summary Collection (should run Sundays at 3:00 AM)
SELECT 
  '2. Weekly Summary Collection' as job_name,
  'Runs: Sundays at 3:00 AM' as schedule,
  MAX(last_updated) as last_run,
  AGE(NOW(), MAX(last_updated)) as time_since_last,
  COUNT(DISTINCT client_id) as clients_collected,
  COUNT(*) as records_updated,
  CASE 
    WHEN AGE(NOW(), MAX(last_updated)) < INTERVAL '8 days' THEN '✅ HEALTHY'
    WHEN AGE(NOW(), MAX(last_updated)) < INTERVAL '10 days' THEN '⚠️ WARNING'
    ELSE '❌ FAILED - Not run recently'
  END as status
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND last_updated >= NOW() - INTERVAL '14 days';

-- 3️⃣ Monthly Summary Collection (should run Sundays at 1:00 AM)
SELECT 
  '3. Monthly Summary Collection' as job_name,
  'Runs: Sundays at 1:00 AM' as schedule,
  MAX(last_updated) as last_run,
  AGE(NOW(), MAX(last_updated)) as time_since_last,
  COUNT(DISTINCT client_id) as clients_collected,
  COUNT(*) as records_updated,
  CASE 
    WHEN AGE(NOW(), MAX(last_updated)) < INTERVAL '8 days' THEN '✅ HEALTHY'
    WHEN AGE(NOW(), MAX(last_updated)) < INTERVAL '10 days' THEN '⚠️ WARNING'
    ELSE '❌ FAILED - Not run recently'
  END as status
FROM campaign_summaries
WHERE summary_type = 'monthly'
  AND last_updated >= NOW() - INTERVAL '14 days';

-- 4️⃣ Smart Cache Status (should refresh every 3 hours)
SELECT 
  '4. Smart Cache - Monthly' as job_name,
  'Runs: Every 3 hours' as schedule,
  MAX(last_updated) as last_refresh,
  AGE(NOW(), MAX(last_updated)) as time_since_last,
  COUNT(DISTINCT client_id) as clients_cached,
  COUNT(*) as cache_entries,
  CASE 
    WHEN AGE(NOW(), MAX(last_updated)) < INTERVAL '4 hours' THEN '✅ HEALTHY'
    WHEN AGE(NOW(), MAX(last_updated)) < INTERVAL '6 hours' THEN '⚠️ WARNING'
    ELSE '❌ FAILED - Cache stale'
  END as status
FROM current_month_cache
WHERE last_updated >= NOW() - INTERVAL '1 day';

-- 5️⃣ Smart Cache - Weekly
SELECT 
  '5. Smart Cache - Weekly' as job_name,
  'Runs: Every 3 hours' as schedule,
  MAX(last_updated) as last_refresh,
  AGE(NOW(), MAX(last_updated)) as time_since_last,
  COUNT(DISTINCT client_id) as clients_cached,
  COUNT(*) as cache_entries,
  CASE 
    WHEN AGE(NOW(), MAX(last_updated)) < INTERVAL '4 hours' THEN '✅ HEALTHY'
    WHEN AGE(NOW(), MAX(last_updated)) < INTERVAL '6 hours' THEN '⚠️ WARNING'
    ELSE '❌ FAILED - Cache stale'
  END as status
FROM current_week_cache
WHERE last_updated >= NOW() - INTERVAL '1 day';

-- 6️⃣ Google Ads Collection (should run daily at 1:15 AM)
SELECT 
  '6. Google Ads Daily Collection' as job_name,
  'Runs: Daily at 1:15 AM' as schedule,
  MAX(last_updated) as last_run,
  AGE(NOW(), MAX(last_updated)) as time_since_last,
  COUNT(DISTINCT client_id) as clients_collected,
  COUNT(*) as records_created,
  CASE 
    WHEN AGE(NOW(), MAX(last_updated)) < INTERVAL '36 hours' THEN '✅ HEALTHY'
    WHEN AGE(NOW(), MAX(last_updated)) < INTERVAL '48 hours' THEN '⚠️ WARNING'
    ELSE '❌ FAILED - Not run recently'
  END as status
FROM campaign_summaries
WHERE platform = 'google'
  AND last_updated >= NOW() - INTERVAL '7 days';

-- 7️⃣ Summary of All Jobs
SELECT 
  '7. Overall Cron Job Health' as summary,
  CASE 
    WHEN COUNT(*) FILTER (WHERE status LIKE '❌%') > 0 THEN '🚨 CRITICAL - Some jobs failing'
    WHEN COUNT(*) FILTER (WHERE status LIKE '⚠️%') > 0 THEN '⚠️ WARNING - Some jobs delayed'
    ELSE '✅ ALL SYSTEMS OPERATIONAL'
  END as overall_status,
  COUNT(*) FILTER (WHERE status LIKE '✅%') as healthy_jobs,
  COUNT(*) FILTER (WHERE status LIKE '⚠️%') as warning_jobs,
  COUNT(*) FILTER (WHERE status LIKE '❌%') as failed_jobs
FROM (
  -- Combine all status checks here
  SELECT status FROM (
    SELECT CASE 
      WHEN AGE(NOW(), MAX(created_at)) < INTERVAL '36 hours' THEN '✅'
      ELSE '❌' 
    END as status
    FROM daily_kpi_data
    WHERE created_at >= NOW() - INTERVAL '7 days'
  ) daily_check
  
  UNION ALL
  
  SELECT CASE 
    WHEN AGE(NOW(), MAX(last_updated)) < INTERVAL '8 days' THEN '✅'
    ELSE '❌' 
  END as status
  FROM campaign_summaries
  WHERE summary_type = 'weekly'
    AND last_updated >= NOW() - INTERVAL '14 days'
) all_checks;

-- 8️⃣ Last 24 Hours Activity
SELECT 
  '8. Last 24 Hours Activity' as check_name,
  'daily_kpi_data' as table_name,
  COUNT(*) as records_created,
  COUNT(DISTINCT client_id) as clients_affected,
  SUM(total_spend)::numeric(12,2) as total_spend_collected
FROM daily_kpi_data
WHERE created_at >= NOW() - INTERVAL '24 hours'

UNION ALL

SELECT 
  '8. Last 24 Hours Activity' as check_name,
  'campaign_summaries' as table_name,
  COUNT(*) as records_updated,
  COUNT(DISTINCT client_id) as clients_affected,
  SUM(total_spend)::numeric(12,2) as total_spend_collected
FROM campaign_summaries
WHERE last_updated >= NOW() - INTERVAL '24 hours';



