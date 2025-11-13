-- 🔧 Fix: Copy system user token to global settings
-- This will make the modal show the token correctly

-- First, show what we're about to copy
SELECT 
  '🔍 Current situation:' as info;

SELECT 
  name,
  LEFT(system_user_token, 30) || '...' as token_preview,
  ad_account_id
FROM clients
WHERE system_user_token IS NOT NULL
LIMIT 3;

-- Copy the token from clients table to settings table
INSERT INTO settings (key, value, created_at, updated_at)
SELECT 
  'meta_system_user_token' as key,
  system_user_token as value,
  NOW() as created_at,
  NOW() as updated_at
FROM clients
WHERE system_user_token IS NOT NULL
LIMIT 1
ON CONFLICT (key) DO UPDATE 
SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- Verify it worked
SELECT 
  '✅ After fix:' as info;

SELECT 
  key,
  LEFT(value, 30) || '...' as token_preview,
  LENGTH(value) as token_length,
  updated_at
FROM settings
WHERE key = 'meta_system_user_token';

