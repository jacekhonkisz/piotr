-- Check Belmonte's Meta API credentials
SELECT 
  id,
  name,
  ad_account_id,
  CASE 
    WHEN meta_access_token IS NOT NULL THEN '✅ Token exists (length: ' || LENGTH(meta_access_token) || ')'
    ELSE '❌ NO TOKEN'
  END as token_status,
  CASE
    WHEN ad_account_id IS NOT NULL THEN '✅ Ad Account ID exists'
    ELSE '❌ NO AD ACCOUNT ID'
  END as account_status,
  created_at,
  updated_at
FROM clients
WHERE name ILIKE '%belmonte%';



