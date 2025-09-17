-- Migration: Fix send_day consistency issues
-- This migration ensures all clients have proper send_day values set

-- First, let's check current state and fix NULL values
-- Update all clients with NULL send_day to use the system default (5)
UPDATE clients 
SET send_day = 5 
WHERE send_day IS NULL 
  AND reporting_frequency IN ('monthly', 'weekly');

-- Update system settings to ensure consistency
UPDATE system_settings 
SET value = '5' 
WHERE key = 'default_reporting_day' 
  AND value != '5';

UPDATE system_settings 
SET value = '5' 
WHERE key = 'global_default_send_day' 
  AND value != '5';

-- Add a constraint to prevent NULL send_day values for monthly/weekly clients
-- Note: We'll handle this in application logic instead of DB constraint 
-- to allow for more flexible validation

-- Create an index for better performance on send_day queries
CREATE INDEX IF NOT EXISTS idx_clients_send_day_frequency 
ON clients(send_day, reporting_frequency) 
WHERE reporting_frequency IN ('monthly', 'weekly');

-- Add a comment to document the expected behavior
COMMENT ON COLUMN clients.send_day IS 'Day of month (1-31) for monthly reports or day of week (1-7) for weekly reports. Should never be NULL for monthly/weekly frequencies.';

-- Log the migration
INSERT INTO system_settings (key, value, description) VALUES
  ('migration_022_applied', 'true', 'Fix send_day consistency migration applied')
ON CONFLICT (key) DO UPDATE SET 
  value = 'true',
  updated_at = NOW();
