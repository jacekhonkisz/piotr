-- Make meta_access_token nullable to support dual token system
-- This allows either meta_access_token or system_user_token to be used

ALTER TABLE clients 
ALTER COLUMN meta_access_token DROP NOT NULL;

-- Add comment to explain the change
COMMENT ON COLUMN clients.meta_access_token IS 'Meta Access token (60-day) - can be null if system_user_token is used'; 