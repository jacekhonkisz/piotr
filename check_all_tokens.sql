-- Check if clients have BOTH system_user_token AND meta_access_token
-- Maybe the system is using different tokens for different operations?

SELECT 
  name,
  system_user_token IS NOT NULL as has_system_token,
  meta_access_token IS NOT NULL as has_access_token,
  CASE 
    WHEN system_user_token IS NOT NULL THEN LENGTH(system_user_token)
    ELSE 0
  END as system_token_length,
  CASE 
    WHEN meta_access_token IS NOT NULL THEN LENGTH(meta_access_token)
    ELSE 0
  END as access_token_length,
  CASE 
    WHEN system_user_token IS NOT NULL AND meta_access_token IS NOT NULL THEN '⚠️ HAS BOTH!'
    WHEN system_user_token IS NOT NULL THEN '✅ System token only'
    WHEN meta_access_token IS NOT NULL THEN '⏰ Access token only'
    ELSE '❌ No tokens'
  END as token_status
FROM clients
WHERE name ILIKE '%belmonte%';

-- Also check if they're different
SELECT 
  name,
  system_user_token = meta_access_token as tokens_are_same,
  LEFT(system_user_token, 50) as system_token_preview,
  LEFT(meta_access_token, 50) as access_token_preview
FROM clients
WHERE name ILIKE '%belmonte%'
  AND system_user_token IS NOT NULL
  AND meta_access_token IS NOT NULL;


