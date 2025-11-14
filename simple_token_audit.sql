-- 🔍 SIMPLE TOKEN AUDIT - Single Result View
-- Run this in Supabase SQL Editor

SELECT 
  '🔍 META TOKEN AUDIT RESULTS' as audit_title,
  
  -- Check 1: Does token exist in database?
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM settings 
      WHERE key = 'meta_system_user_token' 
      AND value IS NOT NULL 
      AND value != ''
      AND LENGTH(value) > 100
    ) THEN '✅ YES'
    ELSE '❌ NO'
  END as "1_token_exists_in_db",
  
  -- Check 2: Token length
  (SELECT LENGTH(value) FROM settings WHERE key = 'meta_system_user_token') as "2_token_length",
  
  -- Check 3: Token preview
  (SELECT LEFT(value, 40) || '...' FROM settings WHERE key = 'meta_system_user_token') as "3_token_preview",
  
  -- Check 4: Token format
  CASE 
    WHEN (SELECT value FROM settings WHERE key = 'meta_system_user_token') LIKE 'EAA%' 
    THEN '✅ Correct (starts with EAA)'
    ELSE '⚠️ Unexpected format'
  END as "4_token_format",
  
  -- Check 5: RLS enabled
  CASE 
    WHEN (SELECT rowsecurity FROM pg_tables WHERE tablename = 'settings' AND schemaname = 'public')
    THEN '✅ Enabled'
    ELSE '⚠️ Disabled'
  END as "5_rls_enabled",
  
  -- Check 6: Can we read it?
  CASE 
    WHEN (SELECT COUNT(*) FROM settings WHERE key = 'meta_system_user_token') > 0
    THEN '✅ YES'
    ELSE '❌ NO - RLS may be blocking'
  END as "6_can_read_token",
  
  -- Final Verdict
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM settings 
      WHERE key = 'meta_system_user_token' 
      AND value IS NOT NULL 
      AND value != ''
      AND LENGTH(value) > 100
      AND value LIKE 'EAA%'
    ) THEN '✅ DATABASE IS GOOD - Check frontend/API'
    ELSE '❌ DATABASE ISSUE - Token missing or invalid'
  END as "7_FINAL_VERDICT";


