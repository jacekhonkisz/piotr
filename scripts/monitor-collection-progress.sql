-- ═══════════════════════════════════════════════════════════════════
-- 📊 MONITOR COLLECTION PROGRESS
-- ═══════════════════════════════════════════════════════════════════
-- Run this periodically while collection is in progress
-- ═══════════════════════════════════════════════════════════════════

-- Current total count
SELECT 
  '📊 CURRENT TOTALS' as info,
  COUNT(*) as total_weekly_records,
  COUNT(DISTINCT client_id) as clients_with_data,
  MIN(summary_date) as earliest_week,
  MAX(summary_date) as latest_week,
  ROUND(SUM(total_spend)::numeric, 2) as total_spend,
  SUM(reservations) as total_reservations,
  SUM(booking_step_1) as total_booking_step_1
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND platform = 'meta';

-- Records created in last 5 minutes (shows if collection is active)
SELECT 
  '🔄 RECENT ACTIVITY (Last 5 min)' as info,
  COUNT(*) as records_created,
  COUNT(DISTINCT client_id) as clients,
  COUNT(DISTINCT summary_date) as unique_weeks,
  MIN(summary_date) as earliest_week_added,
  MAX(summary_date) as latest_week_added
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND platform = 'meta'
  AND created_at >= NOW() - INTERVAL '5 minutes';

-- Coverage calculation
WITH target AS (
  SELECT 16 as total_clients, 52 as weeks_per_client
)
SELECT 
  '📈 COVERAGE PROGRESS' as info,
  (SELECT total_clients * weeks_per_client FROM target) as expected_records,
  COUNT(*) as actual_records,
  (SELECT total_clients * weeks_per_client FROM target) - COUNT(*) as still_missing,
  ROUND(100.0 * COUNT(*) / (SELECT total_clients * weeks_per_client FROM target), 1) || '%' as coverage_percent
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND platform = 'meta'
  AND summary_date >= DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' - INTERVAL '52 weeks';

-- Latest records by client
SELECT 
  '👥 LATEST BY CLIENT' as info,
  c.name as client_name,
  COUNT(*) as weekly_records,
  MAX(cs.summary_date) as latest_week,
  MAX(cs.created_at) as last_update,
  CASE 
    WHEN MAX(cs.created_at) >= NOW() - INTERVAL '5 minutes' THEN '🟢 ACTIVE'
    WHEN MAX(cs.created_at) >= NOW() - INTERVAL '1 hour' THEN '🟡 RECENT'
    ELSE '⚪ OLDER'
  END as status
FROM clients c
LEFT JOIN campaign_summaries cs ON cs.client_id = c.id 
  AND cs.summary_type = 'weekly'
  AND cs.platform = 'meta'
WHERE c.api_status = 'valid'
GROUP BY c.name
ORDER BY MAX(cs.created_at) DESC NULLS LAST;

-- Check for conversion data (verify fix is working)
SELECT 
  '✅ CONVERSION DATA CHECK' as info,
  COUNT(*) as total_records,
  COUNT(CASE WHEN reservations > 0 THEN 1 END) as records_with_reservations,
  COUNT(CASE WHEN booking_step_1 > 0 THEN 1 END) as records_with_booking_step_1,
  ROUND(100.0 * COUNT(CASE WHEN reservations > 0 OR booking_step_1 > 0 THEN 1 END) / NULLIF(COUNT(*), 0), 1) || '%' as conversion_data_percent
FROM campaign_summaries
WHERE summary_type = 'weekly'
  AND platform = 'meta'
  AND created_at >= CURRENT_DATE; -- Today's collection

-- Time estimate
WITH collection_stats AS (
  SELECT 
    COUNT(*) as collected_so_far,
    MIN(created_at) as started_at,
    (SELECT 16 * 52 FROM (SELECT 1) x) as total_target
  FROM campaign_summaries
  WHERE summary_type = 'weekly'
    AND platform = 'meta'
    AND created_at >= CURRENT_DATE
)
SELECT 
  '⏱️ TIME ESTIMATE' as info,
  collected_so_far,
  total_target,
  total_target - collected_so_far as remaining,
  EXTRACT(EPOCH FROM (NOW() - started_at)) / 60 as minutes_elapsed,
  CASE 
    WHEN collected_so_far > 0 THEN
      ROUND(
        (EXTRACT(EPOCH FROM (NOW() - started_at)) / 60) * 
        ((total_target - collected_so_far)::numeric / collected_so_far::numeric),
        1
      )
    ELSE NULL
  END as estimated_minutes_remaining
FROM collection_stats;



