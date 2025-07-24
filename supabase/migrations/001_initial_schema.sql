-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enums
CREATE TYPE user_role AS ENUM ('admin', 'client');
CREATE TYPE client_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE api_status AS ENUM ('valid', 'invalid', 'expired', 'pending');
CREATE TYPE reporting_frequency AS ENUM ('monthly', 'weekly', 'on_demand');
CREATE TYPE email_status AS ENUM ('sent', 'delivered', 'failed', 'bounced');

-- Create profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'client',
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create clients table
CREATE TABLE clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  meta_access_token TEXT NOT NULL, -- Will be encrypted
  ad_account_id TEXT NOT NULL,
  reporting_frequency reporting_frequency DEFAULT 'monthly' NOT NULL,
  last_report_date DATE,
  api_status api_status DEFAULT 'pending' NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure admin can only have one client with the same email
  UNIQUE(admin_id, email)
);

-- Create reports table
CREATE TABLE reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  file_url TEXT, -- Supabase storage URL
  file_size_bytes INTEGER,
  generation_time_ms INTEGER,
  email_sent BOOLEAN DEFAULT FALSE NOT NULL,
  email_sent_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure no duplicate reports for same client and date range
  UNIQUE(client_id, date_range_start, date_range_end)
);

-- Create campaigns table (cached Meta Ads data)
CREATE TABLE campaigns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  campaign_id TEXT NOT NULL, -- Meta campaign ID
  campaign_name TEXT NOT NULL,
  status TEXT NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  impressions BIGINT DEFAULT 0 NOT NULL,
  clicks BIGINT DEFAULT 0 NOT NULL,
  spend DECIMAL(12,2) DEFAULT 0 NOT NULL,
  conversions BIGINT DEFAULT 0 NOT NULL,
  ctr DECIMAL(5,2) DEFAULT 0 NOT NULL,
  cpc DECIMAL(8,2) DEFAULT 0 NOT NULL,
  cpp DECIMAL(8,2),
  frequency DECIMAL(5,2),
  reach BIGINT,
  demographics JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure no duplicate campaign data for same date range
  UNIQUE(client_id, campaign_id, date_range_start, date_range_end)
);

-- Create email_logs table
CREATE TABLE email_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status email_status DEFAULT 'sent' NOT NULL,
  provider_id TEXT, -- Resend email ID
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create system_settings table
CREATE TABLE system_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_clients_admin_id ON clients(admin_id);
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_api_status ON clients(api_status);
CREATE INDEX idx_reports_client_id ON reports(client_id);
CREATE INDEX idx_reports_date_range ON reports(date_range_start, date_range_end);
CREATE INDEX idx_campaigns_client_id ON campaigns(client_id);
CREATE INDEX idx_campaigns_date_range ON campaigns(date_range_start, date_range_end);
CREATE INDEX idx_email_logs_report_id ON email_logs(report_id);
CREATE INDEX idx_email_logs_status ON email_logs(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'client');
  RETURN NEW;
END;
$$ language plpgsql security definer;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: Users can only see and update their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Clients: Admins can manage their clients, clients can view their own data
CREATE POLICY "Admins can view their clients" ON clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
      AND profiles.id = clients.admin_id
    )
  );

CREATE POLICY "Clients can view their own data" ON clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'client'
      AND profiles.email = clients.email
    )
  );

CREATE POLICY "Admins can manage their clients" ON clients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
      AND profiles.id = clients.admin_id
    )
  );

-- Reports: Admins can see reports for their clients, clients can see their own reports
CREATE POLICY "Admins can view client reports" ON reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients 
      JOIN profiles ON profiles.id = clients.admin_id
      WHERE clients.id = reports.client_id 
      AND profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

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

CREATE POLICY "Admins can manage client reports" ON reports
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clients 
      JOIN profiles ON profiles.id = clients.admin_id
      WHERE clients.id = reports.client_id 
      AND profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Campaigns: Same access pattern as reports
CREATE POLICY "Admins can view client campaigns" ON campaigns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients 
      JOIN profiles ON profiles.id = clients.admin_id
      WHERE clients.id = campaigns.client_id 
      AND profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage client campaigns" ON campaigns
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clients 
      JOIN profiles ON profiles.id = clients.admin_id
      WHERE clients.id = campaigns.client_id 
      AND profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Email logs: Only admins can view
CREATE POLICY "Admins can view email logs" ON email_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reports
      JOIN clients ON clients.id = reports.client_id
      JOIN profiles ON profiles.id = clients.admin_id
      WHERE reports.id = email_logs.report_id 
      AND profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- System settings: Only admins can access
CREATE POLICY "Admins can manage system settings" ON system_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Insert default system settings
INSERT INTO system_settings (key, value, description) VALUES
  ('email_templates_enabled', 'true', 'Enable custom email templates'),
  ('max_clients_per_admin', '100', 'Maximum clients per admin user'),
  ('default_reporting_frequency', '"monthly"', 'Default reporting frequency for new clients'),
  ('pdf_generation_timeout', '30000', 'PDF generation timeout in milliseconds'),
  ('meta_api_rate_limit', '200', 'Meta API calls per hour limit'),
  ('email_rate_limit', '1000', 'Emails per day limit');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated; 