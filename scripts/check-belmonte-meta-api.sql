-- Check Belmonte's Meta API credentials and status

SELECT 
  '=== BELMONTE CLIENT INFO ===' as section,
  id,
  name,
  email,
  
  -- Meta credentials
  CASE 
    WHEN meta_access_token IS NOT NULL THEN '✅ Has meta_access_token'
    ELSE '❌ Missing meta_access_token'
  END as token_status,
  
  CASE 
    WHEN system_user_token IS NOT NULL THEN '✅ Has system_user_token (permanent)'
    ELSE 'ℹ️  No system_user_token (will use 60-day token)'
  END as system_token_status,
  
  CASE 
    WHEN ad_account_id IS NOT NULL THEN '✅ Has ad_account_id: ' || ad_account_id
    ELSE '❌ Missing ad_account_id'
  END as ad_account_status,
  
  -- Token expiry check (first 20 chars for security)
  LEFT(meta_access_token, 20) || '...' as token_preview,
  
  -- Check if token might be expired (Meta tokens are typically 200+ chars)
  CASE 
    WHEN LENGTH(meta_access_token) < 100 THEN '⚠️  Token seems short (might be invalid)'
    WHEN LENGTH(meta_access_token) > 100 THEN '✅ Token length OK'
    ELSE '❌ No token'
  END as token_length_check

FROM clients
WHERE name ILIKE '%belmonte%'
LIMIT 1;






