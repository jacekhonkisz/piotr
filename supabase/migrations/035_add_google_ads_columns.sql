-- Add Google Ads columns to clients table
-- Migration: 035_add_google_ads_columns.sql

-- Add Google Ads columns to clients table
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS google_ads_customer_id TEXT,
ADD COLUMN IF NOT EXISTS google_ads_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_ads_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_ads_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS google_ads_enabled BOOLEAN DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN clients.google_ads_customer_id IS 'Google Ads Customer ID (format: XXX-XXX-XXXX)';
COMMENT ON COLUMN clients.google_ads_refresh_token IS 'OAuth refresh token for Google Ads API';
COMMENT ON COLUMN clients.google_ads_access_token IS 'OAuth access token for Google Ads API';
COMMENT ON COLUMN clients.google_ads_token_expires_at IS 'Token expiration timestamp';
COMMENT ON COLUMN clients.google_ads_enabled IS 'Enable/disable Google Ads for this client';

-- Create system settings for Google Ads if they don't exist
INSERT INTO system_settings (key, value, description) VALUES
  ('google_ads_client_id', '', 'Google Ads API Client ID'),
  ('google_ads_client_secret', '', 'Google Ads API Client Secret'),
  ('google_ads_developer_token', '', 'Google Ads API Developer Token'),
  ('google_ads_manager_customer_id', '', 'Google Ads Manager Customer ID'),
  ('google_ads_enabled', 'true', 'Enable/disable Google Ads integration globally')
ON CONFLICT (key) DO NOTHING; 