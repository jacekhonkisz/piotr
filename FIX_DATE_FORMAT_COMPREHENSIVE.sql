-- ============================================================================
-- COMPREHENSIVE FIX: Normalize ALL monthly dates to first day of month
-- ============================================================================
-- Problem: Some records stored with last day of month (28th, 30th, 31st)
-- Root Cause: Old unique constraint didn't include platform, caused date conflicts
-- Solution: Normalize all dates + handle duplicates
-- ============================================================================

-- ============================================================================
-- STEP 1: DIAGNOSTIC - What will be affected?
-- ============================================================================

-- Total records to fix (globally)
SELECT 
  '📊 GLOBAL: Records to Fix' as status,
  COUNT(*) as count,
  COUNT(DISTINCT client_id) as affected_clients
FROM campaign_summaries
WHERE summary_type = 'monthly'
  AND EXTRACT(DAY FROM summary_date) != 1;

-- Breakdown by client
SELECT 
  c.name as client_name,
  c.email,
  cs.platform,
  COUNT(*) as wrong_date_records,
  STRING_AGG(DISTINCT EXTRACT(DAY FROM cs.summary_date)::text, ', ' ORDER BY EXTRACT(DAY FROM cs.summary_date)::text) as days_found
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'monthly'
  AND EXTRACT(DAY FROM cs.summary_date) != 1
GROUP BY c.name, c.email, cs.platform
ORDER BY COUNT(*) DESC;

-- ============================================================================
-- STEP 2: CHECK FOR POTENTIAL DUPLICATES
-- ============================================================================
-- This checks if normalizing dates will create duplicates
-- (e.g., if both 2024-09-30 and 2024-09-01 exist, they'll conflict)

WITH normalized_check AS (
  SELECT 
    client_id,
    platform,
    summary_type,
    DATE_TRUNC('month', summary_date)::date as normalized_date,
    COUNT(*) as record_count,
    STRING_AGG(summary_date::text, ', ' ORDER BY summary_date) as current_dates,
    STRING_AGG(total_spend::text, ', ' ORDER BY summary_date) as spend_values
  FROM campaign_summaries
  WHERE summary_type = 'monthly'
  GROUP BY 
    client_id,
    platform,
    summary_type,
    DATE_TRUNC('month', summary_date)::date
  HAVING COUNT(*) > 1
)
SELECT 
  c.name as client_name,
  nc.platform,
  nc.normalized_date,
  nc.record_count as duplicate_count,
  nc.current_dates,
  nc.spend_values,
  '⚠️ NEEDS MERGE' as warning
FROM normalized_check nc
JOIN clients c ON c.id = nc.client_id
ORDER BY nc.record_count DESC, c.name;

-- ============================================================================
-- STEP 3: SAFE FIX - Normalize dates (handles duplicates)
-- ============================================================================

BEGIN;

-- Create temp table to track changes
CREATE TEMP TABLE date_fix_log (
  client_id UUID,
  client_name TEXT,
  platform TEXT,
  old_date DATE,
  new_date DATE,
  action TEXT,
  total_spend DECIMAL,
  record_id UUID
);

-- Log all records that will be changed
INSERT INTO date_fix_log
SELECT 
  cs.client_id,
  c.name,
  cs.platform,
  cs.summary_date as old_date,
  DATE_TRUNC('month', cs.summary_date)::date as new_date,
  'TO_NORMALIZE' as action,
  cs.total_spend,
  cs.id
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'monthly'
  AND EXTRACT(DAY FROM cs.summary_date) != 1;

-- Show what will be changed
SELECT 
  client_name,
  platform,
  old_date,
  new_date,
  TO_CHAR(old_date, 'Mon YYYY') as month,
  total_spend
FROM date_fix_log
ORDER BY client_name, old_date;

-- ============================================================================
-- OPTION A: Simple Fix (if no duplicates detected)
-- ============================================================================
-- Uncomment this if STEP 2 showed NO duplicates:

/*
UPDATE campaign_summaries
SET summary_date = DATE_TRUNC('month', summary_date)::date
WHERE summary_type = 'monthly'
  AND EXTRACT(DAY FROM summary_date) != 1;

SELECT 
  '✅ FIXED: All dates normalized' as status,
  COUNT(*) as records_updated
FROM date_fix_log;
*/

-- ============================================================================
-- OPTION B: Smart Fix with Duplicate Handling
-- ============================================================================
-- Use this if STEP 2 showed duplicates exist

-- For each duplicate set, keep the record with correct date (day 1)
-- and UPDATE records with wrong dates to merge into it
DO $$
DECLARE
  wrong_date_record RECORD;
  correct_date_record RECORD;
  normalized_date DATE;
BEGIN
  -- Loop through all records with wrong dates
  FOR wrong_date_record IN 
    SELECT * FROM campaign_summaries
    WHERE summary_type = 'monthly'
      AND EXTRACT(DAY FROM summary_date) != 1
    ORDER BY client_id, platform, summary_date
  LOOP
    -- Calculate what the correct date should be
    normalized_date := DATE_TRUNC('month', wrong_date_record.summary_date)::date;
    
    -- Check if a record with correct date already exists
    SELECT * INTO correct_date_record
    FROM campaign_summaries
    WHERE client_id = wrong_date_record.client_id
      AND platform = wrong_date_record.platform
      AND summary_type = 'monthly'
      AND summary_date = normalized_date
    LIMIT 1;
    
    IF FOUND THEN
      -- Duplicate exists! Need to merge
      RAISE NOTICE '⚠️  Duplicate found for % (%) - merging % into %', 
        wrong_date_record.client_id,
        wrong_date_record.platform,
        wrong_date_record.summary_date,
        normalized_date;
      
      -- Merge: Update the correct record with max values
      UPDATE campaign_summaries
      SET
        total_spend = GREATEST(total_spend, wrong_date_record.total_spend),
        total_impressions = GREATEST(total_impressions, wrong_date_record.total_impressions),
        total_clicks = GREATEST(total_clicks, wrong_date_record.total_clicks),
        total_conversions = GREATEST(total_conversions, wrong_date_record.total_conversions),
        -- Keep campaign_data from the richer record (more campaigns)
        campaign_data = CASE
          WHEN COALESCE(jsonb_array_length(campaign_data), 0) < COALESCE(jsonb_array_length(wrong_date_record.campaign_data), 0)
          THEN wrong_date_record.campaign_data
          ELSE campaign_data
        END,
        last_updated = NOW()
      WHERE id = correct_date_record.id;
      
      -- Delete the duplicate with wrong date
      DELETE FROM campaign_summaries WHERE id = wrong_date_record.id;
      
    ELSE
      -- No duplicate, just normalize the date
      UPDATE campaign_summaries
      SET summary_date = normalized_date
      WHERE id = wrong_date_record.id;
      
      RAISE NOTICE '✅ Normalized date for % (%) from % to %',
        wrong_date_record.client_id,
        wrong_date_record.platform,
        wrong_date_record.summary_date,
        normalized_date;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 4: VERIFICATION
-- ============================================================================

-- Verify all monthly dates are now on day 1
SELECT 
  '✅ VERIFICATION: All dates correct' as status,
  COUNT(*) as total_monthly_records,
  COUNT(*) FILTER (WHERE EXTRACT(DAY FROM summary_date) = 1) as correct_dates,
  COUNT(*) FILTER (WHERE EXTRACT(DAY FROM summary_date) != 1) as wrong_dates
FROM campaign_summaries
WHERE summary_type = 'monthly';

-- Show Belmonte's corrected data
SELECT 
  '🏨 BELMONTE: After Fix' as status,
  summary_date,
  EXTRACT(DAY FROM summary_date) as day,
  platform,
  total_spend,
  total_impressions,
  (campaign_data IS NOT NULL) as has_campaigns
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE email = 'belmonte@hotel.com' LIMIT 1)
  AND summary_type = 'monthly'
ORDER BY summary_date DESC;

-- Summary of fix
SELECT 
  'Summary' as metric,
  COUNT(DISTINCT record_id) as value
FROM date_fix_log
UNION ALL
SELECT 
  'Clients Affected',
  COUNT(DISTINCT client_id)
FROM date_fix_log
UNION ALL
SELECT 
  'Date Changes',
  COUNT(DISTINCT old_date || '->' || new_date)
FROM date_fix_log;

-- COMMIT when ready (or ROLLBACK to undo)
-- ROLLBACK;  -- Uncomment to undo changes
COMMIT;  -- Uncomment to apply changes

-- ============================================================================
-- STEP 5: TEST QUERY (run after fix)
-- ============================================================================
-- This simulates what StandardizedDataFetcher does

-- Test: October 2024 for Belmonte
SELECT 
  'TEST: October 2024' as test,
  *
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE email = 'belmonte@hotel.com' LIMIT 1)
  AND summary_type = 'monthly'
  AND platform = 'meta'
  AND summary_date = '2024-10-01';  -- Exact match that app expects

-- Test: All recent months for Belmonte
SELECT 
  TO_CHAR(summary_date, 'Mon YYYY') as month,
  summary_date,
  platform,
  total_spend,
  total_impressions
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE email = 'belmonte@hotel.com' LIMIT 1)
  AND summary_type = 'monthly'
  AND platform = 'meta'
  AND summary_date >= '2024-01-01'
ORDER BY summary_date DESC;


