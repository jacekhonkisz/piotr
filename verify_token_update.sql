-- Check if all clients now have the working token

SELECT 
  name,
  LEFT(system_user_token, 20) || '...' as token_preview,
  CASE 
    WHEN LEFT(system_user_token, 10) = 'EAAR4iSxFE' THEN '✅ Has working token'
    WHEN LEFT(system_user_token, 10) = 'EAAlDmWD3W' THEN '❌ Has expired token'
    ELSE '❓ Unknown'
  END as token_status
FROM clients
WHERE ad_account_id IS NOT NULL
ORDER BY name;

-- Summary
SELECT 
  CASE 
    WHEN LEFT(system_user_token, 10) = 'EAAR4iSxFE' THEN '✅ Has working token'
    WHEN LEFT(system_user_token, 10) = 'EAAlDmWD3W' THEN '❌ Has expired token'
    ELSE '❓ Unknown'
  END as token_status,
  COUNT(*) as client_count
FROM clients
WHERE ad_account_id IS NOT NULL
GROUP BY token_status;


