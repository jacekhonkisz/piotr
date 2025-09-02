-- Create google_ads_tables_data table for storing Google Ads performance tables
-- This table stores network performance, demographic performance, and quality metrics
-- Equivalent to Meta Ads placement performance, demographic performance, and ad relevance data

CREATE TABLE IF NOT EXISTS google_ads_tables_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  
  -- Network performance (equivalent to Meta's placement performance)
  -- Stores performance data by network (Search, Display, YouTube, etc.)
  network_performance JSONB DEFAULT '[]'::jsonb,
  
  -- Demographic performance (exact equivalent to Meta's demographic performance)
  -- Stores performance data by age groups, gender, etc.
  demographic_performance JSONB DEFAULT '[]'::jsonb,
  
  -- Quality score metrics (equivalent to Meta's ad relevance results)
  -- Stores quality score, expected CTR, ad relevance, landing page experience
  quality_score_metrics JSONB DEFAULT '[]'::jsonb,
  
  -- Device performance (equivalent to Meta's device performance)
  -- Stores performance data by device type (Mobile, Desktop, Tablet)
  device_performance JSONB DEFAULT '[]'::jsonb,
  
  -- Keyword performance (Google Ads specific)
  -- Stores performance data by keywords
  keyword_performance JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicates
  UNIQUE(client_id, date_range_start, date_range_end)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_google_ads_tables_data_client_id ON google_ads_tables_data(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_tables_data_date_range ON google_ads_tables_data(date_range_start, date_range_end);
CREATE INDEX IF NOT EXISTS idx_google_ads_tables_data_created_at ON google_ads_tables_data(created_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE google_ads_tables_data ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access data for clients they have access to
CREATE POLICY "Users can access google_ads_tables_data for their clients" ON google_ads_tables_data
  FOR ALL USING (
    client_id IN (
      SELECT id FROM clients 
      WHERE email = auth.jwt() ->> 'email'
      OR auth.jwt() ->> 'email' = 'admin@example.com'
    )
  );

-- Grant permissions
GRANT ALL ON google_ads_tables_data TO authenticated;
GRANT ALL ON google_ads_tables_data TO service_role;
