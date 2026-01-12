-- Check if reservation_value is being updated with form conversion values for December 2024

SELECT 
  c.name as client_name,
  cs.summary_date,
  cs.platform,
  cs.total_spend,
  cs.reservation_value as "reservation_value (should include form conversions)",
  cs.reservations,
  cs.roas,
  cs.last_updated
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.platform = 'google'
  AND cs.summary_date = '2024-12-01'
  AND cs.summary_type = 'monthly'
ORDER BY cs.last_updated DESC
LIMIT 5;
