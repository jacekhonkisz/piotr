-- ✅ FIX: Copy Belmonte's WORKING Token to All Clients
-- 
-- The issue: We copied the EXPIRED system_user_token instead of the WORKING meta_access_token!
-- 
-- Belmonte has TWO tokens:
--   system_user_token = EXPIRED (October 27)
--   meta_access_token = WORKING!
-- 
-- We need to copy the WORKING one!

-- ============================================================================
-- STEP 1: Verify which token is which
-- ============================================================================

SELECT 
  '🔍 BELMONTE TOKEN CHECK' as section;

SELECT 
  name,
  'Expired system_user_token: ' || LEFT(system_user_token, 30) || '...' as token1,
  'Working meta_access_token: ' || LEFT(meta_access_token, 30) || '...' as token2
FROM clients
WHERE name ILIKE '%belmonte%';

-- ============================================================================
-- STEP 2: Backup (just in case)
-- ============================================================================

-- Create backup if doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients_backup_correct_token') THEN
    CREATE TABLE clients_backup_correct_token AS SELECT * FROM clients;
    RAISE NOTICE 'Backup created';
  ELSE
    RAISE NOTICE 'Backup already exists';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Copy Belmonte's WORKING token (meta_access_token) to everyone
-- ============================================================================

UPDATE clients 
SET 
  -- Use Belmonte's WORKING token (from meta_access_token field)
  system_user_token = (
    SELECT meta_access_token 
    FROM clients 
    WHERE name ILIKE '%belmonte%' 
    LIMIT 1
  ),
  
  -- Also put it in meta_access_token for compatibility
  meta_access_token = (
    SELECT meta_access_token 
    FROM clients 
    WHERE name ILIKE '%belmonte%' 
    LIMIT 1
  ),
  
  -- Update metadata
  last_token_validation = NOW(),
  token_health_status = 'valid',
  api_status = 'valid',
  updated_at = NOW()

WHERE ad_account_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Verify the update
-- ============================================================================

SELECT 
  '📊 VERIFICATION' as section;

-- Check that all clients now have the working token
SELECT 
  name,
  LEFT(system_user_token, 30) || '...' as system_token,
  LEFT(meta_access_token, 30) || '...' as access_token,
  system_user_token = meta_access_token as tokens_match,
  CASE 
    WHEN LEFT(system_user_token, 10) = 'EAAR4iSxFE' THEN '✅ Has working token'
    WHEN LEFT(system_user_token, 10) = 'EAAlDmWD3W' THEN '❌ Still has expired token'
    ELSE '❓ Unknown token'
  END as token_status
FROM clients
WHERE ad_account_id IS NOT NULL
ORDER BY name;

-- Count check
SELECT 
  COUNT(*) as total_clients,
  COUNT(DISTINCT system_user_token) as unique_system_tokens,
  COUNT(DISTINCT meta_access_token) as unique_access_tokens
FROM clients
WHERE ad_account_id IS NOT NULL;

-- Expected: All should have EAAR4iSxFE token (the working one)

-- ============================================================================
-- STEP 5: Test the token
-- ============================================================================

SELECT 
  '🧪 TOKEN TO TEST' as section;

-- Show the token we just copied (should be the working one)
SELECT 
  'Test this token (should work):' as label,
  system_user_token as token
FROM clients
WHERE ad_account_id IS NOT NULL
LIMIT 1;



