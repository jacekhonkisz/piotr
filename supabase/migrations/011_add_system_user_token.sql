-- Add system_user_token field to clients table
-- This allows storing both system user tokens (permanent) and meta access tokens (60-day)

ALTER TABLE clients 
ADD COLUMN system_user_token TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN clients.system_user_token IS 'System User token for permanent access (preferred over meta_access_token)';

-- Create an index for better performance when querying by token type
CREATE INDEX idx_clients_system_user_token ON clients(system_user_token) WHERE system_user_token IS NOT NULL;

-- Update the token_health_status logic to consider both token types
-- This will be handled by the application logic, but we ensure the field exists 