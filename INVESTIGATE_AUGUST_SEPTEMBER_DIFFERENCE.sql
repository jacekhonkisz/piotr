-- ============================================================================
-- INVESTIGATION: Why August and September Have Different Data
-- ============================================================================
-- Purpose: Find why some months have zeros, different metrics, different storage
-- Date: October 2, 2025
-- ============================================================================

-- ============================================================================
-- PART 1: Compare August vs September - What exists where?
-- ============================================================================

SELECT 
  'COMPARISON: August vs September' as analysis,
  summary_date,
  TO_CHAR(summary_date, 'Month') as month_name,
  platform,
  summary_type,
  total_spend,
  total_impressions,
  total_clicks,
  total_conversions,
  -- Conversion metrics
  click_to_call,
  email_contacts,
  booking_step_1,
  booking_step_2,
  reservations,
  reservation_value,
  -- Campaign data
  CASE 
    WHEN campaign_data IS NULL THEN 'NULL'
    WHEN jsonb_array_length(campaign_data) = 0 THEN '0 campaigns'
    ELSE jsonb_array_length(campaign_data) || ' campaigns'
  END as campaign_status,
  -- Meta tables
  CASE 
    WHEN meta_tables IS NULL THEN 'NULL'
    ELSE 'EXISTS'
  END as meta_tables_status,
  data_source,
  last_updated,
  AGE(NOW(), last_updated) as data_age
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_type = 'monthly'
  AND summary_date >= '2025-08-01'
  AND summary_date < '2025-10-01'
ORDER BY summary_date DESC;

-- ============================================================================
-- PART 2: Check if data collection method was different
-- ============================================================================

SELECT 
  'DATA COLLECTION TIMELINE' as analysis,
  summary_date,
  TO_CHAR(summary_date, 'Month YYYY') as month,
  data_source,
  platform,
  CASE 
    WHEN campaign_data IS NOT NULL AND jsonb_array_length(campaign_data) > 0 
    THEN 'Rich (has campaigns)'
    WHEN total_spend > 0 AND (campaign_data IS NULL OR jsonb_array_length(campaign_data) = 0)
    THEN 'Aggregated only (no campaigns)'
    ELSE 'Empty/Zero'
  END as data_type,
  jsonb_array_length(COALESCE(campaign_data, '[]'::jsonb)) as campaigns_count,
  total_spend,
  created_at,
  last_updated
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_type = 'monthly'
  AND summary_date >= '2025-07-01'
ORDER BY summary_date DESC;

-- ============================================================================
-- PART 3: Check daily_kpi_data coverage for both months
-- ============================================================================

SELECT 
  'DAILY DATA COVERAGE' as analysis,
  TO_CHAR(date, 'YYYY-MM') as month,
  TO_CHAR(date, 'Month') as month_name,
  COUNT(DISTINCT date) as days_with_data,
  SUM(total_spend) as total_spend,
  SUM(total_impressions) as total_impressions,
  SUM(total_clicks) as total_clicks,
  SUM(total_conversions) as total_conversions,
  data_source,
  MIN(date) as first_date,
  MAX(date) as last_date
FROM daily_kpi_data
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND date >= '2025-08-01'
  AND date < '2025-10-01'
GROUP BY TO_CHAR(date, 'YYYY-MM'), TO_CHAR(date, 'Month'), data_source
ORDER BY month DESC;

-- Expected: Should show 31 days for August, 30 days for September

-- ============================================================================
-- PART 4: Check if August has campaign_data vs September
-- ============================================================================

SELECT 
  'CAMPAIGN DATA COMPARISON' as analysis,
  summary_date,
  jsonb_array_length(COALESCE(campaign_data, '[]'::jsonb)) as campaigns_in_summary,
  -- Sample first campaign if exists
  CASE 
    WHEN campaign_data IS NOT NULL AND jsonb_array_length(campaign_data) > 0
    THEN campaign_data->0->>'campaign_name'
    ELSE 'NO CAMPAIGNS'
  END as first_campaign_name,
  -- Sum of campaign spends
  (
    SELECT ROUND(SUM((c->>'spend')::numeric), 2)
    FROM jsonb_array_elements(COALESCE(campaign_data, '[]'::jsonb)) as c
  ) as sum_of_campaigns_spend,
  total_spend as stored_total_spend,
  -- Difference
  total_spend - COALESCE((
    SELECT SUM((c->>'spend')::numeric)
    FROM jsonb_array_elements(COALESCE(campaign_data, '[]'::jsonb)) as c
  ), 0) as difference
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_type = 'monthly'
  AND summary_date IN ('2025-08-01', '2025-09-01');

-- ============================================================================
-- PART 5: Check conversion metrics - why some are zeros?
-- ============================================================================

SELECT 
  'CONVERSION METRICS ANALYSIS' as analysis,
  summary_date,
  TO_CHAR(summary_date, 'Month') as month,
  total_spend,
  -- Meta standard metrics
  total_impressions,
  total_clicks,
  total_conversions,
  -- Custom conversion metrics
  click_to_call,
  email_contacts,
  booking_step_1,
  booking_step_2,
  reservations,
  reservation_value,
  -- Check if any conversions exist
  CASE 
    WHEN COALESCE(click_to_call, 0) + COALESCE(email_contacts, 0) + 
         COALESCE(booking_step_1, 0) + COALESCE(reservations, 0) = 0
    THEN '❌ ALL ZEROS'
    ELSE '✅ HAS CONVERSIONS'
  END as conversion_status
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_type = 'monthly'
  AND summary_date >= '2025-07-01'
ORDER BY summary_date DESC;

-- ============================================================================
-- PART 6: Check if backfill was run for both months
-- ============================================================================

SELECT 
  'BACKFILL HISTORY CHECK' as analysis,
  summary_date,
  created_at as initially_created,
  last_updated as last_modified,
  AGE(last_updated, created_at) as time_between_create_and_update,
  CASE 
    WHEN DATE(created_at) = DATE(last_updated) THEN 'Created and never updated'
    WHEN AGE(last_updated, created_at) < INTERVAL '1 hour' THEN 'Updated within 1 hour'
    ELSE 'Updated later (possibly backfilled)'
  END as update_pattern
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_type = 'monthly'
  AND summary_date >= '2025-07-01'
ORDER BY summary_date DESC;

-- ============================================================================
-- PART 7: Deep dive - Check actual campaign data structure
-- ============================================================================

SELECT 
  'CAMPAIGN DATA STRUCTURE' as analysis,
  summary_date,
  TO_CHAR(summary_date, 'Month') as month,
  jsonb_array_length(COALESCE(campaign_data, '[]'::jsonb)) as campaigns_count,
  -- Show structure of first campaign
  CASE 
    WHEN campaign_data IS NOT NULL AND jsonb_array_length(campaign_data) > 0
    THEN jsonb_pretty(campaign_data->0)
    ELSE 'No campaign data'
  END as first_campaign_structure
FROM campaign_summaries
WHERE client_id = '8657100a-6e87-422c-97f4-b733754a9ff8'
  AND summary_type = 'monthly'
  AND summary_date IN ('2025-08-01', '2025-09-01')
ORDER BY summary_date DESC;

-- ============================================================================
-- PART 8: Check all clients - is this issue specific to one client?
-- ============================================================================

SELECT 
  'ALL CLIENTS COMPARISON' as analysis,
  c.company_name,
  cs.summary_date,
  cs.total_spend,
  jsonb_array_length(COALESCE(cs.campaign_data, '[]'::jsonb)) as campaigns,
  CASE 
    WHEN cs.campaign_data IS NULL THEN 'NULL'
    WHEN jsonb_array_length(cs.campaign_data) = 0 THEN 'EMPTY ARRAY'
    ELSE 'HAS DATA'
  END as campaign_data_status
FROM campaign_summaries cs
LEFT JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'monthly'
  AND cs.summary_date >= '2025-08-01'
  AND cs.summary_date < '2025-10-01'
ORDER BY c.company_name, cs.summary_date DESC;

-- ============================================================================
-- EXPECTED FINDINGS
-- ============================================================================

/*
Possible Scenarios:

SCENARIO 1: August wasn't backfilled properly
  - August: Created from daily aggregation → No campaign_data
  - September: Backfilled from API → Has campaign_data
  - Fix: Run backfill for August with forceRefresh=true

SCENARIO 2: Data collection method changed
  - August: Collected before campaign_summaries table existed
  - September: Collected after system was fixed
  - Fix: Backfill August from API

SCENARIO 3: Different data sources
  - August: Has only daily_kpi_data (aggregated)
  - September: Has campaign_summaries (detailed)
  - Fix: Ensure consistent collection

SCENARIO 4: Conversion tracking wasn't enabled in August
  - August: No custom conversions tracked (all zeros)
  - September: Conversions tracked properly
  - Not a bug: Client started tracking conversions in September

SCENARIO 5: Platform/data_source confusion
  - August: Stored without platform field (NULL)
  - September: Stored with platform='meta'
  - Queries filter by platform → August not found
*/

