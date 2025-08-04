-- Fix campaign_summaries RLS policy to use admin_id instead of email matching
-- This ensures clients can access their campaign summaries properly

-- Drop the old policy that uses email matching
DROP POLICY IF EXISTS "Clients can view their own campaign summaries" ON campaign_summaries;

-- Create new policy that uses admin_id matching
CREATE POLICY "Clients can view their own campaign summaries" ON campaign_summaries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients 
      JOIN profiles ON profiles.id = clients.admin_id
      WHERE clients.id = campaign_summaries.client_id 
      AND profiles.id = auth.uid()
      AND profiles.role = 'client'
    )
  ); 