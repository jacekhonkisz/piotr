-- DIAGNOSE: Why Weekly Reports Still Show Data
-- Simple check - no fancy tables, just what exists

-- ============================================================================
-- CHECK 1: What's ACTUALLY in campaign_summaries?
-- ============================================================================

SELECT 
  '📊 WEEKLY DATA IN campaign_summaries' as check_name,
  COUNT(*) as total_weekly_records,
  COUNT(DISTINCT client_id) as unique_clients,
  COUNT(*) FILTER (WHERE platform = 'meta') as meta_records,
  COUNT(*) FILTER (WHERE platform = 'google') as google_records,
  MIN(summary_date) as earliest_week,
  MAX(summary_date) as latest_week
FROM campaign_summaries
WHERE summary_type = 'weekly';

-- If this shows 0, weekly data was deleted
-- If this shows records, deletion didn't work!

-- ============================================================================
-- CHECK 2: Sample of weekly data (if any exists)
-- ============================================================================

SELECT 
  c.name as client_name,
  cs.summary_date,
  TO_CHAR(cs.summary_date, 'Dy') as day_of_week,
  cs.platform,
  cs.total_spend,
  cs.reservations,
  cs.created_at as when_created
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'weekly'
ORDER BY cs.created_at DESC
LIMIT 10;

-- This shows the most recently created weekly records

-- ============================================================================
-- CHECK 3: Check if there's a VIEW or materialized view
-- ============================================================================

SELECT 
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE viewname LIKE '%week%' OR viewname LIKE '%campaign%'
ORDER BY viewname;

-- Check for views that might be aggregating data

-- ============================================================================
-- CHECK 4: Check for other tables that might store weekly data
-- ============================================================================

SELECT 
  tablename,
  schemaname
FROM pg_tables
WHERE schemaname = 'public'
  AND (
    tablename LIKE '%week%' 
    OR tablename LIKE '%campaign%'
    OR tablename LIKE '%summary%'
  )
ORDER BY tablename;

-- List all tables that might contain weekly data

-- ============================================================================
-- CHECK 5: What tables exist in your database?
-- ============================================================================

SELECT 
  tablename,
  schemaname
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Full list of all tables

-- ============================================================================
-- CHECK 6: If weekly data exists, check when it was created
-- ============================================================================

SELECT 
  DATE(created_at) as creation_date,
  COUNT(*) as records_created,
  COUNT(DISTINCT client_id) as clients,
  MIN(summary_date) as min_week,
  MAX(summary_date) as max_week
FROM campaign_summaries
WHERE summary_type = 'weekly'
GROUP BY DATE(created_at)
ORDER BY creation_date DESC
LIMIT 10;

-- Shows when weekly records were created
-- If you see today's date, new records were added after deletion!

-- ============================================================================
-- DIAGNOSTIC SUMMARY
-- ============================================================================

/*
Based on the results above:

SCENARIO 1: CHECK 1 shows 0 records
   → Weekly data was deleted successfully
   → Reports must be generating data on-the-fly from another source
   → Check: daily_kpi_data aggregation or live API calls

SCENARIO 2: CHECK 1 shows records
   → Deletion didn't work OR new data was collected
   → Check creation dates in CHECK 6
   → If created today: automatic collection ran after deletion
   → If created before: deletion command didn't execute

SCENARIO 3: CHECK 3 shows views
   → Reports might be using a VIEW instead of direct table
   → Need to update or drop the view

SCENARIO 4: CHECK 4 shows other tables
   → Weekly data might be in backup/archive tables
   → Check those tables
*/

