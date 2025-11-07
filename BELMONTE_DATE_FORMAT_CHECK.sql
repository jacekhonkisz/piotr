-- ============================================================================
-- BELMONTE: Check DATE FORMAT in campaign_summaries
-- ============================================================================
-- This will show us if dates are stored inconsistently
-- ============================================================================

WITH belmonte_client AS (
  SELECT id FROM clients 
  WHERE email = 'belmonte@hotel.com' 
  LIMIT 1
)

-- Show ALL monthly records with their exact dates
SELECT 
  summary_date,
  EXTRACT(DAY FROM summary_date) as day_of_month,
  TO_CHAR(summary_date, 'YYYY-MM-DD') as date_formatted,
  TO_CHAR(summary_date, 'Mon YYYY') as month_year,
  total_spend,
  total_impressions,
  total_clicks,
  CASE 
    WHEN EXTRACT(DAY FROM summary_date) = 1 THEN '✅ CORRECT (1st of month)'
    WHEN EXTRACT(DAY FROM summary_date) >= 28 THEN '❌ WRONG (last day of month)'
    ELSE '⚠️ MIDDLE OF MONTH'
  END as date_status
FROM campaign_summaries
WHERE client_id = (SELECT id FROM belmonte_client)
  AND platform = 'meta'
  AND summary_type = 'monthly'
ORDER BY summary_date ASC;

-- ============================================================================
-- Count by day pattern
-- ============================================================================

SELECT 
  EXTRACT(DAY FROM summary_date) as day_of_month,
  COUNT(*) as count,
  CASE 
    WHEN EXTRACT(DAY FROM summary_date) = 1 THEN '✅ Correct Format'
    WHEN EXTRACT(DAY FROM summary_date) >= 28 THEN '❌ Wrong Format (end of month)'
    ELSE '⚠️ Middle of Month'
  END as status
FROM campaign_summaries
WHERE client_id = (
  SELECT id FROM clients 
  WHERE email = 'belmonte@hotel.com' 
  LIMIT 1
)
  AND platform = 'meta'
  AND summary_type = 'monthly'
GROUP BY EXTRACT(DAY FROM summary_date)
ORDER BY EXTRACT(DAY FROM summary_date);

