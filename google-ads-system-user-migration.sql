-- Google Ads System User Token Support Migration
-- Run this directly in Supabase SQL Editor

BEGIN;

-- Add system user token columns to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS google_ads_system_user_token TEXT,
ADD COLUMN IF NOT EXISTS google_ads_token_type VARCHAR(20) DEFAULT 'refresh_token' CHECK (google_ads_token_type IN ('refresh_token', 'system_user'));

-- Add comments for documentation
COMMENT ON COLUMN clients.google_ads_system_user_token IS 'Google Ads System User Token for permanent access';
COMMENT ON COLUMN clients.google_ads_token_type IS 'Type of Google Ads token: refresh_token or system_user';

-- Add system settings for Google Ads system user tokens
INSERT INTO system_settings (key, value, description) VALUES
  ('google_ads_system_user_token', '""', 'Global Google Ads System User Token'),
  ('google_ads_system_user_enabled', '"true"', 'Enable system user token as alternative'),
  ('google_ads_token_preference', '"system_user"', 'Preferred token type: system_user or refresh_token')
ON CONFLICT (key) DO NOTHING;

-- Create index for better performance on token type queries
CREATE INDEX IF NOT EXISTS idx_clients_google_ads_token_type ON clients(google_ads_token_type) WHERE google_ads_enabled = true;

-- Update existing clients to use refresh_token type by default
UPDATE clients 
SET google_ads_token_type = 'refresh_token' 
WHERE google_ads_enabled = true AND google_ads_token_type IS NULL;

COMMIT;
