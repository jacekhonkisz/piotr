-- Check if daily_kpi_data has conversion data for historical months
SELECT 
  DATE_TRUNC('month', date)::date as month,
  COUNT(*) as daily_records,
  SUM(COALESCE(click_to_call, 0)) as total_click_to_call,
  SUM(COALESCE(email_contacts, 0)) as total_email_contacts,
  SUM(COALESCE(booking_step_1, 0)) as total_booking_step_1,
  SUM(COALESCE(booking_step_2, 0)) as total_booking_step_2,
  SUM(COALESCE(reservations, 0)) as total_reservations,
  SUM(COALESCE(reservation_value, 0)) as total_reservation_value,
  SUM(COALESCE(spend, 0)) as total_spend
FROM daily_kpi_data
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND date >= '2025-07-01'
  AND date < '2025-10-01'
GROUP BY DATE_TRUNC('month', date)::date
ORDER BY month DESC;

-- Check a few sample records
SELECT 
  date,
  click_to_call,
  email_contacts,
  booking_step_1,
  reservations,
  reservation_value,
  spend
FROM daily_kpi_data
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
  AND date >= '2025-09-01'
  AND date <= '2025-09-05'
ORDER BY date
LIMIT 5;







