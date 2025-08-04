-- Fix RLS policies for clients to allow client users to access their own data
-- The current policies are incorrect - they check admin_id against client user ID

-- Drop the incorrect policies
DROP POLICY IF EXISTS "Clients can view their own data" ON clients;
DROP POLICY IF EXISTS "Clients can view their own client data" ON clients;

-- Create correct policies for client access
-- Clients should be able to access their own data by email matching
CREATE POLICY "Clients can view their own data" ON clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'client'
      AND profiles.email = clients.email
    )
  );

-- Admins should be able to access all clients they manage
CREATE POLICY "Admins can view their managed clients" ON clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
      AND profiles.id = clients.admin_id
    )
  );

-- Fix reports policy for client access
DROP POLICY IF EXISTS "Clients can view their own reports" ON reports;

CREATE POLICY "Clients can view their own reports" ON reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients 
      JOIN profiles ON profiles.email = clients.email
      WHERE clients.id = reports.client_id 
      AND profiles.id = auth.uid()
      AND profiles.role = 'client'
    )
  );

-- Fix campaigns policy for client access
DROP POLICY IF EXISTS "Clients can view their own campaigns" ON campaigns;

CREATE POLICY "Clients can view their own campaigns" ON campaigns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients 
      JOIN profiles ON profiles.email = clients.email
      WHERE clients.id = campaigns.client_id 
      AND profiles.id = auth.uid()
      AND profiles.role = 'client'
    )
  );

-- Verify the policies
DO $$
BEGIN
  RAISE NOTICE 'RLS policies updated for proper client access';
  RAISE NOTICE 'Clients can now access their own data by email matching';
  RAISE NOTICE 'Admins can access clients they manage by admin_id matching';
END $$; 