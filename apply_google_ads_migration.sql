-- Manual Google Ads Migration Application
-- This file applies Google Ads support safely with IF NOT EXISTS clauses

-- Add Google Ads credentials to clients table (safe to run multiple times)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_ads_customer_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_ads_refresh_token TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_ads_access_token TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_ads_token_expires_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_ads_enabled BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'google_ads_customer_id') THEN
    COMMENT ON COLUMN clients.google_ads_customer_id IS 'Google Ads Customer ID (format: 123-456-7890)';
    COMMENT ON COLUMN clients.google_ads_refresh_token IS 'Google Ads API refresh token';
    COMMENT ON COLUMN clients.google_ads_access_token IS 'Google Ads API access token';
    COMMENT ON COLUMN clients.google_ads_token_expires_at IS 'When the Google Ads access token expires';
    COMMENT ON COLUMN clients.google_ads_enabled IS 'Whether Google Ads reporting is enabled for this client';
  END IF;
END $$;

-- Create indexes for performance (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_clients_google_ads_customer_id ON clients(google_ads_customer_id) WHERE google_ads_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_google_ads_enabled ON clients(google_ads_enabled) WHERE google_ads_enabled = TRUE;

-- Create google_ads_campaigns table (safe to run multiple times)
CREATE TABLE IF NOT EXISTS google_ads_campaigns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  status TEXT NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  
  -- Core metrics
  spend DECIMAL(12,2) DEFAULT 0 NOT NULL,
  impressions BIGINT DEFAULT 0 NOT NULL,
  clicks BIGINT DEFAULT 0 NOT NULL,
  cpc DECIMAL(8,2) DEFAULT 0 NOT NULL,
  ctr DECIMAL(5,2) DEFAULT 0 NOT NULL,
  
  -- Conversion metrics
  form_submissions BIGINT DEFAULT 0 NOT NULL,
  phone_calls BIGINT DEFAULT 0 NOT NULL,
  email_clicks BIGINT DEFAULT 0 NOT NULL,
  phone_clicks BIGINT DEFAULT 0 NOT NULL,
  booking_step_1 BIGINT DEFAULT 0 NOT NULL,
  booking_step_2 BIGINT DEFAULT 0 NOT NULL,
  booking_step_3 BIGINT DEFAULT 0 NOT NULL,
  reservations BIGINT DEFAULT 0 NOT NULL,
  reservation_value DECIMAL(12,2) DEFAULT 0 NOT NULL,
  roas DECIMAL(8,2) DEFAULT 0 NOT NULL,
  
  -- Metadata
  demographics JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  UNIQUE(client_id, campaign_id, date_range_start, date_range_end)
);

-- Create google_ads_tables_data table (safe to run multiple times)
CREATE TABLE IF NOT EXISTS google_ads_tables_data (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  
  placement_performance JSONB,
  demographic_performance JSONB,
  device_performance JSONB,
  keywords_performance JSONB,
  hourly_performance JSONB,
  
  data_source TEXT DEFAULT 'google_ads_api',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  UNIQUE(client_id, date_range_start, date_range_end)
);

-- Create indexes (safe to run multiple times)
CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_client_id ON google_ads_campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_date_range ON google_ads_campaigns(date_range_start, date_range_end);
CREATE INDEX IF NOT EXISTS idx_google_ads_tables_client_id ON google_ads_tables_data(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_tables_date_range ON google_ads_tables_data(date_range_start, date_range_end);

-- Add updated_at trigger (safe to run multiple times)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') 
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'google_ads_campaigns') THEN
    DROP TRIGGER IF EXISTS update_google_ads_campaigns_updated_at ON google_ads_campaigns;
    CREATE TRIGGER update_google_ads_campaigns_updated_at 
      BEFORE UPDATE ON google_ads_campaigns
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Enable RLS and create policies (safe to run multiple times)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'google_ads_campaigns') THEN
    ALTER TABLE google_ads_campaigns ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Admins can view client Google Ads campaigns" ON google_ads_campaigns;
    DROP POLICY IF EXISTS "Admins can insert client Google Ads campaigns" ON google_ads_campaigns;
    DROP POLICY IF EXISTS "Admins can update client Google Ads campaigns" ON google_ads_campaigns;
    
    -- Create new policies
    CREATE POLICY "Admins can view client Google Ads campaigns" ON google_ads_campaigns
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM clients 
          WHERE clients.id = google_ads_campaigns.client_id 
          AND clients.admin_id = auth.uid()
        )
      );

    CREATE POLICY "Admins can insert client Google Ads campaigns" ON google_ads_campaigns
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM clients 
          WHERE clients.id = google_ads_campaigns.client_id 
          AND clients.admin_id = auth.uid()
        )
      );

    CREATE POLICY "Admins can update client Google Ads campaigns" ON google_ads_campaigns
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM clients 
          WHERE clients.id = google_ads_campaigns.client_id 
          AND clients.admin_id = auth.uid()
        )
      );
  END IF;
END $$;

-- RLS for google_ads_tables_data
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'google_ads_tables_data') THEN
    ALTER TABLE google_ads_tables_data ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Admins can view client Google Ads tables data" ON google_ads_tables_data;
    DROP POLICY IF EXISTS "Admins can insert client Google Ads tables data" ON google_ads_tables_data;
    
    CREATE POLICY "Admins can view client Google Ads tables data" ON google_ads_tables_data
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM clients 
          WHERE clients.id = google_ads_tables_data.client_id 
          AND clients.admin_id = auth.uid()
        )
      );

    CREATE POLICY "Admins can insert client Google Ads tables data" ON google_ads_tables_data
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM clients 
          WHERE clients.id = google_ads_tables_data.client_id 
          AND clients.admin_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Add Google Ads related system settings (safe to run multiple times)
INSERT INTO system_settings (key, value, description) VALUES
  ('google_ads_client_id', '""', 'Google Ads API Client ID'),
  ('google_ads_client_secret', '""', 'Google Ads API Client Secret'),
  ('google_ads_developer_token', '""', 'Google Ads API Developer Token'),
  ('google_ads_enabled', 'true', 'Enable/disable Google Ads integration globally')
ON CONFLICT (key) DO NOTHING;

-- Mark migration as applied in the schema_migrations table
INSERT INTO supabase_migrations.schema_migrations (version, name, statements) 
VALUES ('20250815100616', 'add_google_ads_support', 1)
ON CONFLICT (version) DO NOTHING; 