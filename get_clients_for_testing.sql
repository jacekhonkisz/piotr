-- 🔍 Get Client Info for Manual Testing
-- 
-- This query extracts all the information needed to manually test tokens
-- Use the output to update the test script

-- ============================================================================
-- STEP 1: Get the token being used
-- ============================================================================

SELECT 
  '🔑 TOKEN TO TEST' as section;

-- Get the most common system_user_token (should be what all clients use)
SELECT 
  'Token (copy this):' as label,
  system_user_token as value
FROM clients
WHERE system_user_token IS NOT NULL
GROUP BY system_user_token
ORDER BY COUNT(*) DESC
LIMIT 1;

-- ============================================================================
-- STEP 2: Get all client ad accounts
-- ============================================================================

SELECT 
  '📋 CLIENT AD ACCOUNTS' as section;

-- Format for easy copy/paste into test script
SELECT 
  '  "' || name || '|act_' || 
  REPLACE(ad_account_id, 'act_', '') || '",' as bash_array_line
FROM clients
WHERE ad_account_id IS NOT NULL
ORDER BY name;

-- ============================================================================
-- STEP 3: Generate curl commands for manual testing
-- ============================================================================

SELECT 
  '🧪 CURL COMMANDS (Copy/Paste Each)' as section;

-- Generate curl command for each client
WITH token_query AS (
  SELECT system_user_token as token
  FROM clients
  WHERE system_user_token IS NOT NULL
  LIMIT 1
)
SELECT 
  '# Test: ' || c.name as comment,
  'curl "https://graph.facebook.com/v18.0/act_' || 
  REPLACE(c.ad_account_id, 'act_', '') || 
  '?fields=id,name,account_status&access_token=' || 
  LEFT(t.token, 30) || '..."' as curl_command,
  '' as separator
FROM clients c
CROSS JOIN token_query t
WHERE c.ad_account_id IS NOT NULL
ORDER BY c.name;

-- ============================================================================
-- STEP 4: Summary
-- ============================================================================

SELECT 
  '📊 SUMMARY' as section;

SELECT 
  COUNT(*) as total_clients_to_test,
  STRING_AGG(name, ', ' ORDER BY name) as client_list
FROM clients
WHERE ad_account_id IS NOT NULL;

-- ============================================================================
-- STEP 5: Check token types
-- ============================================================================

SELECT 
  '🔍 TOKEN CHECK' as section;

SELECT 
  name,
  CASE 
    WHEN system_user_token IS NOT NULL THEN '✅ Has system_user_token'
    WHEN meta_access_token IS NOT NULL THEN '⏰ Has meta_access_token'
    ELSE '❌ No token'
  END as token_status,
  CASE 
    WHEN system_user_token IS NOT NULL THEN LENGTH(system_user_token)
    WHEN meta_access_token IS NOT NULL THEN LENGTH(meta_access_token)
    ELSE 0
  END as token_length
FROM clients
WHERE ad_account_id IS NOT NULL
ORDER BY name;



