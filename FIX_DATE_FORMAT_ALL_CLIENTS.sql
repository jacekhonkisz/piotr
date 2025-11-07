-- ============================================================================
-- FIX DATE FORMAT IN campaign_summaries
-- ============================================================================
-- Problem: Some monthly records stored with last day of month instead of first
-- Solution: Normalize ALL dates to the first day of the month
-- ============================================================================

-- STEP 1: BACKUP CHECK - See what will be changed
-- ============================================================================
SELECT 
  'Before Fix - Wrong Dates' as status,
  COUNT(*) as count
FROM campaign_summaries
WHERE summary_type = 'monthly'
  AND EXTRACT(DAY FROM summary_date) != 1;

-- Show detailed breakdown by client
SELECT 
  c.name as client_name,
  c.email,
  COUNT(*) as wrong_date_records,
  MIN(cs.summary_date) as oldest,
  MAX(cs.summary_date) as newest
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_type = 'monthly'
  AND EXTRACT(DAY FROM cs.summary_date) != 1
GROUP BY c.name, c.email
ORDER BY COUNT(*) DESC;

-- ============================================================================
-- STEP 2: THE FIX - Normalize all monthly dates to first day of month
-- ============================================================================
-- This uses DATE_TRUNC to move dates to the first day of their month

BEGIN;

-- Show what WILL be updated
SELECT 
  client_id,
  summary_date as old_date,
  DATE_TRUNC('month', summary_date)::date as new_date,
  TO_CHAR(summary_date, 'Mon YYYY') as month,
  total_spend,
  total_impressions
FROM campaign_summaries
WHERE summary_type = 'monthly'
  AND EXTRACT(DAY FROM summary_date) != 1
ORDER BY summary_date;

-- Uncomment below to execute the fix:
/*
UPDATE campaign_summaries
SET summary_date = DATE_TRUNC('month', summary_date)::date
WHERE summary_type = 'monthly'
  AND EXTRACT(DAY FROM summary_date) != 1;
*/

-- Check for potential duplicates AFTER the fix
-- (e.g., if both 2024-09-30 and 2024-09-01 exist, they would merge)
WITH normalized_dates AS (
  SELECT 
    client_id,
    DATE_TRUNC('month', summary_date)::date as norm_date,
    summary_type,
    platform,
    COUNT(*) as count
  FROM campaign_summaries
  WHERE summary_type = 'monthly'
  GROUP BY 
    client_id,
    DATE_TRUNC('month', summary_date)::date,
    summary_type,
    platform
  HAVING COUNT(*) > 1
)
SELECT 
  c.name as client_name,
  nd.norm_date,
  nd.platform,
  nd.count as duplicate_count,
  '⚠️ Will create duplicate - needs manual merge' as warning
FROM normalized_dates nd
JOIN clients c ON c.id = nd.client_id;

ROLLBACK;  -- Safe rollback - remove this when ready to commit

-- ============================================================================
-- STEP 3: VERIFICATION (Run after fix)
-- ============================================================================

-- Verify all monthly dates are now on day 1
SELECT 
  'After Fix - All Correct' as status,
  COUNT(*) as count
FROM campaign_summaries
WHERE summary_type = 'monthly'
  AND EXTRACT(DAY FROM summary_date) = 1;

SELECT 
  'After Fix - Still Wrong' as status,
  COUNT(*) as count
FROM campaign_summaries
WHERE summary_type = 'monthly'
  AND EXTRACT(DAY FROM summary_date) != 1;

-- ============================================================================
-- BELMONTE SPECIFIC FIX (If you want to fix just Belmonte first)
-- ============================================================================

/*
BEGIN;

UPDATE campaign_summaries
SET summary_date = DATE_TRUNC('month', summary_date)::date
WHERE client_id = (
  SELECT id FROM clients WHERE email = 'belmonte@hotel.com' LIMIT 1
)
  AND summary_type = 'monthly'
  AND EXTRACT(DAY FROM summary_date) != 1;

-- Verify Belmonte fix
SELECT 
  summary_date,
  EXTRACT(DAY FROM summary_date) as day,
  TO_CHAR(summary_date, 'YYYY-MM-DD') as formatted
FROM campaign_summaries
WHERE client_id = (
  SELECT id FROM clients WHERE email = 'belmonte@hotel.com' LIMIT 1
)
  AND summary_type = 'monthly'
ORDER BY summary_date DESC;

COMMIT;  -- Uncomment to commit the changes
*/

