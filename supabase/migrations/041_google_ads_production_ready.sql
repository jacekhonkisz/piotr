-- Production-ready Google Ads integration
-- Creates all necessary tables and ensures proper structure

-- 1. Create google_ads_tables_data table
CREATE TABLE IF NOT EXISTS google_ads_tables_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  
  -- Network performance (equivalent to Meta's placement performance)
  network_performance JSONB DEFAULT '[]'::jsonb,
  
  -- Demographic performance (exact equivalent)
  demographic_performance JSONB DEFAULT '[]'::jsonb,
  
  -- Quality score metrics (equivalent to Meta's ad relevance)
  quality_score_metrics JSONB DEFAULT '[]'::jsonb,
  
  -- Device performance
  device_performance JSONB DEFAULT '[]'::jsonb,
  
  -- Keyword performance (Google Ads specific)
  keyword_performance JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicates
  UNIQUE(client_id, date_range_start, date_range_end)
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_ads_tables_data_client_id ON google_ads_tables_data(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_tables_data_date_range ON google_ads_tables_data(date_range_start, date_range_end);
CREATE INDEX IF NOT EXISTS idx_google_ads_tables_data_created_at ON google_ads_tables_data(created_at);

-- 3. Enable RLS (Row Level Security)
ALTER TABLE google_ads_tables_data ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policy
CREATE POLICY "google_ads_tables_policy" ON google_ads_tables_data
FOR ALL USING (
  client_id IN (
    SELECT id FROM clients 
    WHERE email = auth.jwt() ->> 'email'
    OR auth.jwt() ->> 'email' = 'admin@example.com'
  )
);

-- 5. Grant permissions
GRANT ALL ON google_ads_tables_data TO authenticated;
GRANT ALL ON google_ads_tables_data TO service_role;
