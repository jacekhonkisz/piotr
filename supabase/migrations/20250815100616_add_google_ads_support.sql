-- Migration: Add Google Ads support
-- This migration adds Google Ads credentials and data storage capabilities

-- Add Google Ads credentials to clients table
ALTER TABLE clients ADD COLUMN google_ads_customer_id TEXT;
ALTER TABLE clients ADD COLUMN google_ads_refresh_token TEXT;
ALTER TABLE clients ADD COLUMN google_ads_access_token TEXT;
ALTER TABLE clients ADD COLUMN google_ads_token_expires_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN google_ads_enabled BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN clients.google_ads_customer_id IS 'Google Ads Customer ID (format: 123-456-7890)';
COMMENT ON COLUMN clients.google_ads_refresh_token IS 'Google Ads API refresh token';
COMMENT ON COLUMN clients.google_ads_access_token IS 'Google Ads API access token';
COMMENT ON COLUMN clients.google_ads_token_expires_at IS 'When the Google Ads access token expires';
COMMENT ON COLUMN clients.google_ads_enabled IS 'Whether Google Ads reporting is enabled for this client';

-- Create indexes for performance
CREATE INDEX idx_clients_google_ads_customer_id ON clients(google_ads_customer_id) WHERE google_ads_customer_id IS NOT NULL;
CREATE INDEX idx_clients_google_ads_enabled ON clients(google_ads_enabled) WHERE google_ads_enabled = TRUE;

-- Create google_ads_campaigns table (similar to campaigns table but for Google Ads)
CREATE TABLE google_ads_campaigns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  campaign_id TEXT NOT NULL, -- Google Ads campaign ID
  campaign_name TEXT NOT NULL,
  status TEXT NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  
  -- Core metrics matching your requirements
  spend DECIMAL(12,2) DEFAULT 0 NOT NULL, -- Wydana kwota
  impressions BIGINT DEFAULT 0 NOT NULL, -- Wyświetlenia
  clicks BIGINT DEFAULT 0 NOT NULL, -- Kliknięcia
  cpc DECIMAL(8,2) DEFAULT 0 NOT NULL, -- CPC
  ctr DECIMAL(5,2) DEFAULT 0 NOT NULL, -- CTR
  
  -- Conversion metrics
  form_submissions BIGINT DEFAULT 0 NOT NULL, -- Wysłanie formularza
  phone_calls BIGINT DEFAULT 0 NOT NULL, -- Połączenia z reklam
  email_clicks BIGINT DEFAULT 0 NOT NULL, -- Kliknięcia w adres e-mail
  phone_clicks BIGINT DEFAULT 0 NOT NULL, -- Kliknięcia w numer telefonu
  booking_step_1 BIGINT DEFAULT 0 NOT NULL, -- Booking Engine krok 1
  booking_step_2 BIGINT DEFAULT 0 NOT NULL, -- Booking Engine krok 2
  booking_step_3 BIGINT DEFAULT 0 NOT NULL, -- Booking Engine krok 3
  reservations BIGINT DEFAULT 0 NOT NULL, -- Rezerwacje
  reservation_value DECIMAL(12,2) DEFAULT 0 NOT NULL, -- Wartość rezerwacji
  roas DECIMAL(8,2) DEFAULT 0 NOT NULL, -- ROAS
  
  -- Additional metadata
  demographics JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure no duplicate campaign data for same date range
  UNIQUE(client_id, campaign_id, date_range_start, date_range_end)
);

-- Create google_ads_tables_data for storing detailed Google Ads analytics (similar to Meta tables)
CREATE TABLE google_ads_tables_data (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  
  -- Performance by placement/network
  placement_performance JSONB, -- Search, Display, YouTube, etc.
  
  -- Demographics performance
  demographic_performance JSONB, -- Age groups, gender, location
  
  -- Device performance
  device_performance JSONB, -- Mobile, Desktop, Tablet
  
  -- Keywords performance
  keywords_performance JSONB, -- Top performing keywords
  
  -- Time-based performance
  hourly_performance JSONB, -- Performance by hour of day
  
  data_source TEXT DEFAULT 'google_ads_api',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure unique data per client and date range
  UNIQUE(client_id, date_range_start, date_range_end)
);

-- Create indexes for performance
CREATE INDEX idx_google_ads_campaigns_client_id ON google_ads_campaigns(client_id);
CREATE INDEX idx_google_ads_campaigns_date_range ON google_ads_campaigns(date_range_start, date_range_end);
CREATE INDEX idx_google_ads_tables_client_id ON google_ads_tables_data(client_id);
CREATE INDEX idx_google_ads_tables_date_range ON google_ads_tables_data(date_range_start, date_range_end);

-- Add updated_at triggers for new tables
CREATE TRIGGER update_google_ads_campaigns_updated_at 
  BEFORE UPDATE ON google_ads_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for google_ads_campaigns
ALTER TABLE google_ads_campaigns ENABLE ROW LEVEL SECURITY;

-- Admins can view Google Ads campaigns for their clients
CREATE POLICY "Admins can view client Google Ads campaigns" ON google_ads_campaigns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = google_ads_campaigns.client_id 
      AND clients.admin_id = auth.uid()
    )
  );

-- Admins can insert Google Ads campaigns for their clients
CREATE POLICY "Admins can insert client Google Ads campaigns" ON google_ads_campaigns
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = google_ads_campaigns.client_id 
      AND clients.admin_id = auth.uid()
    )
  );

-- Admins can update Google Ads campaigns for their clients
CREATE POLICY "Admins can update client Google Ads campaigns" ON google_ads_campaigns
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = google_ads_campaigns.client_id 
      AND clients.admin_id = auth.uid()
    )
  );

-- RLS Policies for google_ads_tables_data
ALTER TABLE google_ads_tables_data ENABLE ROW LEVEL SECURITY;

-- Admins can view Google Ads tables data for their clients
CREATE POLICY "Admins can view client Google Ads tables data" ON google_ads_tables_data
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = google_ads_tables_data.client_id 
      AND clients.admin_id = auth.uid()
    )
  );

-- Admins can insert Google Ads tables data for their clients
CREATE POLICY "Admins can insert client Google Ads tables data" ON google_ads_tables_data
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = google_ads_tables_data.client_id 
      AND clients.admin_id = auth.uid()
    )
  );

-- Add Google Ads related system settings
INSERT INTO system_settings (key, value, description) VALUES
  ('google_ads_client_id', '""', 'Google Ads API Client ID'),
  ('google_ads_client_secret', '""', 'Google Ads API Client Secret'),
  ('google_ads_developer_token', '""', 'Google Ads API Developer Token'),
  ('google_ads_enabled', 'true', 'Enable/disable Google Ads integration globally')
ON CONFLICT (key) DO NOTHING;
