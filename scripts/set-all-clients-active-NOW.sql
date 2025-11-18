-- =====================================================
-- 🚀 IMMEDIATE FIX: ADD STATUS COLUMN & SET ALL CLIENTS ACTIVE
-- =====================================================
-- Run this SQL in Supabase Dashboard SQL Editor
-- URL: https://supabase.com/dashboard/project/YOUR_PROJECT/sql
-- =====================================================

-- Step 1: Add status column if it doesn't exist (with default 'active')
ALTER TABLE clients 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' NOT NULL;

-- Step 2: Update any existing NULL values to 'active' (just in case)
UPDATE clients 
SET status = 'active' 
WHERE status IS NULL OR status = '';

-- Step 3: Create index for performance
CREATE INDEX IF NOT EXISTS idx_clients_status 
  ON clients(status);

-- Step 4: Verify the fix
SELECT 
  COUNT(*) as total_clients,
  COUNT(*) FILTER (WHERE status = 'active') as active_clients,
  COUNT(*) FILTER (WHERE status IS NULL OR status = '') as null_status_clients,
  STRING_AGG(DISTINCT status, ', ') as all_status_values
FROM clients;

-- Expected result: 
-- total_clients = active_clients
-- null_status_clients = 0
-- all_status_values = 'active'

