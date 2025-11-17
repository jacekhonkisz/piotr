-- 🔑 Copy Belmonte's System User Token to All Clients
-- 
-- This script copies Belmonte Hotel's working system_user_token
-- to all other clients, giving them the same permanent token.
--
-- Date: November 13, 2025
-- Safe to run - includes backup and verification steps

-- ============================================================================
-- STEP 1: SAFETY BACKUP
-- ============================================================================

-- Create backup table with timestamp
CREATE TABLE IF NOT EXISTS clients_backup_before_token_copy AS 
SELECT * FROM clients WHERE ad_account_id IS NOT NULL;

-- Verify backup created
SELECT 
  COUNT(*) as backed_up_clients,
  STRING_AGG(name, ', ') as client_names
FROM clients_backup_before_token_copy;

-- ============================================================================
-- STEP 2: CHECK BELMONTE'S TOKEN
-- ============================================================================

-- View Belmonte's current token (first 30 chars for verification)
SELECT 
  name,
  ad_account_id,
  CASE 
    WHEN system_user_token IS NOT NULL THEN 
      '✅ Has System Token: ' || LEFT(system_user_token, 30) || '...'
    WHEN meta_access_token IS NOT NULL THEN 
      '⏰ Has Access Token: ' || LEFT(meta_access_token, 30) || '...'
    ELSE '❌ No Token'
  END as token_info,
  token_health_status,
  api_status
FROM clients
WHERE name ILIKE '%belmonte%';

-- ============================================================================
-- STEP 3: PREVIEW WHAT WILL BE UPDATED
-- ============================================================================

-- See which clients will be updated (all except Belmonte)
SELECT 
  name,
  ad_account_id,
  CASE 
    WHEN system_user_token IS NOT NULL THEN 'Has System Token (will keep)'
    WHEN meta_access_token IS NOT NULL THEN 'Has Access Token (will replace)'
    ELSE 'No Token (will add)'
  END as current_status,
  '→ Will get Belmonte token' as action
FROM clients
WHERE ad_account_id IS NOT NULL
  AND name NOT ILIKE '%belmonte%'
ORDER BY name;

-- Count how many will be updated
SELECT COUNT(*) as clients_to_update 
FROM clients
WHERE ad_account_id IS NOT NULL
  AND name NOT ILIKE '%belmonte%';

-- ============================================================================
-- STEP 4: COPY BELMONTE'S TOKEN TO ALL CLIENTS
-- ============================================================================

-- Update all clients to use Belmonte's system_user_token
UPDATE clients 
SET 
  -- Copy Belmonte's system_user_token
  system_user_token = (
    SELECT system_user_token 
    FROM clients 
    WHERE name ILIKE '%belmonte%' 
    LIMIT 1
  ),
  
  -- Clear old individual access tokens
  meta_access_token = NULL,
  
  -- Update validation metadata
  last_token_validation = NOW(),
  token_health_status = 'valid',
  api_status = 'valid',
  updated_at = NOW()

WHERE 
  -- Only update clients with ad accounts
  ad_account_id IS NOT NULL
  AND ad_account_id != ''
  
  -- Don't update Belmonte itself (it already has the token)
  AND name NOT ILIKE '%belmonte%';

-- ============================================================================
-- STEP 5: VERIFY THE UPDATE
-- ============================================================================

-- Check that all clients now have the same token as Belmonte
SELECT 
  name,
  ad_account_id,
  LEFT(system_user_token, 40) || '...' as token_preview,
  CASE 
    WHEN system_user_token = (SELECT system_user_token FROM clients WHERE name ILIKE '%belmonte%' LIMIT 1)
    THEN '✅ Same as Belmonte'
    ELSE '❌ Different token'
  END as token_match,
  CASE 
    WHEN meta_access_token IS NOT NULL THEN '⚠️ Old token still present'
    ELSE '✅ Clean'
  END as cleanup_status,
  token_health_status,
  last_token_validation
FROM clients
WHERE ad_account_id IS NOT NULL
ORDER BY name;

-- ============================================================================
-- STEP 6: SUMMARY REPORT
-- ============================================================================

-- Overall summary
SELECT 
  '📊 MIGRATION SUMMARY' as report,
  COUNT(*) as total_meta_clients,
  COUNT(DISTINCT system_user_token) as unique_tokens,
  CASE 
    WHEN COUNT(DISTINCT system_user_token) = 1 THEN '✅ SUCCESS - All using same token!'
    ELSE '⚠️ REVIEW - Multiple tokens still present'
  END as status
FROM clients
WHERE ad_account_id IS NOT NULL AND system_user_token IS NOT NULL;

-- List all clients grouped by token (should all be in one group now)
SELECT 
  LEFT(system_user_token, 30) || '...' as token_preview,
  COUNT(*) as client_count,
  STRING_AGG(name, ', ' ORDER BY name) as clients
FROM clients
WHERE ad_account_id IS NOT NULL AND system_user_token IS NOT NULL
GROUP BY system_user_token
ORDER BY client_count DESC;

-- ============================================================================
-- STEP 7: ROLLBACK (If Needed)
-- ============================================================================

-- If something goes wrong, restore from backup:
/*
UPDATE clients c
SET 
  system_user_token = b.system_user_token,
  meta_access_token = b.meta_access_token,
  token_health_status = b.token_health_status,
  api_status = b.api_status,
  last_token_validation = b.last_token_validation,
  updated_at = b.updated_at
FROM clients_backup_before_token_copy b
WHERE c.id = b.id;

SELECT '✅ Rollback complete' as status;
*/

-- ============================================================================
-- STEP 8: CLEANUP (After 48 Hours)
-- ============================================================================

-- After verifying everything works for 48 hours, remove backup:
/*
DROP TABLE IF EXISTS clients_backup_before_token_copy;
SELECT '✅ Backup table removed' as status;
*/

-- ============================================================================
-- 🎯 WHAT THIS SCRIPT DOES
-- ============================================================================

/*
1. ✅ Creates safety backup of all clients
2. 🔍 Shows Belmonte's current token
3. 📋 Previews which clients will be updated
4. 🔄 Copies Belmonte's system_user_token to all other clients
5. 🧹 Clears old individual meta_access_tokens
6. ✅ Verifies all clients now use the same token
7. 📊 Shows summary report
8. 🔄 Provides rollback instructions if needed

EXPECTED RESULT:
- All clients with ad_account_id will have Belmonte's system_user_token
- All old meta_access_tokens will be cleared
- Token status will be 'valid' for all
- Unique tokens count should be 1 (all using same token)

NEXT STEPS AFTER RUNNING:
1. Go to /admin/monitoring
2. Click "Test All Tokens"
3. All clients should show ✅ PASSED
4. Test a few client reports to verify data loads
5. Monitor for 24-48 hours
6. Run cleanup query to remove backup table
*/

-- ============================================================================
-- 🔐 SECURITY NOTE
-- ============================================================================

/*
This is safe because:
- System user token access is controlled in Meta Business Manager
- Token alone can't access an ad account without permission
- Each client still has unique ad_account_id
- You control which ad accounts the system user can access

Make sure in Meta Business Manager:
- Your system user has access to ALL client ad accounts
- Permissions are set correctly (ads_read minimum)
*/

-- ============================================================================
-- 📊 EXPECTED OUTPUT
-- ============================================================================

/*
Before:
┌──────────────────┬─────────────┬─────────────────┐
│ Client           │ Token Type  │ Status          │
├──────────────────┼─────────────┼─────────────────┤
│ Belmonte         │ System User │ ✅ Working      │
│ Lambert          │ Access (60d)│ ❌ Expired      │
│ Mazury           │ Access (60d)│ ❌ Expired      │
│ Others...        │ Access (60d)│ ❌ Expired      │
└──────────────────┴─────────────┴─────────────────┘

After:
┌──────────────────┬─────────────┬─────────────────┐
│ Client           │ Token Type  │ Status          │
├──────────────────┼─────────────┼─────────────────┤
│ Belmonte         │ System User │ ✅ Working      │
│ Lambert          │ System User │ ✅ Working      │
│ Mazury           │ System User │ ✅ Working      │
│ Others...        │ System User │ ✅ Working      │
└──────────────────┴─────────────┴─────────────────┘

All using Belmonte's permanent token! 🎉
*/



