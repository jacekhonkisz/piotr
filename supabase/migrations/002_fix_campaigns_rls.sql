-- Fix missing RLS policy for clients to view their own campaigns
-- This was causing the dashboard to show zeros because clients couldn't see their campaign data

-- Add the missing policy for clients to view their own campaigns
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

-- Also add a policy for clients to view their own client data (if missing)
CREATE POLICY "Clients can view their own client data" ON clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.email = clients.email
      AND profiles.id = auth.uid()
      AND profiles.role = 'client'
    )
  ); 