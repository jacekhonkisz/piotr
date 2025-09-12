-- Add Google Ads Service Account support
-- This migration adds service account fields to system_settings for lifelong tokens

-- Add service account fields to system_settings
INSERT INTO system_settings (key, value, description, created_at, updated_at) VALUES
('google_ads_service_account_key', '', 'Google Ads Service Account JSON Key (Lifelong Token)', NOW(), NOW()),
('google_ads_service_account_email', '', 'Google Ads Service Account Email', NOW(), NOW()),
('google_ads_service_account_project_id', '', 'Google Ads Service Account Project ID', NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- Add comments for clarity
COMMENT ON TABLE system_settings IS 'System-wide configuration settings including Google Ads service account credentials';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_system_settings_google_ads ON system_settings (key) WHERE key LIKE 'google_ads_%';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON system_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON system_settings TO service_role;
