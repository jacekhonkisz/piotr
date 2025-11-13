-- ============================================================================
-- Apply Settings Table Migration
-- ============================================================================
-- This creates the missing 'settings' table and populates it with your token
-- Run this to fix the "relation settings does not exist" error
-- ============================================================================

-- Create settings table for simple key-value storage
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for fast key lookups
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Admins can view settings" ON settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON settings;
DROP POLICY IF EXISTS "Admins can update settings" ON settings;
DROP POLICY IF EXISTS "Admins can delete settings" ON settings;

-- RLS policies: Only admins can read/write settings
CREATE POLICY "Admins can view settings" ON settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert settings" ON settings
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update settings" ON settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete settings" ON settings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at 
  BEFORE UPDATE ON settings
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Copy existing token from clients table to global settings
-- ============================================================================

SELECT '🔍 Checking for existing system_user_token in clients table...' as status;

-- Show what we found
SELECT 
  name,
  LEFT(system_user_token, 30) || '...' as token_preview,
  ad_account_id,
  '✅ Found token to copy' as status
FROM clients
WHERE system_user_token IS NOT NULL 
  AND system_user_token != ''
LIMIT 1;

-- Copy the token to settings table
INSERT INTO settings (key, value, description, created_at, updated_at)
SELECT 
  'meta_system_user_token' as key,
  system_user_token as value,
  'Global Meta System User Token - shared across all clients for API reports' as description,
  NOW() as created_at,
  NOW() as updated_at
FROM clients
WHERE system_user_token IS NOT NULL 
  AND system_user_token != ''
LIMIT 1
ON CONFLICT (key) DO UPDATE 
SET 
  value = EXCLUDED.value,
  updated_at = NOW();

-- Insert placeholder for Google Ads refresh token if it doesn't exist
INSERT INTO settings (key, value, description, created_at, updated_at)
VALUES (
  'google_ads_manager_refresh_token',
  '',
  'Google Ads Manager Account Refresh Token - shared across all clients',
  NOW(),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- Verify the migration worked
-- ============================================================================

SELECT '✅ Migration complete! Verifying results...' as status;

-- Show the settings table content
SELECT 
  key,
  CASE 
    WHEN value = '' THEN '❌ Not set yet'
    ELSE '✅ Token present: ' || LEFT(value, 20) || '...'
  END as value_status,
  LENGTH(value) as token_length,
  description,
  created_at,
  updated_at
FROM settings
WHERE key IN ('meta_system_user_token', 'google_ads_manager_refresh_token')
ORDER BY key;

SELECT '🎉 Done! The modal should now show your token correctly.' as final_status;

