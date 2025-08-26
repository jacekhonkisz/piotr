-- Migration: Add Google Ads campaigns table for unified reporting
-- This table stores Google Ads campaign data similar to the existing campaigns table for Meta Ads

-- Create google_ads_campaigns table
CREATE TABLE google_ads_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  campaign_id TEXT NOT NULL, -- Google Ads campaign ID
  campaign_name TEXT NOT NULL,
  status TEXT NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  
  -- Core metrics matching Meta Ads structure
  spend DECIMAL(12,2) DEFAULT 0 NOT NULL, -- Wydana kwota
  impressions BIGINT DEFAULT 0 NOT NULL, -- Wyświetlenia
  clicks BIGINT DEFAULT 0 NOT NULL, -- Kliknięcia
  cpc DECIMAL(8,2) DEFAULT 0 NOT NULL, -- CPC
  ctr DECIMAL(5,2) DEFAULT 0 NOT NULL, -- CTR
  
  -- Conversion metrics (matching Meta Ads conversion structure)
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

-- Create indexes for performance (matching Meta Ads campaigns table)
CREATE INDEX idx_google_ads_campaigns_client_id ON google_ads_campaigns(client_id);
CREATE INDEX idx_google_ads_campaigns_date_range ON google_ads_campaigns(date_range_start, date_range_end);
CREATE INDEX idx_google_ads_campaigns_client_date ON google_ads_campaigns(client_id, date_range_start, date_range_end);

-- Add updated_at trigger (matching other tables)
CREATE TRIGGER update_google_ads_campaigns_updated_at 
  BEFORE UPDATE ON google_ads_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE google_ads_campaigns ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (matching Meta Ads campaigns policies)
CREATE POLICY "Service role can manage Google Ads campaigns" ON google_ads_campaigns
  FOR ALL USING (auth.role() = 'service_role');

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

CREATE POLICY "Admins can delete client Google Ads campaigns" ON google_ads_campaigns
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = google_ads_campaigns.client_id 
      AND clients.admin_id = auth.uid()
    )
  );

-- Add table comment
COMMENT ON TABLE google_ads_campaigns IS 'Stores Google Ads campaign data for unified reporting with Meta Ads';

-- Add column comments for documentation
COMMENT ON COLUMN google_ads_campaigns.campaign_id IS 'Google Ads campaign ID from Google Ads API';
COMMENT ON COLUMN google_ads_campaigns.spend IS 'Total amount spent on this campaign in PLN';
COMMENT ON COLUMN google_ads_campaigns.reservations IS 'Number of hotel reservations from this campaign';
COMMENT ON COLUMN google_ads_campaigns.reservation_value IS 'Total value of reservations in PLN';
COMMENT ON COLUMN google_ads_campaigns.roas IS 'Return on Ad Spend (reservation_value / spend)';
