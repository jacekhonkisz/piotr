-- Check Havet's reservation_value in database
SELECT 
  c.name as client_name,
  cs.summary_date,
  cs.summary_type,
  cs.platform,
  cs.reservation_value as "łączna wartość rezerwacji",
  cs.total_spend,
  cs.reservations,
  cs.last_updated
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE c.name = 'Havet'
  AND cs.platform = 'google'
  AND cs.summary_date IN ('2025-11-01', '2025-12-01')
ORDER BY cs.summary_date DESC, cs.summary_type;

