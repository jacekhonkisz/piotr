-- Fix campaign_summaries RLS policy for client users
-- Migration 016 broke this by requiring clients.admin_id = auth.uid(),
-- but admin_id points to the admin user, not the client user.
-- Client users need to match via their email address.

DROP POLICY IF EXISTS "Clients can view their own campaign summaries" ON campaign_summaries;

CREATE POLICY "Clients can view their own campaign summaries" ON campaign_summaries
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE email = (
        SELECT email FROM auth.users 
        WHERE id = auth.uid()
      )
    )
  );
