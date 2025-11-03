-- ============================================================================
-- FIX AUGUST 2025 - ADD MISSING CONVERSION DATA
-- ============================================================================
-- Purpose: Update campaign_summaries for August 2025 with conversion data
--          from daily_kpi_data
-- Safety: Updates existing records, adds missing conversion metrics
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE '🔧 FIXING AUGUST 2025 CONVERSION DATA';
  RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- 1. BACKUP CURRENT STATE (for rollback if needed)
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '📦 Creating backup of current August data...';
END $$;

-- Create a backup in a temp table (optional, comment out if not needed)
CREATE TEMP TABLE IF NOT EXISTS august_backup AS
SELECT * FROM campaign_summaries 
WHERE summary_date = '2025-08-01' AND summary_type = 'monthly';

-- ============================================================================
-- 2. UPDATE AUGUST campaign_summaries WITH CONVERSION DATA
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔄 Updating August conversion data from daily_kpi_data...';
END $$;

UPDATE campaign_summaries cs
SET 
  click_to_call = COALESCE((
    SELECT SUM(click_to_call) 
    FROM daily_kpi_data 
    WHERE client_id = cs.client_id 
      AND date >= '2025-08-01' 
      AND date <= '2025-08-31'
      AND platform = cs.platform
  ), 0),
  
  email_contacts = COALESCE((
    SELECT SUM(email_contacts) 
    FROM daily_kpi_data 
    WHERE client_id = cs.client_id 
      AND date >= '2025-08-01' 
      AND date <= '2025-08-31'
      AND platform = cs.platform
  ), 0),
  
  booking_step_1 = COALESCE((
    SELECT SUM(booking_step_1) 
    FROM daily_kpi_data 
    WHERE client_id = cs.client_id 
      AND date >= '2025-08-01' 
      AND date <= '2025-08-31'
      AND platform = cs.platform
  ), 0),
  
  booking_step_2 = COALESCE((
    SELECT SUM(booking_step_2) 
    FROM daily_kpi_data 
    WHERE client_id = cs.client_id 
      AND date >= '2025-08-01' 
      AND date <= '2025-08-31'
      AND platform = cs.platform
  ), 0),
  
  reservations = COALESCE((
    SELECT SUM(reservations) 
    FROM daily_kpi_data 
    WHERE client_id = cs.client_id 
      AND date >= '2025-08-01' 
      AND date <= '2025-08-31'
      AND platform = cs.platform
  ), 0),
  
  reservation_value = COALESCE((
    SELECT SUM(reservation_value) 
    FROM daily_kpi_data 
    WHERE client_id = cs.client_id 
      AND date >= '2025-08-01' 
      AND date <= '2025-08-31'
      AND platform = cs.platform
  ), 0),
  
  last_updated = NOW()

WHERE cs.summary_date = '2025-08-01' 
  AND cs.summary_type = 'monthly';

-- ============================================================================
-- 3. VERIFY THE FIX
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Verification:';
END $$;

SELECT 
  '📊 AUGUST AFTER FIX' as "Status",
  COUNT(*) as "Total Records",
  SUM(total_spend) as "Total Spend",
  SUM(total_impressions) as "Total Impressions",
  SUM(click_to_call) as "Click to Call",
  SUM(email_contacts) as "Email Contacts",
  SUM(reservations) as "Reservations",
  SUM(reservation_value) as "Reservation Value"
FROM campaign_summaries
WHERE summary_date = '2025-08-01'
  AND summary_type = 'monthly';

-- Show per-client update results
SELECT 
  c.name as "Client",
  cs.total_spend as "Spend",
  cs.click_to_call as "Click to Call",
  cs.email_contacts as "Emails",
  cs.reservations as "Reservations",
  'Updated' as "Status"
FROM campaign_summaries cs
JOIN clients c ON c.id = cs.client_id
WHERE cs.summary_date = '2025-08-01'
  AND cs.summary_type = 'monthly'
ORDER BY cs.total_spend DESC;

-- ============================================================================
-- 4. FINAL SUMMARY
-- ============================================================================
DO $$
DECLARE
  records_updated INTEGER;
  total_conversions INTEGER;
BEGIN
  SELECT COUNT(*) INTO records_updated
  FROM campaign_summaries
  WHERE summary_date = '2025-08-01' 
    AND summary_type = 'monthly'
    AND last_updated >= NOW() - INTERVAL '1 minute';
  
  SELECT SUM(click_to_call + email_contacts + reservations) INTO total_conversions
  FROM campaign_summaries
  WHERE summary_date = '2025-08-01' AND summary_type = 'monthly';
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ AUGUST FIX COMPLETE';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Records updated: %', records_updated;
  RAISE NOTICE 'Total conversions added: %', total_conversions;
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Test August report in UI';
  RAISE NOTICE 'Next: Run FIX_SEPTEMBER_CAMPAIGNS.sql';
  RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================
-- If you need to rollback, run:
/*
UPDATE campaign_summaries cs
SET 
  click_to_call = ab.click_to_call,
  email_contacts = ab.email_contacts,
  booking_step_1 = ab.booking_step_1,
  booking_step_2 = ab.booking_step_2,
  reservations = ab.reservations,
  reservation_value = ab.reservation_value,
  last_updated = ab.last_updated
FROM august_backup ab
WHERE cs.client_id = ab.client_id
  AND cs.summary_date = ab.summary_date
  AND cs.summary_type = ab.summary_type;
*/
-- ============================================================================





