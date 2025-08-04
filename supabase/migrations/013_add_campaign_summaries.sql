-- Migration: Add campaign_summaries table for storing 12 months of data
-- This table will store monthly and weekly summaries for the last 12 months
-- Older data will be live-fetched from Meta API

-- Create campaign_summaries table
CREATE TABLE campaign_summaries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  summary_type TEXT CHECK (summary_type IN ('weekly', 'monthly')) NOT NULL,
  summary_date DATE NOT NULL, -- Start date of the period
  total_spend DECIMAL(12,2) DEFAULT 0 NOT NULL,
  total_impressions BIGINT DEFAULT 0 NOT NULL,
  total_clicks BIGINT DEFAULT 0 NOT NULL,
  total_conversions BIGINT DEFAULT 0 NOT NULL,
  average_ctr DECIMAL(5,2) DEFAULT 0 NOT NULL,
  average_cpc DECIMAL(8,2) DEFAULT 0 NOT NULL,
  average_cpa DECIMAL(8,2) DEFAULT 0 NOT NULL,
  active_campaigns INTEGER DEFAULT 0 NOT NULL,
  total_campaigns INTEGER DEFAULT 0 NOT NULL,
  campaign_data JSONB, -- Detailed campaign breakdown
  meta_tables JSONB, -- Placement, demographic, ad relevance data
  data_source TEXT DEFAULT 'meta_api',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure unique summaries per client, type, and date
  UNIQUE(client_id, summary_type, summary_date)
);

-- Create indexes for performance
CREATE INDEX idx_campaign_summaries_client_type_date ON campaign_summaries(client_id, summary_type, summary_date);
CREATE INDEX idx_campaign_summaries_last_updated ON campaign_summaries(last_updated);
CREATE INDEX idx_campaign_summaries_summary_date ON campaign_summaries(summary_date);

-- Add RLS policies for campaign_summaries
ALTER TABLE campaign_summaries ENABLE ROW LEVEL SECURITY;

-- Admins can view all campaign summaries
CREATE POLICY "Admins can view all campaign summaries" ON campaign_summaries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Admins can insert campaign summaries
CREATE POLICY "Admins can insert campaign summaries" ON campaign_summaries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Admins can update campaign summaries
CREATE POLICY "Admins can update campaign summaries" ON campaign_summaries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Admins can delete campaign summaries
CREATE POLICY "Admins can delete campaign summaries" ON campaign_summaries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Clients can view their own campaign summaries
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

-- Create function to automatically clean up old summaries (older than 12 months)
CREATE OR REPLACE FUNCTION cleanup_old_campaign_summaries()
RETURNS void AS $$
BEGIN
  -- Delete campaign summaries older than 12 months
  DELETE FROM campaign_summaries 
  WHERE summary_date < CURRENT_DATE - INTERVAL '12 months';
  
  RAISE NOTICE 'Cleaned up old campaign summaries older than 12 months';
END;
$$ LANGUAGE plpgsql;

-- Create function to get summary data with smart fallback
CREATE OR REPLACE FUNCTION get_campaign_summary(
  p_client_id UUID,
  p_summary_type TEXT,
  p_summary_date DATE
)
RETURNS TABLE (
  id UUID,
  client_id UUID,
  summary_type TEXT,
  summary_date DATE,
  total_spend DECIMAL(12,2),
  total_impressions BIGINT,
  total_clicks BIGINT,
  total_conversions BIGINT,
  average_ctr DECIMAL(5,2),
  average_cpc DECIMAL(8,2),
  average_cpa DECIMAL(8,2),
  active_campaigns INTEGER,
  total_campaigns INTEGER,
  campaign_data JSONB,
  meta_tables JSONB,
  data_source TEXT,
  last_updated TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cs.id,
    cs.client_id,
    cs.summary_type,
    cs.summary_date,
    cs.total_spend,
    cs.total_impressions,
    cs.total_clicks,
    cs.total_conversions,
    cs.average_ctr,
    cs.average_cpc,
    cs.average_cpa,
    cs.active_campaigns,
    cs.total_campaigns,
    cs.campaign_data,
    cs.meta_tables,
    cs.data_source,
    cs.last_updated,
    cs.created_at
  FROM campaign_summaries cs
  WHERE cs.client_id = p_client_id
    AND cs.summary_type = p_summary_type
    AND cs.summary_date = p_summary_date;
END;
$$ LANGUAGE plpgsql; 