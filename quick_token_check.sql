-- ⚡ QUICK TOKEN CHECK
-- Run this to see immediately what's wrong

-- Show everything side by side
SELECT 
  'SETTINGS TABLE' as location,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM settings WHERE key = 'meta_system_user_token') 
    THEN '❌ Entry does not exist!'
    WHEN (SELECT value FROM settings WHERE key = 'meta_system_user_token') = ''
    THEN '❌ Entry exists but token is EMPTY'
    ELSE '✅ Entry exists with token: ' || 
         LEFT((SELECT value FROM settings WHERE key = 'meta_system_user_token'), 40) || '...'
  END as status,
  (SELECT LENGTH(value) FROM settings WHERE key = 'meta_system_user_token') as token_length

UNION ALL

SELECT 
  'CLIENTS TABLE' as location,
  CASE 
    WHEN COUNT(*) = 0 THEN '❌ No tokens in clients table'
    ELSE '✅ Found ' || COUNT(*) || ' clients with tokens'
  END as status,
  MAX(LENGTH(system_user_token)) as token_length
FROM clients
WHERE system_user_token IS NOT NULL AND system_user_token != '';

-- Show the actual values
SELECT 
  '🔑 TOKEN COMPARISON' as section;

SELECT 
  'Settings Table' as source,
  COALESCE(value, 'NULL') as token_value,
  LENGTH(COALESCE(value, '')) as length
FROM settings
WHERE key = 'meta_system_user_token'

UNION ALL

SELECT 
  'Clients Table (first)' as source,
  system_user_token as token_value,
  LENGTH(system_user_token) as length
FROM clients
WHERE system_user_token IS NOT NULL AND system_user_token != ''
LIMIT 1;







