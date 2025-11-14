-- ============================================================================
-- Migration 056: Create settings table for platform API tokens
-- ============================================================================
-- Purpose: Create a simple settings table for storing platform API tokens
--          (separate from system_settings which uses JSONB)
-- Date: November 13, 2025
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
CREATE TRIGGER update_settings_updated_at 
  BEFORE UPDATE ON settings
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Insert placeholder for meta_system_user_token if one exists in clients table
-- This will copy the first system_user_token found to the global settings
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
ON CONFLICT (key) DO NOTHING;

-- If no system_user_token exists in clients, create empty placeholder
INSERT INTO settings (key, value, description, created_at, updated_at)
VALUES (
  'meta_system_user_token',
  '',
  'Global Meta System User Token - shared across all clients for API reports',
  NOW(),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- Insert placeholder for Google Ads refresh token
INSERT INTO settings (key, value, description, created_at, updated_at)
VALUES (
  'google_ads_manager_refresh_token',
  '',
  'Google Ads Manager Account Refresh Token - shared across all clients',
  NOW(),
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- Add comment to table
COMMENT ON TABLE settings IS 'Simple key-value storage for platform API tokens and configuration';
COMMENT ON COLUMN settings.key IS 'Unique setting key identifier';
COMMENT ON COLUMN settings.value IS 'Setting value (plain text, tokens are stored encrypted at rest by Supabase)';
COMMENT ON COLUMN settings.description IS 'Human-readable description of the setting';


