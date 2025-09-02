-- Production-ready Google Ads tables creation
-- This creates all necessary tables for Google Ads integration

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

-- 6. Verify google_ads_campaign_summaries has all required columns
DO $$ 
BEGIN
  -- Add google_ads_tables column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'google_ads_campaign_summaries' 
                 AND column_name = 'google_ads_tables') THEN
    ALTER TABLE google_ads_campaign_summaries 
    ADD COLUMN google_ads_tables JSONB DEFAULT '{}'::jsonb;
  END IF;
  
  -- Add conversion metrics columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'google_ads_campaign_summaries' 
                 AND column_name = 'click_to_call') THEN
    ALTER TABLE google_ads_campaign_summaries 
    ADD COLUMN click_to_call INTEGER DEFAULT 0,
    ADD COLUMN email_contacts INTEGER DEFAULT 0,
    ADD COLUMN booking_step_1 INTEGER DEFAULT 0,
    ADD COLUMN booking_step_2 INTEGER DEFAULT 0,
    ADD COLUMN booking_step_3 INTEGER DEFAULT 0,
    ADD COLUMN reservations INTEGER DEFAULT 0,
    ADD COLUMN reservation_value DECIMAL(10,2) DEFAULT 0.00,
    ADD COLUMN roas DECIMAL(10,4) DEFAULT 0.0000,
    ADD COLUMN cost_per_reservation DECIMAL(10,2) DEFAULT 0.00;
  END IF;
END $$;
