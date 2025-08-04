-- Fix remaining RLS policies that use email matching instead of admin_id
-- This ensures all client access is consistent

-- Fix the original policies in the initial schema that weren't caught by the previous migration
DROP POLICY IF EXISTS "Clients can view their own reports" ON reports;

-- Recreate the policy with correct admin_id matching
CREATE POLICY "Clients can view their own reports" ON reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients 
      JOIN profiles ON profiles.id = clients.admin_id
      WHERE clients.id = reports.client_id 
      AND profiles.id = auth.uid()
      AND profiles.role = 'client'
    )
  );

-- Also fix any sent_reports policies that might use email matching
-- Check if sent_reports table exists and has policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sent_reports') THEN
    -- Drop and recreate sent_reports policies if they exist
    EXECUTE 'DROP POLICY IF EXISTS "Clients can view their own sent reports" ON sent_reports';
    
    EXECUTE 'CREATE POLICY "Clients can view their own sent reports" ON sent_reports
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM clients 
          JOIN profiles ON profiles.id = clients.admin_id
          WHERE clients.id = sent_reports.client_id 
          AND profiles.id = auth.uid()
          AND profiles.role = ''client''
        )
      )';
  END IF;
END $$; 