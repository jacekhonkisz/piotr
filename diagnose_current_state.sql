-- 🔍 DIAGNOSE CURRENT STATE
-- Run this to see what's actually in the database right now

-- ============================================================================
-- STEP 1: What tokens do clients currently have?
-- ============================================================================

SELECT 
  '📊 CURRENT CLIENT TOKEN STATE' as section;

SELECT 
  name,
  ad_account_id,
  CASE 
    WHEN system_user_token IS NOT NULL THEN 
      '✅ System Token: ' || LEFT(system_user_token, 50) || '...'
    WHEN meta_access_token IS NOT NULL THEN 
      '⏰ Access Token: ' || LEFT(meta_access_token, 50) || '...'
    ELSE '❌ NO TOKEN'
  END as token_info,
  CASE 
    WHEN system_user_token IS NOT NULL THEN LENGTH(system_user_token)
    WHEN meta_access_token IS NOT NULL THEN LENGTH(meta_access_token)
    ELSE 0
  END as token_length
FROM clients
WHERE ad_account_id IS NOT NULL
ORDER BY name;

-- ============================================================================
-- STEP 2: How many unique tokens?
-- ============================================================================

SELECT 
  '🔑 TOKEN UNIQUENESS' as section;

SELECT 
  COUNT(DISTINCT system_user_token) as unique_system_tokens,
  COUNT(DISTINCT meta_access_token) as unique_access_tokens,
  COUNT(*) as total_clients
FROM clients
WHERE ad_account_id IS NOT NULL;

-- ============================================================================
-- STEP 3: Check Belmonte specifically
-- ============================================================================

SELECT 
  '🏨 BELMONTE HOTEL DETAILS' as section;

SELECT 
  name,
  ad_account_id,
  system_user_token IS NOT NULL as has_system,
  meta_access_token IS NOT NULL as has_access,
  CASE 
    WHEN system_user_token IS NOT NULL THEN LENGTH(system_user_token)
    ELSE 0
  END as system_token_length,
  CASE 
    WHEN meta_access_token IS NOT NULL THEN LENGTH(meta_access_token)
    ELSE 0
  END as access_token_length,
  -- Show first 100 chars of whichever token exists
  LEFT(COALESCE(system_user_token, meta_access_token, 'NO_TOKEN'), 100) as token_preview
FROM clients
WHERE name ILIKE '%belmonte%';

-- ============================================================================
-- STEP 4: Did migration actually run?
-- ============================================================================

SELECT 
  '📋 MIGRATION CHECK' as section;

-- Check if backup table exists
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients_backup_before_token_copy')
    THEN '✅ Backup exists - migration was attempted'
    ELSE '❌ No backup - migration might not have run'
  END as backup_status;

-- ============================================================================
-- STEP 5: Compare with backup
-- ============================================================================

SELECT 
  '🔄 BEFORE vs AFTER COMPARISON' as section;

-- Only run if backup exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients_backup_before_token_copy') THEN
    RAISE NOTICE 'Backup exists - showing comparison';
  ELSE
    RAISE NOTICE 'No backup found - migration might not have run';
  END IF;
END $$;

-- Show what changed (only if backup exists)
SELECT 
  c.name,
  CASE 
    WHEN b.system_user_token IS NULL AND c.system_user_token IS NOT NULL THEN '🔄 Added system token'
    WHEN b.system_user_token IS NOT NULL AND c.system_user_token IS NULL THEN '⚠️ Lost system token'
    WHEN b.system_user_token != c.system_user_token THEN '🔄 Changed system token'
    ELSE '— Same'
  END as system_token_change,
  CASE 
    WHEN b.meta_access_token IS NOT NULL AND c.meta_access_token IS NULL THEN '🧹 Cleared'
    WHEN b.meta_access_token IS NULL AND c.meta_access_token IS NOT NULL THEN '⚠️ Added'
    ELSE '— Same'
  END as access_token_change
FROM clients c
LEFT JOIN clients_backup_before_token_copy b ON c.id = b.id
WHERE c.ad_account_id IS NOT NULL
ORDER BY c.name;

-- ============================================================================
-- STEP 6: Export token for manual testing
-- ============================================================================

SELECT 
  '🧪 TOKEN FOR MANUAL TEST' as section;

-- Get the most common system_user_token (should be Belmonte's)
SELECT 
  'Most common system_user_token:' as description,
  system_user_token as token_value,
  COUNT(*) as used_by_clients
FROM clients
WHERE system_user_token IS NOT NULL
GROUP BY system_user_token
ORDER BY COUNT(*) DESC
LIMIT 1;







