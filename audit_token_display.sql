-- 🔍 COMPREHENSIVE TOKEN DISPLAY AUDIT
-- This checks the entire flow: Database → API → Frontend
-- Date: November 13, 2025

SELECT '=' || REPEAT('=', 78) || '=' as divider;
SELECT '🎯 COMPREHENSIVE TOKEN DISPLAY AUDIT' as title;
SELECT '=' || REPEAT('=', 78) || '=' as divider;

-- ============================================================================
-- SECTION 1: DATABASE STATE
-- ============================================================================

SELECT '' as blank_line;
SELECT '📊 SECTION 1: DATABASE STATE' as section;
SELECT REPEAT('-', 80) as divider;

-- Check if settings table exists
SELECT 
  '✅ Settings table exists' as check_1,
  COUNT(*) as total_rows
FROM settings;

-- Check the Meta token entry
SELECT 
  '🔑 Meta System User Token in Settings Table' as check_2;

SELECT 
  key,
  CASE 
    WHEN value IS NULL THEN '❌ NULL VALUE'
    WHEN value = '' THEN '❌ EMPTY STRING'
    WHEN LENGTH(value) < 50 THEN '⚠️ TOO SHORT: ' || LENGTH(value) || ' chars'
    WHEN value LIKE 'EAA%' THEN '✅ VALID: ' || LENGTH(value) || ' chars - ' || LEFT(value, 40) || '...'
    ELSE '⚠️ UNEXPECTED FORMAT: ' || LENGTH(value) || ' chars'
  END as token_status,
  created_at,
  updated_at
FROM settings
WHERE key = 'meta_system_user_token';

-- Verify token is not empty
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM settings 
      WHERE key = 'meta_system_user_token' 
      AND value IS NOT NULL 
      AND value != ''
      AND LENGTH(value) > 100
    ) THEN '✅ PASS: Token exists and looks valid'
    ELSE '❌ FAIL: Token is missing, null, empty, or too short'
  END as database_verification;

-- ============================================================================
-- SECTION 2: COMPARE WITH CLIENTS TABLE
-- ============================================================================

SELECT '' as blank_line;
SELECT '🔄 SECTION 2: TOKEN CONSISTENCY CHECK' as section;
SELECT REPEAT('-', 80) as divider;

-- Show tokens from both locations side-by-side
WITH settings_token AS (
  SELECT value as token FROM settings WHERE key = 'meta_system_user_token'
),
clients_tokens AS (
  SELECT DISTINCT system_user_token as token 
  FROM clients 
  WHERE system_user_token IS NOT NULL 
  AND system_user_token != ''
)
SELECT 
  'Settings vs Clients' as comparison,
  CASE 
    WHEN (SELECT token FROM settings_token) = ANY(SELECT token FROM clients_tokens)
    THEN '✅ MATCH: Tokens are identical'
    ELSE '⚠️ DIFFERENT: Settings and clients have different tokens'
  END as result,
  (SELECT LEFT(token, 30) || '...' FROM settings_token) as settings_token_preview,
  (SELECT LEFT(token, 30) || '...' FROM clients_tokens LIMIT 1) as clients_token_preview;

-- ============================================================================
-- SECTION 3: RLS POLICY CHECK
-- ============================================================================

SELECT '' as blank_line;
SELECT '🔒 SECTION 3: ROW LEVEL SECURITY (RLS) CHECK' as section;
SELECT REPEAT('-', 80) as divider;

-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN rowsecurity = true THEN '✅ RLS ENABLED'
    ELSE '⚠️ RLS DISABLED'
  END as rls_status
FROM pg_tables
WHERE tablename = 'settings'
AND schemaname = 'public';

-- List RLS policies on settings table
SELECT 
  '📋 RLS Policies on settings table:' as info;

SELECT 
  policyname as policy_name,
  CASE cmd
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
    ELSE cmd
  END as applies_to,
  CASE qual
    WHEN NULL THEN 'No condition'
    ELSE 'Has condition (check policy definition)'
  END as condition_type
FROM pg_policies
WHERE tablename = 'settings'
AND schemaname = 'public';

-- Test if settings can be read (this simulates what the API does)
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ PASS: Can read settings table'
    ELSE '❌ FAIL: Cannot read settings table'
  END as read_access_test
FROM settings
WHERE key = 'meta_system_user_token';

-- ============================================================================
-- SECTION 4: API RESPONSE SIMULATION
-- ============================================================================

SELECT '' as blank_line;
SELECT '🌐 SECTION 4: SIMULATED API RESPONSE' as section;
SELECT REPEAT('-', 80) as divider;

-- Simulate what the API should return
SELECT 
  '📤 What /api/admin/meta-settings should return:' as info;

SELECT 
  jsonb_build_object(
    'meta_system_user_token', value,
    'lastUpdate', updated_at,
    'token_length', LENGTH(value),
    'token_preview', LEFT(value, 30) || '...',
    'has_token', CASE WHEN value IS NOT NULL AND value != '' THEN true ELSE false END
  ) as api_response
FROM settings
WHERE key = 'meta_system_user_token';

-- ============================================================================
-- SECTION 5: FRONTEND DISPLAY EXPECTATION
-- ============================================================================

SELECT '' as blank_line;
SELECT '🎨 SECTION 5: FRONTEND DISPLAY EXPECTATION' as section;
SELECT REPEAT('-', 80) as divider;

SELECT 
  CASE 
    WHEN value IS NULL OR value = '' THEN '❌ Modal should show: "Nie ustawiono"'
    WHEN LENGTH(value) > 50 THEN '✅ Modal should show: Token preview with eye icon'
    ELSE '⚠️ Modal should show: Token but might appear invalid'
  END as expected_modal_display,
  CASE 
    WHEN value IS NULL OR value = '' THEN '❌ No'
    ELSE '✅ Yes - ' || LENGTH(value) || ' characters'
  END as token_exists,
  CASE 
    WHEN value LIKE 'EAA%' THEN '✅ Correct'
    ELSE '⚠️ Unexpected'
  END as token_format
FROM settings
WHERE key = 'meta_system_user_token';

-- ============================================================================
-- SECTION 6: TROUBLESHOOTING CHECKLIST
-- ============================================================================

SELECT '' as blank_line;
SELECT '✅ SECTION 6: DIAGNOSTIC CHECKLIST' as section;
SELECT REPEAT('-', 80) as divider;

SELECT 
  '1. Database Token' as check_item,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM settings 
      WHERE key = 'meta_system_user_token' 
      AND value IS NOT NULL 
      AND value != ''
      AND LENGTH(value) > 100
    ) THEN '✅ PASS'
    ELSE '❌ FAIL - Token missing or invalid'
  END as status

UNION ALL

SELECT 
  '2. RLS Enabled' as check_item,
  CASE 
    WHEN (SELECT rowsecurity FROM pg_tables WHERE tablename = 'settings' AND schemaname = 'public')
    THEN '✅ PASS'
    ELSE '⚠️ WARNING - RLS not enabled'
  END as status

UNION ALL

SELECT 
  '3. RLS Policies Exist' as check_item,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'settings')
    THEN '✅ PASS - ' || (SELECT COUNT(*)::text FROM pg_policies WHERE tablename = 'settings') || ' policies'
    ELSE '❌ FAIL - No policies found'
  END as status

UNION ALL

SELECT 
  '4. Token Format Valid' as check_item,
  CASE 
    WHEN (SELECT value FROM settings WHERE key = 'meta_system_user_token') LIKE 'EAA%'
    THEN '✅ PASS - Starts with EAA'
    ELSE '⚠️ WARNING - Unexpected format'
  END as status

UNION ALL

SELECT 
  '5. Token Length Adequate' as check_item,
  CASE 
    WHEN (SELECT LENGTH(value) FROM settings WHERE key = 'meta_system_user_token') > 150
    THEN '✅ PASS - ' || (SELECT LENGTH(value)::text FROM settings WHERE key = 'meta_system_user_token') || ' chars'
    ELSE '⚠️ WARNING - Token seems short'
  END as status;

-- ============================================================================
-- SECTION 7: FINAL VERDICT
-- ============================================================================

SELECT '' as blank_line;
SELECT '🎯 SECTION 7: FINAL VERDICT' as section;
SELECT '=' || REPEAT('=', 78) || '=' as divider;

SELECT 
  CASE 
    WHEN value IS NULL OR value = '' THEN 
      '❌ FAIL: Token is not in database. Run fix_empty_token.sql'
    WHEN LENGTH(value) < 50 THEN 
      '⚠️ WARNING: Token exists but seems too short (' || LENGTH(value) || ' chars)'
    WHEN NOT (value LIKE 'EAA%') THEN 
      '⚠️ WARNING: Token exists but format is unexpected'
    ELSE 
      '✅ SUCCESS: Token is properly stored in database (' || LENGTH(value) || ' chars)' || E'\n' ||
      '👉 If modal still shows "Nie ustawiono", check:' || E'\n' ||
      '   1. Browser console for API errors (F12 → Console)' || E'\n' ||
      '   2. Network tab for /api/admin/meta-settings response' || E'\n' ||
      '   3. Restart dev server (npm run dev)' || E'\n' ||
      '   4. Hard refresh browser (Cmd+Shift+R)'
  END as final_verdict
FROM settings
WHERE key = 'meta_system_user_token';

SELECT '=' || REPEAT('=', 78) || '=' as divider;
SELECT '✅ Audit Complete!' as status;
SELECT '=' || REPEAT('=', 78) || '=' as divider;

