-- 🔧 Fix: Manually Copy Token to Settings Table
-- Use this if the automatic copy didn't work

-- First, let's see what we have
SELECT '🔍 Current State Check:' as section;

-- Check if settings table has an empty token
SELECT 
  'settings.meta_system_user_token' as location,
  CASE 
    WHEN value = '' OR value IS NULL THEN '❌ EMPTY - needs to be fixed'
    ELSE '✅ HAS VALUE'
  END as status,
  LENGTH(COALESCE(value, '')) as length
FROM settings
WHERE key = 'meta_system_user_token';

-- Check if clients have tokens
SELECT 
  'clients.system_user_token' as location,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Found ' || COUNT(*) || ' client(s) with tokens'
    ELSE '❌ No tokens in clients table'
  END as status,
  STRING_AGG(name, ', ') as client_names
FROM clients
WHERE system_user_token IS NOT NULL 
  AND system_user_token != '';

-- Now fix it by copying the token
UPDATE settings
SET 
  value = (
    SELECT system_user_token 
    FROM clients 
    WHERE system_user_token IS NOT NULL 
      AND system_user_token != ''
    LIMIT 1
  ),
  updated_at = NOW()
WHERE key = 'meta_system_user_token'
  AND (value = '' OR value IS NULL);

-- Verify the fix worked
SELECT '✅ After Fix:' as section;

SELECT 
  key,
  CASE 
    WHEN value = '' OR value IS NULL THEN '❌ STILL EMPTY - No tokens found in clients table!'
    ELSE '✅ Token copied successfully: ' || LEFT(value, 30) || '...'
  END as result,
  LENGTH(value) as token_length,
  updated_at
FROM settings
WHERE key = 'meta_system_user_token';

-- Show which client's token was used
SELECT 
  '📋 Token was copied from:' as info,
  name as client_name,
  ad_account_id,
  LEFT(system_user_token, 30) || '...' as token_used
FROM clients
WHERE system_user_token IS NOT NULL 
  AND system_user_token != ''
LIMIT 1;

