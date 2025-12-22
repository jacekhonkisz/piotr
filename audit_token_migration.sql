-- 🔍 Audit Token Migration - Check What Actually Happened
-- 
-- This script checks the current state after migration
-- and helps diagnose why all clients are failing

-- ============================================================================
-- STEP 1: Check Current Token State
-- ============================================================================

-- See what tokens all clients have now
SELECT 
  name,
  ad_account_id,
  CASE 
    WHEN system_user_token IS NOT NULL THEN 
      'System Token: ' || LEFT(system_user_token, 40) || '...'
    WHEN meta_access_token IS NOT NULL THEN 
      'Access Token: ' || LEFT(meta_access_token, 40) || '...'
    ELSE '❌ NO TOKEN'
  END as token_info,
  LENGTH(system_user_token) as system_token_length,
  LENGTH(meta_access_token) as access_token_length,
  token_health_status,
  api_status,
  last_token_validation
FROM clients
WHERE ad_account_id IS NOT NULL
ORDER BY name;

-- ============================================================================
-- STEP 2: Check Token Uniqueness
-- ============================================================================

-- How many unique tokens are there?
SELECT 
  'System User Tokens' as token_type,
  COUNT(DISTINCT system_user_token) as unique_count,
  COUNT(*) as total_clients
FROM clients
WHERE system_user_token IS NOT NULL

UNION ALL

SELECT 
  'Access Tokens' as token_type,
  COUNT(DISTINCT meta_access_token) as unique_count,
  COUNT(*) as total_clients
FROM clients
WHERE meta_access_token IS NOT NULL;

-- ============================================================================
-- STEP 3: Check Belmonte Specifically
-- ============================================================================

-- What does Belmonte actually have?
SELECT 
  '🔍 BELMONTE TOKEN DETAILS' as section,
  name,
  ad_account_id,
  CASE 
    WHEN system_user_token IS NOT NULL THEN '✅ HAS system_user_token'
    ELSE '❌ NO system_user_token'
  END as has_system_token,
  CASE 
    WHEN meta_access_token IS NOT NULL THEN '✅ HAS meta_access_token'
    ELSE '❌ NO meta_access_token'
  END as has_access_token,
  LENGTH(system_user_token) as system_len,
  LENGTH(meta_access_token) as access_len,
  LEFT(COALESCE(system_user_token, meta_access_token, 'NO TOKEN'), 50) || '...' as token_preview
FROM clients
WHERE name ILIKE '%belmonte%';

-- ============================================================================
-- STEP 4: Check If All Clients Have Same Token
-- ============================================================================

-- Group clients by their system_user_token
SELECT 
  LEFT(system_user_token, 40) || '...' as token_preview,
  COUNT(*) as client_count,
  STRING_AGG(name, ', ' ORDER BY name) as clients,
  CASE 
    WHEN COUNT(*) = (SELECT COUNT(*) FROM clients WHERE ad_account_id IS NOT NULL)
    THEN '✅ All clients using this token'
    ELSE '⚠️ Only some clients'
  END as coverage
FROM clients
WHERE system_user_token IS NOT NULL
GROUP BY system_user_token
ORDER BY client_count DESC;

-- ============================================================================
-- STEP 5: Check for Empty or Invalid Tokens
-- ============================================================================

-- Are there any empty or suspiciously short tokens?
SELECT 
  name,
  ad_account_id,
  CASE 
    WHEN system_user_token IS NULL THEN '❌ NULL'
    WHEN LENGTH(system_user_token) < 50 THEN '⚠️ Too short (' || LENGTH(system_user_token) || ' chars)'
    WHEN LENGTH(system_user_token) > 300 THEN '⚠️ Too long (' || LENGTH(system_user_token) || ' chars)'
    ELSE '✅ Normal length (' || LENGTH(system_user_token) || ' chars)'
  END as token_status,
  LEFT(system_user_token, 20) || '...' as token_start
FROM clients
WHERE ad_account_id IS NOT NULL
ORDER BY LENGTH(system_user_token) NULLS FIRST;

-- ============================================================================
-- STEP 6: Compare With Backup
-- ============================================================================

-- What changed from the backup?
SELECT 
  c.name,
  CASE 
    WHEN c.system_user_token = b.system_user_token THEN '✅ Same'
    WHEN c.system_user_token IS NOT NULL AND b.system_user_token IS NULL THEN '🔄 Added system token'
    WHEN c.system_user_token IS NULL AND b.system_user_token IS NOT NULL THEN '⚠️ Lost system token'
    ELSE '🔄 Changed'
  END as token_change,
  CASE 
    WHEN c.meta_access_token IS NULL AND b.meta_access_token IS NOT NULL THEN '🧹 Cleared access token'
    WHEN c.meta_access_token IS NOT NULL AND b.meta_access_token IS NULL THEN '⚠️ Added access token'
    ELSE '—'
  END as access_token_change
FROM clients c
LEFT JOIN clients_backup_before_token_copy b ON c.id = b.id
WHERE c.ad_account_id IS NOT NULL
ORDER BY c.name;

-- ============================================================================
-- STEP 7: Get Actual Token Values for Testing
-- ============================================================================

-- Extract actual tokens (masked for security)
SELECT 
  '🔑 TOKENS FOR MANUAL TESTING' as section,
  name,
  ad_account_id,
  'system_user_token: ' || LEFT(system_user_token, 100) || '...' as token_info
FROM clients
WHERE system_user_token IS NOT NULL
LIMIT 3;

-- ============================================================================
-- DIAGNOSTIC SUMMARY
-- ============================================================================

SELECT 
  '📊 DIAGNOSTIC SUMMARY' as report,
  (SELECT COUNT(*) FROM clients WHERE ad_account_id IS NOT NULL) as total_meta_clients,
  (SELECT COUNT(*) FROM clients WHERE system_user_token IS NOT NULL) as clients_with_system_token,
  (SELECT COUNT(*) FROM clients WHERE meta_access_token IS NOT NULL) as clients_with_access_token,
  (SELECT COUNT(*) FROM clients WHERE system_user_token IS NULL AND meta_access_token IS NULL AND ad_account_id IS NOT NULL) as clients_with_no_token,
  (SELECT COUNT(DISTINCT system_user_token) FROM clients WHERE system_user_token IS NOT NULL) as unique_system_tokens;







