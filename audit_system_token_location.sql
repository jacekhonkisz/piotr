-- 🔍 AUDIT: Where is the System User Token Actually Stored?
-- Date: November 13, 2025
-- Issue: Modal shows "Nie ustawiono" but we're using system token for API reports

-- ============================================================================
-- 🎯 THE PROBLEM
-- ============================================================================
/*
Your system has TWO places where Meta tokens can be stored:

1. 📊 GLOBAL TOKEN (settings table)
   - Key: 'meta_system_user_token'
   - Purpose: ONE shared token for ALL clients
   - This is what the PlatformTokensModal displays
   
2. 👤 PER-CLIENT TOKENS (clients table)  
   - Field: system_user_token
   - Purpose: Individual token per client
   - This is what the API reports actually use

The modal is checking location #1 (global)
But your API reports use location #2 (per-client)

That's why it shows "Nie ustawiono" even though reports are working!
*/

-- ============================================================================
-- STEP 1: Check GLOBAL token in settings table
-- ============================================================================

SELECT 
  '🌍 GLOBAL SYSTEM TOKEN (settings table)' as section;

SELECT 
  key,
  LEFT(value, 20) || '...' as token_preview,
  LENGTH(value) as token_length,
  created_at,
  updated_at,
  CASE 
    WHEN value IS NOT NULL AND LENGTH(value) > 50 THEN '✅ SET'
    ELSE '❌ NOT SET'
  END as status
FROM settings
WHERE key = 'meta_system_user_token';

-- If no rows, the global token doesn't exist yet
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM settings WHERE key = 'meta_system_user_token') 
    THEN '✅ Global token entry exists'
    ELSE '❌ No global token entry - this is why modal shows "Nie ustawiono"'
  END as global_token_check;

-- ============================================================================
-- STEP 2: Check PER-CLIENT tokens in clients table
-- ============================================================================

SELECT 
  '👤 PER-CLIENT SYSTEM TOKENS (clients table)' as section;

-- Count clients with system tokens
SELECT 
  COUNT(*) as total_clients_with_ad_accounts,
  COUNT(system_user_token) as clients_with_system_token,
  COUNT(meta_access_token) as clients_with_access_token,
  COUNT(CASE WHEN system_user_token IS NOT NULL OR meta_access_token IS NOT NULL THEN 1 END) as clients_with_any_token
FROM clients
WHERE ad_account_id IS NOT NULL;

-- Show actual tokens being used (first 3 clients)
SELECT 
  name,
  ad_account_id,
  LEFT(system_user_token, 20) || '...' as system_token_preview,
  LENGTH(system_user_token) as system_token_length,
  LEFT(meta_access_token, 20) || '...' as access_token_preview,
  CASE 
    WHEN system_user_token IS NOT NULL THEN '✅ Using SYSTEM token'
    WHEN meta_access_token IS NOT NULL THEN '⏰ Using ACCESS token'
    ELSE '❌ NO TOKEN'
  END as token_type
FROM clients
WHERE ad_account_id IS NOT NULL
ORDER BY name
LIMIT 5;

-- ============================================================================
-- STEP 3: Check if all clients share the SAME token
-- ============================================================================

SELECT 
  '🔍 TOKEN SHARING ANALYSIS' as section;

-- Check if system tokens are identical (shared)
WITH token_analysis AS (
  SELECT 
    system_user_token,
    COUNT(*) as client_count,
    STRING_AGG(name, ', ') as clients_using_this_token
  FROM clients
  WHERE system_user_token IS NOT NULL
  GROUP BY system_user_token
)
SELECT 
  LEFT(system_user_token, 20) || '...' as token_preview,
  client_count,
  clients_using_this_token,
  CASE 
    WHEN client_count > 1 THEN '✅ SHARED token (used by multiple clients)'
    ELSE '👤 UNIQUE token (single client)'
  END as sharing_status
FROM token_analysis
ORDER BY client_count DESC;

-- ============================================================================
-- STEP 4: Show the actual token value that's being used
-- ============================================================================

SELECT 
  '🔑 ACTUAL TOKEN VALUE (for API reports)' as section;

-- This is the token your API reports are actually using
SELECT 
  name,
  ad_account_id,
  system_user_token as actual_token_being_used,
  LENGTH(system_user_token) as token_length,
  '⚠️ This is stored in clients.system_user_token, not settings.meta_system_user_token' as note
FROM clients
WHERE system_user_token IS NOT NULL
LIMIT 1;

-- ============================================================================
-- 🎯 DIAGNOSIS SUMMARY
-- ============================================================================

SELECT 
  '📋 SUMMARY & RECOMMENDATION' as section;

SELECT 
  '1. Modal checks settings.meta_system_user_token (global)' as check_1,
  '2. API reports use clients.system_user_token (per-client)' as check_2,
  '3. These are two DIFFERENT storage locations!' as check_3,
  '4. Recommendation: Copy token from clients table to settings table' as recommendation;

-- ============================================================================
-- 🔧 SOLUTION OPTIONS
-- ============================================================================

/*
OPTION A: Copy existing token to global settings (recommended if all clients share same token)

UPDATE settings 
SET value = (
  SELECT system_user_token 
  FROM clients 
  WHERE system_user_token IS NOT NULL 
  LIMIT 1
),
updated_at = NOW()
WHERE key = 'meta_system_user_token';

-- If the settings row doesn't exist yet:
INSERT INTO settings (key, value, created_at, updated_at)
SELECT 
  'meta_system_user_token',
  system_user_token,
  NOW(),
  NOW()
FROM clients
WHERE system_user_token IS NOT NULL
LIMIT 1
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();


OPTION B: Update the modal to read from clients table instead of settings table
- This would require code changes to PlatformTokensModal.tsx and meta-settings API


OPTION C: Update your API report code to check settings table first, then fall back to clients
- This would centralize token management
*/







