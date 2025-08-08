-- Migration: Add client logo support
-- This migration adds logo support for clients with storage bucket and policies

-- Add logo_url field to clients table
ALTER TABLE clients ADD COLUMN logo_url TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN clients.logo_url IS 'URL to client logo stored in Supabase storage';

-- Create the client-logos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-logos',
  'client-logos',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

-- Create storage policies for client-logos bucket
-- Allow authenticated users to upload logos
CREATE POLICY "Allow authenticated admin users to upload client logos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'client-logos' AND 
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Allow authenticated users to view logos (public read)
CREATE POLICY "Allow public read access to client logos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'client-logos'
  );

-- Allow authenticated admin users to update logos
CREATE POLICY "Allow authenticated admin users to update client logos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'client-logos' AND 
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Allow authenticated admin users to delete logos
CREATE POLICY "Allow authenticated admin users to delete client logos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'client-logos' AND 
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Create index for better performance when querying by logo_url
CREATE INDEX idx_clients_logo_url ON clients(logo_url) WHERE logo_url IS NOT NULL; 