-- 🔑 Migrate All Clients to Shared System User Token
-- 
-- This script updates all your clients to use ONE shared system user token
-- instead of individual tokens per client.
--
-- BEFORE RUNNING:
-- 1. Create system user in Meta Business Manager
-- 2. Grant it access to ALL client ad accounts
-- 3. Generate the system user token
-- 4. Replace 'YOUR_SYSTEM_USER_TOKEN_HERE' below with your actual token
--
-- Date: November 13, 2025

-- ============================================================================
-- STEP 1: BACKUP (SAFETY FIRST!)
-- ============================================================================

-- Create backup table
CREATE TABLE IF NOT EXISTS clients_backup_20251113 AS 
SELECT * FROM clients;

-- Verify backup
SELECT COUNT(*) as backed_up_clients FROM clients_backup_20251113;

-- ============================================================================
-- STEP 2: CHECK CURRENT STATE
-- ============================================================================

-- See current token distribution
SELECT 
  CASE 
    WHEN system_user_token IS NOT NULL THEN 'Has System Token'
    WHEN meta_access_token IS NOT NULL THEN 'Has Access Token'
    ELSE 'No Token'
  END as token_type,
  COUNT(*) as count,
  STRING_AGG(name, ', ') as clients
FROM clients
WHERE api_status = 'valid'
GROUP BY token_type
ORDER BY count DESC;

-- ============================================================================
-- STEP 3: UPDATE TO SHARED TOKEN
-- ============================================================================

-- ⚠️ IMPORTANT: Replace 'YOUR_SYSTEM_USER_TOKEN_HERE' with your actual token!
-- The token should look like: EAAGno4gbz9cBO...

UPDATE clients 
SET 
  -- Set the shared system user token for all clients
  system_user_token = 'YOUR_SYSTEM_USER_TOKEN_HERE',
  
  -- Clear old individual access tokens
  meta_access_token = NULL,
  
  -- Update validation timestamp
  last_token_validation = NOW(),
  
  -- Mark as valid
  token_health_status = 'valid',
  api_status = 'valid',
  
  -- Update modified timestamp
  updated_at = NOW()

WHERE 
  -- Only update clients that have Meta ad accounts
  ad_account_id IS NOT NULL
  AND ad_account_id != ''
  
  -- Only update active clients
  AND api_status = 'valid';

-- ============================================================================
-- STEP 4: VERIFY UPDATE
-- ============================================================================

-- Check that all Meta clients now have the shared token
SELECT 
  name,
  ad_account_id,
  LEFT(system_user_token, 30) || '...' as token_preview,
  CASE 
    WHEN meta_access_token IS NOT NULL THEN '⚠️ Still has old token'
    ELSE '✅ Clean'
  END as old_token_status,
  token_health_status,
  last_token_validation
FROM clients
WHERE ad_account_id IS NOT NULL
ORDER BY name;

-- Count results
SELECT 
  COUNT(*) as total_clients_updated,
  COUNT(DISTINCT system_user_token) as unique_tokens
FROM clients
WHERE ad_account_id IS NOT NULL;

-- Expected result: unique_tokens should be 1 (all using same token)

-- ============================================================================
-- STEP 5: CLEANUP (OPTIONAL)
-- ============================================================================

-- After verifying everything works (wait 24-48 hours), you can remove backup:
-- DROP TABLE clients_backup_20251113;

-- ============================================================================
-- ROLLBACK (If Something Goes Wrong)
-- ============================================================================

-- To rollback to previous state:
/*
UPDATE clients c
SET 
  system_user_token = b.system_user_token,
  meta_access_token = b.meta_access_token,
  token_health_status = b.token_health_status,
  api_status = b.api_status,
  last_token_validation = b.last_token_validation
FROM clients_backup_20251113 b
WHERE c.id = b.id;
*/

-- ============================================================================
-- NOTES
-- ============================================================================

/*
✅ BENEFITS OF SHARED TOKEN:
- One token to manage instead of 10+
- Never expires (system user tokens are permanent)
- Easier to update if needed
- More secure (centralized control)
- Consistent across all clients

🔑 WHAT MAKES EACH CLIENT UNIQUE:
- ad_account_id (different for each client)
- Token + Ad Account ID = API access to specific client

🔒 SECURITY:
- Token alone doesn't give access
- Must also have permission to each ad account in Business Manager
- Revoke access by removing ad account permission, not by deleting token

📊 AFTER THIS SCRIPT:
1. Go to /admin/monitoring
2. Click "Test All Tokens"
3. All should show ✅ PASSED
4. Test a few client reports to verify data loads

⚠️ IMPORTANT:
- Make sure the system user has access to ALL ad accounts in Business Manager
- Test with one client first if unsure
- Keep the backup table for at least 48 hours
*/







