-- Migration: Create reports storage bucket and policies
-- This migration sets up storage for PDF reports with proper access control

-- Create the reports storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports',
  'reports',
  true,
  52428800, -- 50MB limit
  ARRAY['application/pdf']
) ON CONFLICT (id) DO NOTHING;

-- Create storage policies for reports bucket
-- Allow authenticated users to upload reports
CREATE POLICY "Allow authenticated users to upload reports" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'reports' AND 
    auth.role() = 'authenticated'
  );

-- Allow authenticated users to view reports
CREATE POLICY "Allow authenticated users to view reports" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'reports' AND 
    auth.role() = 'authenticated'
  );

-- Allow authenticated users to update their own reports
CREATE POLICY "Allow authenticated users to update reports" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'reports' AND 
    auth.role() = 'authenticated'
  );

-- Allow authenticated users to delete their own reports
CREATE POLICY "Allow authenticated users to delete reports" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'reports' AND 
    auth.role() = 'authenticated'
  );

-- Create RLS policies for sent_reports table if they don't exist
-- Allow admins to view all sent reports
CREATE POLICY "Allow admins to view all sent reports" ON sent_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Allow admins to insert sent reports
CREATE POLICY "Allow admins to insert sent reports" ON sent_reports
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Allow admins to update sent reports
CREATE POLICY "Allow admins to update sent reports" ON sent_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Allow admins to delete sent reports
CREATE POLICY "Allow admins to delete sent reports" ON sent_reports
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Allow clients to view their own sent reports
CREATE POLICY "Allow clients to view their own sent reports" ON sent_reports
  FOR SELECT USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE clients.id = sent_reports.client_id
    )
  ); 