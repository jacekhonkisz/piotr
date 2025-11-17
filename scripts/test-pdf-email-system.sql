-- Test Suite: PDF Email System Verification
-- Date: November 17, 2025
-- Tester: Senior QA Engineer

-- ============================================
-- TEST 1: Verify Client Configuration
-- ============================================
\echo '==== TEST 1: CLIENT CONFIGURATION ===='
\echo 'Checking clients with monthly reporting and send_day = 5...'

SELECT 
  'TEST_1_CLIENT_CONFIG' as test_name,
  COUNT(*) as total_clients,
  COUNT(CASE WHEN contact_emails IS NOT NULL AND contact_emails != '[]' THEN 1 END) as clients_with_emails,
  COUNT(CASE WHEN google_ads_enabled = true THEN 1 END) as google_ads_enabled,
  COUNT(CASE WHEN meta_access_token IS NOT NULL THEN 1 END) as meta_enabled
FROM clients
WHERE reporting_frequency = 'monthly'
  AND send_day = 5
  AND api_status = 'valid';

-- ============================================
-- TEST 2: Verify System Settings
-- ============================================
\echo ''
\echo '==== TEST 2: SYSTEM SETTINGS ===='
\echo 'Checking email scheduler configuration...'

SELECT 
  'TEST_2_SYSTEM_SETTINGS' as test_name,
  key,
  value,
  CASE 
    WHEN key = 'email_scheduler_enabled' AND value = 'true' THEN '✅ PASS'
    WHEN key = 'email_scheduler_enabled' AND value != 'true' THEN '❌ FAIL - Scheduler disabled'
    ELSE '⚠️  WARNING - Check value'
  END as status
FROM system_settings
WHERE key IN ('email_scheduler_enabled', 'email_scheduler_time', 'global_default_send_day');

-- ============================================
-- TEST 3: Check Recent PDF Generation
-- ============================================
\echo ''
\echo '==== TEST 3: RECENT PDF GENERATION ===='
\echo 'Checking generated reports with PDFs...'

SELECT 
  'TEST_3_PDF_GENERATION' as test_name,
  COUNT(*) as total_reports,
  COUNT(CASE WHEN pdf_url IS NOT NULL THEN 1 END) as reports_with_pdf,
  COUNT(CASE WHEN pdf_url IS NULL THEN 1 END) as reports_without_pdf,
  ROUND(AVG(pdf_size_bytes) / 1024.0, 2) as avg_pdf_size_kb,
  MAX(pdf_generated_at) as last_pdf_generated
FROM generated_reports
WHERE created_at > NOW() - INTERVAL '30 days';

-- ============================================
-- TEST 4: Check Email Send History
-- ============================================
\echo ''
\echo '==== TEST 4: EMAIL SEND HISTORY ===='
\echo 'Checking recent email sends...'

SELECT 
  'TEST_4_EMAIL_HISTORY' as test_name,
  COUNT(*) as total_attempts,
  COUNT(CASE WHEN email_sent = true THEN 1 END) as successful_sends,
  COUNT(CASE WHEN email_sent = false THEN 1 END) as failed_sends,
  COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as with_errors,
  MAX(email_sent_at) as last_successful_send
FROM email_scheduler_logs
WHERE created_at > NOW() - INTERVAL '30 days';

-- ============================================
-- TEST 5: Verify Data Source (daily_kpi_data)
-- ============================================
\echo ''
\echo '==== TEST 5: DATA SOURCE VERIFICATION ===='
\echo 'Checking daily_kpi_data table...'

SELECT 
  'TEST_5_DATA_SOURCE' as test_name,
  platform,
  COUNT(*) as record_count,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  ROUND(AVG(total_spend), 2) as avg_spend,
  SUM(reservations) as total_reservations
FROM daily_kpi_data
WHERE date >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
  AND date < DATE_TRUNC('month', NOW())
GROUP BY platform
ORDER BY platform;

-- ============================================
-- TEST 6: Check Cron Jobs Configuration
-- ============================================
\echo ''
\echo '==== TEST 6: CRON JOBS VERIFICATION ===='
\echo 'Verifying scheduled_reports table exists...'

SELECT 
  'TEST_6_SCHEDULED_REPORTS' as test_name,
  COUNT(*) as total_scheduled,
  COUNT(CASE WHEN report_type = 'monthly' THEN 1 END) as monthly_reports,
  COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as active_schedules
FROM scheduled_reports
WHERE scheduled_date >= NOW();

-- ============================================
-- SUMMARY REPORT
-- ============================================
\echo ''
\echo '==== SUMMARY REPORT ===='
\echo 'Test execution complete. Review results above.'
