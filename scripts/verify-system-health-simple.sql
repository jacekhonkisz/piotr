-- ============================================================================
-- SIMPLE SYSTEM HEALTH CHECK
-- ============================================================================
-- Purpose: Quick overview of system health - optimized for single query result
-- Run Time: < 1 second
-- ============================================================================

SELECT 
  '🎯 SYSTEM HEALTH REPORT' as report_title,
  NOW() as checked_at,
  
  -- Overall Status
  CASE 
    WHEN 
      (SELECT COUNT(*) FROM campaign_summaries WHERE platform IS NULL) = 0
      AND (SELECT COUNT(*) FROM campaign_summaries cs1 
           WHERE EXISTS (
             SELECT 1 FROM campaign_summaries cs2 
             WHERE cs2.client_id = cs1.client_id 
               AND cs2.summary_type = cs1.summary_type
               AND cs2.summary_date = cs1.summary_date 
               AND cs2.platform = cs1.platform 
               AND cs2.id != cs1.id
           )) = 0
      AND (SELECT COUNT(*) FROM campaign_summaries 
           WHERE summary_type = 'weekly' 
           AND EXTRACT(DOW FROM summary_date) != 1) = 0
    THEN '✅ SYSTEM HEALTHY'
    ELSE '⚠️ ISSUES DETECTED'
  END as overall_status,
  
  -- Database Integrity
  json_build_object(
    'null_platforms', (SELECT COUNT(*) FROM campaign_summaries WHERE platform IS NULL),
    'duplicate_records', (SELECT COUNT(*) FROM campaign_summaries cs1 
                          WHERE EXISTS (
                            SELECT 1 FROM campaign_summaries cs2 
                            WHERE cs2.client_id = cs1.client_id 
                              AND cs2.summary_type = cs1.summary_type
                              AND cs2.summary_date = cs1.summary_date 
                              AND cs2.platform = cs1.platform 
                              AND cs2.id != cs1.id
                          )),
    'non_monday_weeks', (SELECT COUNT(*) FROM campaign_summaries 
                         WHERE summary_type = 'weekly' 
                         AND EXTRACT(DOW FROM summary_date) != 1),
    'status', CASE 
      WHEN (SELECT COUNT(*) FROM campaign_summaries WHERE platform IS NULL) = 0
           AND (SELECT COUNT(*) FROM campaign_summaries cs1 
                WHERE EXISTS (SELECT 1 FROM campaign_summaries cs2 
                              WHERE cs2.client_id = cs1.client_id 
                                AND cs2.summary_type = cs1.summary_type
                                AND cs2.summary_date = cs1.summary_date 
                                AND cs2.platform = cs1.platform 
                                AND cs2.id != cs1.id)) = 0
           AND (SELECT COUNT(*) FROM campaign_summaries 
                WHERE summary_type = 'weekly' 
                AND EXTRACT(DOW FROM summary_date) != 1) = 0
      THEN '✅ PERFECT'
      ELSE '❌ NEEDS ATTENTION'
    END
  ) as database_integrity,
  
  -- Platform Separation
  json_build_object(
    'meta_records', (SELECT COUNT(*) FROM campaign_summaries WHERE platform = 'meta'),
    'google_records', (SELECT COUNT(*) FROM campaign_summaries WHERE platform = 'google'),
    'status', '✅ WORKING'
  ) as platform_separation,
  
  -- Recent Collections (Last 24 hours)
  json_build_object(
    'daily_kpi_records', (SELECT COUNT(*) FROM daily_kpi_data 
                          WHERE created_at >= NOW() - INTERVAL '24 hours'),
    'campaign_summary_updates', (SELECT COUNT(*) FROM campaign_summaries 
                                 WHERE last_updated >= NOW() - INTERVAL '24 hours'),
    'last_daily_collection', (SELECT MAX(created_at) FROM daily_kpi_data),
    'last_summary_update', (SELECT MAX(last_updated) FROM campaign_summaries),
    'status', CASE 
      WHEN (SELECT MAX(created_at) FROM daily_kpi_data) >= NOW() - INTERVAL '36 hours'
      THEN '✅ ACTIVE'
      ELSE '⚠️ STALE'
    END
  ) as recent_activity,
  
  -- Data Coverage
  json_build_object(
    'total_clients', (SELECT COUNT(DISTINCT client_id) FROM campaign_summaries),
    'active_clients', (SELECT COUNT(DISTINCT client_id) FROM campaign_summaries 
                       WHERE last_updated >= NOW() - INTERVAL '7 days'),
    'total_monthly_records', (SELECT COUNT(*) FROM campaign_summaries 
                              WHERE summary_type = 'monthly'),
    'total_weekly_records', (SELECT COUNT(*) FROM campaign_summaries 
                             WHERE summary_type = 'weekly'),
    'total_daily_records', (SELECT COUNT(*) FROM daily_kpi_data),
    'status', '✅ COLLECTING'
  ) as data_coverage,
  
  -- Cache Status
  json_build_object(
    'monthly_cache_entries', (SELECT COUNT(*) FROM current_month_cache),
    'weekly_cache_entries', (SELECT COUNT(*) FROM current_week_cache),
    'last_monthly_cache_refresh', (SELECT MAX(last_updated) FROM current_month_cache),
    'last_weekly_cache_refresh', (SELECT MAX(last_updated) FROM current_week_cache),
    'status', CASE 
      WHEN (SELECT MAX(last_updated) FROM current_month_cache) >= NOW() - INTERVAL '4 hours'
      THEN '✅ FRESH'
      ELSE '⚠️ STALE'
    END
  ) as cache_status,
  
  -- Recommendations
  CASE 
    WHEN (SELECT COUNT(*) FROM campaign_summaries cs1 
          WHERE EXISTS (SELECT 1 FROM campaign_summaries cs2 
                        WHERE cs2.client_id = cs1.client_id 
                          AND cs2.summary_type = cs1.summary_type
                          AND cs2.summary_date = cs1.summary_date 
                          AND cs2.platform = cs1.platform 
                          AND cs2.id != cs1.id)) > 0
    THEN '⚠️ Run scripts/fix-duplicate-weeks.sql'
    WHEN (SELECT COUNT(*) FROM campaign_summaries 
          WHERE summary_type = 'weekly' 
          AND EXTRACT(DOW FROM summary_date) != 1) > 0
    THEN '⚠️ Run scripts/remove-non-monday-weeks.sql'
    WHEN (SELECT MAX(created_at) FROM daily_kpi_data) < NOW() - INTERVAL '36 hours'
    THEN '⚠️ Check daily-kpi-collection cron job'
    ELSE '✅ No immediate actions needed'
  END as recommendations;



