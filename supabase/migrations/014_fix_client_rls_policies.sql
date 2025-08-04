-- Fix RLS policies for clients to use admin_id instead of email matching
-- This ensures clients can access their data properly

-- Drop the old policies that use email matching
DROP POLICY IF EXISTS "Clients can view their own data" ON clients;
DROP POLICY IF EXISTS "Clients can view their own reports" ON reports;
DROP POLICY IF EXISTS "Clients can view their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Clients can view their own client data" ON clients;

-- Create new policies that use admin_id matching
CREATE POLICY "Clients can view their own data" ON clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'client'
      AND profiles.id = clients.admin_id
    )
  );

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

CREATE POLICY "Clients can view their own campaigns" ON campaigns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients 
      JOIN profiles ON profiles.id = clients.admin_id
      WHERE clients.id = campaigns.client_id 
      AND profiles.id = auth.uid()
      AND profiles.role = 'client'
    )
  );

CREATE POLICY "Clients can view their own client data" ON clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'client'
      AND profiles.id = clients.admin_id
    )
  ); 