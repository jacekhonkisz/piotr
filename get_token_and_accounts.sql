-- 🔑 Get Token and Ad Accounts for Testing
-- Simple query to get everything needed

-- ============================================================================
-- 1. Get the token (copy this!)
-- ============================================================================

SELECT 
  '🔑 COPY THIS TOKEN:' as label,
  system_user_token as token
FROM clients
WHERE system_user_token IS NOT NULL
LIMIT 1;

-- ============================================================================
-- 2. Get all ad accounts with their IDs
-- ============================================================================

SELECT 
  '📋 AD ACCOUNTS TO TEST:' as label;

SELECT 
  name,
  ad_account_id
FROM clients
WHERE ad_account_id IS NOT NULL
ORDER BY name;

-- ============================================================================
-- 3. Count check
-- ============================================================================

SELECT 
  COUNT(*) as total_clients,
  COUNT(DISTINCT system_user_token) as unique_tokens
FROM clients
WHERE system_user_token IS NOT NULL;

-- Expected: unique_tokens = 1 (all using same token) ✅


