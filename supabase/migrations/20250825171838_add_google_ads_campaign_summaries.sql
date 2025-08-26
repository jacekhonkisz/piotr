-- Migration: Add Google Ads campaign summaries for smart caching
-- This table mirrors the campaign_summaries table structure for Google Ads data

-- Create google_ads_campaign_summaries table (matching campaign_summaries structure)
CREATE TABLE google_ads_campaign_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'custom')),
  
  -- Aggregated metrics from Google Ads campaigns
  total_spend DECIMAL(12,2) DEFAULT 0 NOT NULL,
  total_impressions BIGINT DEFAULT 0 NOT NULL,
  total_clicks BIGINT DEFAULT 0 NOT NULL,
  total_conversions BIGINT DEFAULT 0 NOT NULL,
  average_ctr DECIMAL(5,2) DEFAULT 0 NOT NULL,
  average_cpc DECIMAL(8,2) DEFAULT 0 NOT NULL,
  average_cpm DECIMAL(8,2) DEFAULT 0 NOT NULL,
  
  -- Conversion metrics totals
  total_form_submissions BIGINT DEFAULT 0 NOT NULL,
  total_phone_calls BIGINT DEFAULT 0 NOT NULL,
  total_email_clicks BIGINT DEFAULT 0 NOT NULL,
  total_phone_clicks BIGINT DEFAULT 0 NOT NULL,
  total_booking_step_1 BIGINT DEFAULT 0 NOT NULL,
  total_booking_step_2 BIGINT DEFAULT 0 NOT NULL,
  total_booking_step_3 BIGINT DEFAULT 0 NOT NULL,
  total_reservations BIGINT DEFAULT 0 NOT NULL,
  total_reservation_value DECIMAL(12,2) DEFAULT 0 NOT NULL,
  average_roas DECIMAL(8,2) DEFAULT 0 NOT NULL,
  
  -- Campaign count for this period
  campaign_count INTEGER DEFAULT 0 NOT NULL,
  
  -- Data freshness tracking
  data_source TEXT DEFAULT 'google_ads_api' NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure unique summaries per client and period
  UNIQUE(client_id, period_start, period_end, period_type)
);

-- Create indexes for performance (matching campaign_summaries)
CREATE INDEX idx_google_ads_summaries_client_id ON google_ads_campaign_summaries(client_id);
CREATE INDEX idx_google_ads_summaries_period ON google_ads_campaign_summaries(period_start, period_end);
CREATE INDEX idx_google_ads_summaries_client_period ON google_ads_campaign_summaries(client_id, period_start, period_end);
CREATE INDEX idx_google_ads_summaries_period_type ON google_ads_campaign_summaries(period_type);
CREATE INDEX idx_google_ads_summaries_last_updated ON google_ads_campaign_summaries(last_updated);

-- Add updated_at trigger
CREATE TRIGGER update_google_ads_summaries_updated_at 
  BEFORE UPDATE ON google_ads_campaign_summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE google_ads_campaign_summaries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (matching campaign_summaries policies)
CREATE POLICY "Service role can manage Google Ads summaries" ON google_ads_campaign_summaries
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view client Google Ads summaries" ON google_ads_campaign_summaries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = google_ads_campaign_summaries.client_id 
      AND clients.admin_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert client Google Ads summaries" ON google_ads_campaign_summaries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = google_ads_campaign_summaries.client_id 
      AND clients.admin_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update client Google Ads summaries" ON google_ads_campaign_summaries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = google_ads_campaign_summaries.client_id 
      AND clients.admin_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete client Google Ads summaries" ON google_ads_campaign_summaries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM clients 
      WHERE clients.id = google_ads_campaign_summaries.client_id 
      AND clients.admin_id = auth.uid()
    )
  );

-- Add table comment
COMMENT ON TABLE google_ads_campaign_summaries IS 'Stores aggregated Google Ads campaign data for smart caching (current month/week)';

-- Add column comments
COMMENT ON COLUMN google_ads_campaign_summaries.period_type IS 'Type of period: weekly, monthly, or custom';
COMMENT ON COLUMN google_ads_campaign_summaries.total_spend IS 'Total spend across all campaigns in this period';
COMMENT ON COLUMN google_ads_campaign_summaries.total_reservations IS 'Total hotel reservations from all campaigns';
COMMENT ON COLUMN google_ads_campaign_summaries.average_roas IS 'Average Return on Ad Spend across campaigns';
COMMENT ON COLUMN google_ads_campaign_summaries.data_source IS 'Source of data (google_ads_api, cached, etc.)';
COMMENT ON COLUMN google_ads_campaign_summaries.last_updated IS 'When this summary was last refreshed from Google Ads API';
