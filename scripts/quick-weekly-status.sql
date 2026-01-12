-- ============================================================================
-- QUICK GOOGLE ADS WEEKLY STATUS CHECK
-- ============================================================================
-- Quick one-liner to check weekly collection status
-- ============================================================================

-- Summary by client
SELECT 
  c.name as client,
  COUNT(DISTINCT cs.summary_date) as weeks_collected,
  MIN(cs.summary_date) as oldest_week,
  MAX(cs.summary_date) as newest_week,
  SUM(cs.total_spend) as total_spend,
  SUM(cs.booking_step_1) as total_step1,
  CASE 
    WHEN COUNT(DISTINCT cs.summary_date) >= 50 THEN '✅'
    WHEN COUNT(DISTINCT cs.summary_date) > 0 THEN '🟡'
    ELSE '❌'
  END as status
FROM clients c
LEFT JOIN campaign_summaries cs ON cs.client_id = c.id 
  AND cs.platform = 'google' 
  AND cs.summary_type = 'weekly'
WHERE c.google_ads_customer_id IS NOT NULL
GROUP BY c.id, c.name
ORDER BY weeks_collected DESC;

