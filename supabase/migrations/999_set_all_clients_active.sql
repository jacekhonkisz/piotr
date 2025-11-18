-- =====================================================
-- ADD STATUS COLUMN & SET ALL CLIENTS TO ACTIVE BY DEFAULT
-- =====================================================
-- This migration ensures:
-- 1. Status column exists on clients table
-- 2. All existing clients are set to 'active'
-- 3. New clients default to 'active'
-- 4. The status column cannot be NULL
-- =====================================================

-- Step 1: Add status column if it doesn't exist (with default 'active')
ALTER TABLE clients 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' NOT NULL;

-- Step 2: Update any existing NULL or empty values to 'active'
UPDATE clients 
SET status = 'active' 
WHERE status IS NULL 
   OR status = '' 
   OR status != 'active';

-- Step 3: Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_clients_status 
  ON clients(status);

-- Verification query (for logging purposes)
DO $$ 
DECLARE
  total_clients INTEGER;
  active_clients INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_clients FROM clients;
  SELECT COUNT(*) INTO active_clients FROM clients WHERE status = 'active';
  
  RAISE NOTICE '✅ Migration complete:';
  RAISE NOTICE '   Total clients: %', total_clients;
  RAISE NOTICE '   Active clients: %', active_clients;
  RAISE NOTICE '   All clients are now active: %', (total_clients = active_clients);
END $$;

