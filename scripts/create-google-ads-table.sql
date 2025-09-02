-- Create google_ads_campaigns table for storing Google Ads data
-- This table mirrors the structure needed for unified PDF generation

CREATE TABLE IF NOT EXISTS google_ads_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_client_id ON google_ads_campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_date_range ON google_ads_campaigns(date_range_start, date_range_end);

-- Enable RLS
ALTER TABLE google_ads_campaigns ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Admins can view client Google Ads campaigns" ON google_ads_campaigns;
CREATE POLICY "Admins can view client Google Ads campaigns" ON google_ads_campaigns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = google_ads_campaigns.client_id 
      AND clients.admin_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can insert client Google Ads campaigns" ON google_ads_campaigns;
CREATE POLICY "Admins can insert client Google Ads campaigns" ON google_ads_campaigns
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = google_ads_campaigns.client_id 
      AND clients.admin_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Service role can manage Google Ads campaigns" ON google_ads_campaigns;
CREATE POLICY "Service role can manage Google Ads campaigns" ON google_ads_campaigns
  FOR ALL USING (auth.role() = 'service_role');

-- Add comment
COMMENT ON TABLE google_ads_campaigns IS 'Stores Google Ads campaign data for unified reporting';
