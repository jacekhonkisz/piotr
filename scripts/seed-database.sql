-- Seed script for Meta Ads Reporting SaaS
-- This creates demo admin and client users with proper authentication

-- Note: Users must be created through Supabase Auth first
-- This script assumes the following users have been created:
-- 1. admin@example.com (will be assigned admin role)
-- 2. client@example.com (will be assigned client role)

-- Update profiles to set correct roles
-- Replace the UUIDs below with actual user IDs from your Supabase auth.users table

-- Admin user profile
INSERT INTO profiles (id, email, role, full_name)
VALUES (
  '00000000-0000-0000-0000-000000000001', -- Replace with actual admin user ID
  'admin@example.com',
  'admin',
  'Admin User'
) ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  full_name = 'Admin User';

-- Client user profile  
INSERT INTO profiles (id, email, role, full_name)
VALUES (
  '00000000-0000-0000-0000-000000000002', -- Replace with actual client user ID
  'client@example.com', 
  'client',
  'Client User'
) ON CONFLICT (id) DO UPDATE SET
  role = 'client',
  full_name = 'Client User';

-- Sample client record (managed by admin)
INSERT INTO clients (
  admin_id,
  name,
  email, 
  company,
  meta_access_token,
  ad_account_id,
  reporting_frequency,
  api_status,
  notes
) VALUES (
  '00000000-0000-0000-0000-000000000001', -- Admin user ID
  'TechCorp Solutions',
  'client@techcorp.com',
  'TechCorp Inc.',
  'DEMO_TOKEN_REPLACE_WITH_REAL_META_TOKEN', -- This should be a real Meta access token
  '123456789', -- This should be a real Ad Account ID
  'monthly',
  'pending', -- Will be updated when real token is validated
  'Demo client for testing'
),
(
  '00000000-0000-0000-0000-000000000001', -- Admin user ID
  'Green Energy Co',
  'client@greenenergy.com', 
  'Green Energy Company',
  'DEMO_TOKEN_REPLACE_WITH_REAL_META_TOKEN_2',
  '987654321',
  'monthly',
  'pending',
  'Demo client for testing'
);

-- Sample campaign data (this would normally be fetched from Meta API)
INSERT INTO campaigns (
  client_id,
  campaign_id,
  campaign_name,
  status,
  date_range_start,
  date_range_end,
  impressions,
  clicks,
  spend,
  conversions,
  ctr,
  cpc,
  cpp,
  frequency,
  reach
) VALUES 
-- For TechCorp client
(
  (SELECT id FROM clients WHERE email = 'client@techcorp.com' LIMIT 1),
  'meta_campaign_001',
  'TechCorp Lead Generation Campaign',
  'ACTIVE',
  '2024-12-01',
  '2024-12-31', 
  125000,
  3500,
  8420.50,
  324,
  2.8,
  2.41,
  25.99,
  1.8,
  69500
),
-- For Green Energy client
(
  (SELECT id FROM clients WHERE email = 'client@greenenergy.com' LIMIT 1),
  'meta_campaign_002', 
  'Green Energy Awareness Campaign',
  'ACTIVE',
  '2024-12-01',
  '2024-12-31',
  89000,
  2100,
  5680.75,
  198,
  2.4,
  2.70,
  28.69,
  1.6,
  55600
);

-- Sample reports
INSERT INTO reports (
  client_id,
  date_range_start,
  date_range_end,
  file_url,
  file_size_bytes,
  generation_time_ms,
  email_sent,
  email_sent_at
) VALUES
-- TechCorp report
(
  (SELECT id FROM clients WHERE email = 'client@techcorp.com' LIMIT 1),
  '2024-12-01',
  '2024-12-31',
  'https://your-supabase-storage-url.com/reports/techcorp-dec-2024.pdf',
  245678,
  1250,
  true,
  NOW() - INTERVAL '2 days'
),
-- Green Energy report  
(
  (SELECT id FROM clients WHERE email = 'client@greenenergy.com' LIMIT 1),
  '2024-12-01', 
  '2024-12-31',
  'https://your-supabase-storage-url.com/reports/greenenergy-dec-2024.pdf',
  198432,
  980,
  true,
  NOW() - INTERVAL '1 day'
);

-- Sample email logs
INSERT INTO email_logs (
  report_id,
  recipient_email,
  subject,
  status,
  provider_id,
  delivered_at
) VALUES
(
  (SELECT id FROM reports WHERE client_id = (SELECT id FROM clients WHERE email = 'client@techcorp.com' LIMIT 1) LIMIT 1),
  'client@techcorp.com',
  'Your December 2024 Meta Ads Report is Ready',
  'delivered',
  'resend_email_id_123',
  NOW() - INTERVAL '2 days'
),
(
  (SELECT id FROM reports WHERE client_id = (SELECT id FROM clients WHERE email = 'client@greenenergy.com' LIMIT 1) LIMIT 1),
  'client@greenenergy.com', 
  'Your December 2024 Meta Ads Report is Ready',
  'delivered',
  'resend_email_id_124',
  NOW() - INTERVAL '1 day'
);

-- Update system settings with demo values
UPDATE system_settings SET value = '"demo_mode"' WHERE key = 'email_templates_enabled';
UPDATE system_settings SET value = '50' WHERE key = 'max_clients_per_admin';

-- Print success message
SELECT 'Database seeded successfully! Please update the user IDs and Meta tokens with real values.' as message; 