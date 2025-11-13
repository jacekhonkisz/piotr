-- 🔍 Verify Settings Table Contents
-- Check what's actually in the settings table after migration

SELECT '📊 Settings Table Contents:' as section;

-- Show all settings entries
SELECT 
  key,
  CASE 
    WHEN value = '' OR value IS NULL THEN '❌ EMPTY'
    ELSE '✅ HAS VALUE: ' || LEFT(value, 30) || '...'
  END as value_status,
  LENGTH(value) as value_length,
  description,
  created_at,
  updated_at
FROM settings
WHERE key IN ('meta_system_user_token', 'google_ads_manager_refresh_token')
ORDER BY key;

-- Show the actual token value (first 50 chars)
SELECT 
  '🔑 Actual Meta Token Value:' as info,
  LEFT(value, 50) || '...' as token_preview,
  LENGTH(value) as full_length,
  CASE 
    WHEN value = '' THEN '❌ Token is EMPTY STRING'
    WHEN value IS NULL THEN '❌ Token is NULL'
    WHEN LENGTH(value) < 50 THEN '⚠️ Token seems too short'
    WHEN value LIKE 'EAA%' THEN '✅ Token format looks correct'
    ELSE '⚠️ Token format unexpected'
  END as validation
FROM settings
WHERE key = 'meta_system_user_token';

-- Compare with clients table to see what should have been copied
SELECT '🔍 Comparing with Clients Table:' as section;

SELECT 
  'clients.system_user_token' as source,
  LEFT(system_user_token, 50) || '...' as token_preview,
  LENGTH(system_user_token) as token_length,
  name as client_name
FROM clients
WHERE system_user_token IS NOT NULL 
  AND system_user_token != ''
LIMIT 3;

-- Check if any client has a token at all
SELECT 
  COUNT(*) as total_clients,
  COUNT(system_user_token) as clients_with_system_token,
  COUNT(CASE WHEN system_user_token != '' THEN 1 END) as clients_with_non_empty_token
FROM clients;

