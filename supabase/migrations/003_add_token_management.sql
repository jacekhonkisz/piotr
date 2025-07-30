-- Migration 003: Add Token Management Fields
-- This migration adds fields for better token management and health monitoring

-- Add token management fields to clients table
ALTER TABLE clients ADD COLUMN token_expires_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN token_refresh_count INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN last_token_validation TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN token_health_status TEXT DEFAULT 'unknown';

-- Add indexes for performance
CREATE INDEX idx_clients_token_expires ON clients(token_expires_at);
CREATE INDEX idx_clients_token_health ON clients(token_health_status);
CREATE INDEX idx_clients_last_validation ON clients(last_token_validation);

-- Add comments for documentation
COMMENT ON COLUMN clients.token_expires_at IS 'When the Meta access token expires (for short-lived tokens)';
COMMENT ON COLUMN clients.token_refresh_count IS 'Number of times this token has been refreshed';
COMMENT ON COLUMN clients.last_token_validation IS 'Last time the token was validated';
COMMENT ON COLUMN clients.token_health_status IS 'Current health status: unknown, valid, expiring_soon, expired, invalid';

-- Create a function to update token health status
CREATE OR REPLACE FUNCTION update_token_health_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update token health status based on expiration
  IF NEW.token_expires_at IS NOT NULL THEN
    IF NEW.token_expires_at <= NOW() THEN
      NEW.token_health_status = 'expired';
    ELSIF NEW.token_expires_at <= NOW() + INTERVAL '30 days' THEN
      NEW.token_health_status = 'expiring_soon';
    ELSE
      NEW.token_health_status = 'valid';
    END IF;
  ELSE
    -- If no expiration date, assume it's a long-lived token
    NEW.token_health_status = 'valid';
  END IF;
  
  -- Update last validation timestamp
  NEW.last_token_validation = NOW();
  
  RETURN NEW;
END;
$$ language plpgsql;

-- Create trigger to automatically update token health status
CREATE TRIGGER update_token_health_trigger
  BEFORE INSERT OR UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_token_health_status();

-- Create a view for token health monitoring
CREATE VIEW token_health_overview AS
SELECT 
  c.id,
  c.name,
  c.email,
  c.token_health_status,
  c.token_expires_at,
  c.last_token_validation,
  c.token_refresh_count,
  c.api_status,
  CASE 
    WHEN c.token_expires_at IS NULL THEN 'Long-lived token'
    WHEN c.token_expires_at <= NOW() THEN 'Expired'
    WHEN c.token_expires_at <= NOW() + INTERVAL '7 days' THEN 'Expires within 7 days'
    WHEN c.token_expires_at <= NOW() + INTERVAL '30 days' THEN 'Expires within 30 days'
    ELSE 'Valid'
  END as expiration_status
FROM clients c
ORDER BY 
  CASE 
    WHEN c.token_health_status = 'expired' THEN 1
    WHEN c.token_health_status = 'expiring_soon' THEN 2
    WHEN c.token_health_status = 'valid' THEN 3
    ELSE 4
  END,
  c.token_expires_at ASC NULLS LAST;

-- Grant permissions on the view
GRANT SELECT ON token_health_overview TO authenticated; 