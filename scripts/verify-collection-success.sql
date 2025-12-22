-- VERIFY: Collection was successful
-- Check if data has proper structure (funnel, demographics, campaigns, etc.)

-- ============================================================================
-- CHECK 1: How many weeks were collected?
-- ============================================================================

SELECT 
  '✅ COLLECTION RESULTS' as check_name,
  COUNT(*) as total_weekly_records,
  COUNT(DISTINCT client_id) as clients_with_data,
  COUNT(*) FILTER (WHERE platform = 'meta') as meta_records,
  COUNT(*) FILTER (WHERE platform = 'google') as google_records,
  MIN(summary_date) as earliest_week,
  MAX(summary_date) as latest_week,
  MAX(created_at) as last_collection_time
FROM campaign_summaries
WHERE summary_type = 'weekly';

-- Expected: ~192+ records (12 weeks × 16 clients)

-- ============================================================================
-- CHECK 2: All weeks start on Monday?
-- ============================================================================

SELECT 
  CASE 
    WHEN EXTRACT(DOW FROM summary_date) = 1 THEN '✅ Monday (correct)'
    ELSE '❌ Non-Monday (WRONG!)'
  END as week_start_status,
  COUNT(*) as record_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM campaign_summaries
WHERE summary_type = 'weekly'
GROUP BY EXTRACT(DOW FROM summary_date)
ORDER BY record_count DESC;

-- Expected: 100% Monday

-- ============================================================================
-- CHECK 3: Data has rich content? (campaigns, tables, funnel)
-- ============================================================================

SELECT 
  '📊 DATA RICHNESS CHECK' as check_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE campaign_data IS NOT NULL) as has_campaign_data,
  COUNT(*) FILTER (WHERE meta_tables IS NOT NULL) as has_meta_tables,
  COUNT(*) FILTER (WHERE booking_step_1 > 0 OR reservations > 0) as has_funnel_data,
  COUNT(*) FILTER (WHERE total_spend > 0) as has_spend,
  ROUND(AVG(CASE WHEN campaign_data IS NOT NULL 
    THEN jsonb_array_length(campaign_data::jsonb) 
    ELSE 0 END), 1) as avg_campaigns_per_week
FROM campaign_summaries
WHERE summary_type = 'weekly';

-- All should be > 0 for complete data

-- ============================================================================
-- CHECK 4: Sample of collected data
-- ============================================================================

SELECT 
  c.name as client,
  cs.summary_date,
  TO_CHAR(cs.summary_date, 'Dy') as day,
  cs.platform,
  cs.total_spend,
  cs.reservations,
  cs.booking_step_1,
  CASE 
    WHEN cs.campaign_data IS NOT NULL 
    THEN jsonb_array_length(cs.campaign_data::jsonb)
    ELSE 0
  END as campaign_count,
  CASE WHEN cs.meta_tables IS NOT NULL THEN '✅' ELSE '❌' END as has_tables
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
ORDER BY cs.created_at DESC
LIMIT 20;

-- Check that data looks complete

-- ============================================================================
-- CHECK 5: By client breakdown
-- ============================================================================

SELECT 
  c.name as client_name,
  COUNT(*) as weeks_collected,
  MIN(cs.summary_date) as oldest_week,
  MAX(cs.summary_date) as newest_week,
  SUM(cs.total_spend) as total_spend,
  SUM(cs.reservations) as total_reservations
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
GROUP BY c.name
ORDER BY weeks_collected DESC;

-- Should show 12 weeks per client (or 24 if Meta + Google)



