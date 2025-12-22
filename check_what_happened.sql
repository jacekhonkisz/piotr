-- 🔍 Check What Actually Happened During Migration
-- Something doesn't add up - let's investigate

-- ============================================================================
-- 1. Check if we have the backup
-- ============================================================================

SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients_backup_before_token_copy')
    THEN '✅ Backup exists'
    ELSE '❌ No backup found'
  END as backup_status;

-- ============================================================================
-- 2. What did Belmonte have BEFORE the migration?
-- ============================================================================

SELECT 
  '🏨 BELMONTE - BEFORE MIGRATION (from backup)' as section;

SELECT 
  name,
  system_user_token IS NOT NULL as had_system_token_before,
  meta_access_token IS NOT NULL as had_access_token_before,
  CASE 
    WHEN system_user_token IS NOT NULL THEN LENGTH(system_user_token)
    ELSE 0
  END as system_token_length_before,
  CASE 
    WHEN meta_access_token IS NOT NULL THEN LENGTH(meta_access_token)
    ELSE 0
  END as access_token_length_before,
  LEFT(COALESCE(system_user_token, meta_access_token, 'NO_TOKEN'), 50) || '...' as token_preview_before
FROM clients_backup_before_token_copy
WHERE name ILIKE '%belmonte%';

-- ============================================================================
-- 3. What does Belmonte have NOW?
-- ============================================================================

SELECT 
  '🏨 BELMONTE - NOW (current state)' as section;

SELECT 
  name,
  system_user_token IS NOT NULL as has_system_token_now,
  meta_access_token IS NOT NULL as has_access_token_now,
  CASE 
    WHEN system_user_token IS NOT NULL THEN LENGTH(system_user_token)
    ELSE 0
  END as system_token_length_now,
  CASE 
    WHEN meta_access_token IS NOT NULL THEN LENGTH(meta_access_token)
    ELSE 0
  END as access_token_length_now,
  LEFT(COALESCE(system_user_token, meta_access_token, 'NO_TOKEN'), 50) || '...' as token_preview_now
FROM clients
WHERE name ILIKE '%belmonte%';

-- ============================================================================
-- 4. Did the token change?
-- ============================================================================

SELECT 
  '🔄 TOKEN COMPARISON' as section;

SELECT 
  b.name,
  CASE 
    WHEN c.system_user_token = b.system_user_token THEN '✅ Same system token'
    WHEN c.system_user_token = b.meta_access_token THEN '🔄 Copied meta_access_token to system_user_token'
    WHEN c.system_user_token IS NOT NULL AND b.system_user_token IS NOT NULL THEN '⚠️ Token changed!'
    ELSE '❓ Unknown change'
  END as what_happened,
  b.system_user_token = c.system_user_token as tokens_match,
  LEFT(COALESCE(b.system_user_token, b.meta_access_token, 'NO_TOKEN_BEFORE'), 30) || '...' as before_token,
  LEFT(COALESCE(c.system_user_token, c.meta_access_token, 'NO_TOKEN_NOW'), 30) || '...' as after_token
FROM clients c
LEFT JOIN clients_backup_before_token_copy b ON c.id = b.id
WHERE c.name ILIKE '%belmonte%';

-- ============================================================================
-- 5. Show full tokens for comparison
-- ============================================================================

SELECT 
  '🔑 FULL TOKEN VALUES' as section;

-- Belmonte's token BEFORE migration
SELECT 
  'BEFORE (from backup)' as when_captured,
  COALESCE(system_user_token, meta_access_token, 'NO_TOKEN') as token_value
FROM clients_backup_before_token_copy
WHERE name ILIKE '%belmonte%';

-- Belmonte's token NOW
SELECT 
  'NOW (current)' as when_captured,
  COALESCE(system_user_token, meta_access_token, 'NO_TOKEN') as token_value
FROM clients
WHERE name ILIKE '%belmonte%';







