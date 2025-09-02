-- Complete Google Ads Setup for Unified PDF Generation (SAFE VERSION)
-- Run this entire script in Supabase SQL Editor
-- This version avoids destructive operations and warnings

-- Step 1: Create google_ads_campaigns table (safe - only creates if doesn't exist)
CREATE TABLE IF NOT EXISTS google_ads_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  campaign_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  status TEXT NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  spend DECIMAL(12,2) DEFAULT 0 NOT NULL,
  impressions BIGINT DEFAULT 0 NOT NULL,
  clicks BIGINT DEFAULT 0 NOT NULL,
  cpc DECIMAL(8,2) DEFAULT 0 NOT NULL,
  ctr DECIMAL(5,2) DEFAULT 0 NOT NULL,
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
  demographics JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(client_id, campaign_id, date_range_start, date_range_end)
);

-- Step 2: Create google_ads_campaign_summaries table for smart caching (safe)
CREATE TABLE IF NOT EXISTS google_ads_campaign_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'custom')),
  total_spend DECIMAL(12,2) DEFAULT 0 NOT NULL,
  total_impressions BIGINT DEFAULT 0 NOT NULL,
  total_clicks BIGINT DEFAULT 0 NOT NULL,
  total_conversions BIGINT DEFAULT 0 NOT NULL,
  average_ctr DECIMAL(5,2) DEFAULT 0 NOT NULL,
  average_cpc DECIMAL(8,2) DEFAULT 0 NOT NULL,
  average_cpm DECIMAL(8,2) DEFAULT 0 NOT NULL,
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
  campaign_count INTEGER DEFAULT 0 NOT NULL,
  data_source TEXT DEFAULT 'google_ads_api' NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(client_id, period_start, period_end, period_type)
);

-- Step 3: Create indexes for performance (safe - only creates if doesn't exist)
CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_client_id ON google_ads_campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_date_range ON google_ads_campaigns(date_range_start, date_range_end);
CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_client_date ON google_ads_campaigns(client_id, date_range_start, date_range_end);

CREATE INDEX IF NOT EXISTS idx_google_ads_summaries_client_id ON google_ads_campaign_summaries(client_id);
CREATE INDEX IF NOT EXISTS idx_google_ads_summaries_period ON google_ads_campaign_summaries(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_google_ads_summaries_client_period ON google_ads_campaign_summaries(client_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_google_ads_summaries_period_type ON google_ads_campaign_summaries(period_type);
CREATE INDEX IF NOT EXISTS idx_google_ads_summaries_last_updated ON google_ads_campaign_summaries(last_updated);

-- Step 4: Enable RLS (safe - only enables if not already enabled)
ALTER TABLE google_ads_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_ads_campaign_summaries ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies safely (check if they exist first)
DO $$
BEGIN
  -- Create policies only if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'google_ads_campaigns' 
    AND policyname = 'Service role can manage Google Ads campaigns'
  ) THEN
    CREATE POLICY "Service role can manage Google Ads campaigns" ON google_ads_campaigns
      FOR ALL USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'google_ads_campaigns' 
    AND policyname = 'Admins can view client Google Ads campaigns'
  ) THEN
    CREATE POLICY "Admins can view client Google Ads campaigns" ON google_ads_campaigns
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM clients 
          WHERE clients.id = google_ads_campaigns.client_id 
          AND clients.admin_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'google_ads_campaigns' 
    AND policyname = 'Admins can insert client Google Ads campaigns'
  ) THEN
    CREATE POLICY "Admins can insert client Google Ads campaigns" ON google_ads_campaigns
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM clients 
          WHERE clients.id = google_ads_campaigns.client_id 
          AND clients.admin_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'google_ads_campaigns' 
    AND policyname = 'Admins can update client Google Ads campaigns'
  ) THEN
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

-- Step 6: Create RLS policies for google_ads_campaign_summaries safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'google_ads_campaign_summaries' 
    AND policyname = 'Service role can manage Google Ads summaries'
  ) THEN
    CREATE POLICY "Service role can manage Google Ads summaries" ON google_ads_campaign_summaries
      FOR ALL USING (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'google_ads_campaign_summaries' 
    AND policyname = 'Admins can view client Google Ads summaries'
  ) THEN
    CREATE POLICY "Admins can view client Google Ads summaries" ON google_ads_campaign_summaries
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM clients 
          WHERE clients.id = google_ads_campaign_summaries.client_id 
          AND clients.admin_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'google_ads_campaign_summaries' 
    AND policyname = 'Admins can insert client Google Ads summaries'
  ) THEN
    CREATE POLICY "Admins can insert client Google Ads summaries" ON google_ads_campaign_summaries
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM clients 
          WHERE clients.id = google_ads_campaign_summaries.client_id 
          AND clients.admin_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Step 7: Add table comments (safe)
COMMENT ON TABLE google_ads_campaigns IS 'Stores Google Ads campaign data for unified reporting with Meta Ads';
COMMENT ON TABLE google_ads_campaign_summaries IS 'Stores aggregated Google Ads campaign data for smart caching (current month/week)';

-- Step 8: Enable Google Ads for Belmonte Hotel client (safe - only updates if not already set)
-- We'll check first and only update if needed
DO $$
BEGIN
  -- Only update if Google Ads is not already enabled
  IF NOT EXISTS (
    SELECT 1 FROM clients 
    WHERE name ILIKE '%belmonte%' 
    AND google_ads_enabled = true
  ) THEN
    UPDATE clients 
    SET 
      google_ads_enabled = true,
      google_ads_customer_id = COALESCE(google_ads_customer_id, '123-456-7890'),
      google_ads_refresh_token = COALESCE(google_ads_refresh_token, 'sample_refresh_token_for_testing')
    WHERE name ILIKE '%belmonte%';
  END IF;
END $$;

-- Step 9: Insert sample Google Ads data for August 2025 (safe - only inserts if doesn't exist)
-- We'll use INSERT ... ON CONFLICT DO NOTHING to avoid any data modification warnings
INSERT INTO google_ads_campaigns (
  client_id, campaign_id, campaign_name, status, date_range_start, date_range_end,
  spend, impressions, clicks, cpc, ctr,
  form_submissions, phone_calls, email_clicks, phone_clicks,
  booking_step_1, booking_step_2, booking_step_3,
  reservations, reservation_value, roas
) 
SELECT 
  c.id,
  'google_camp_001',
  'Belmonte Hotel - Search Ads',
  'ENABLED',
  '2025-08-01',
  '2025-08-31',
  8500.00,
  125000,
  3200,
  2.66,
  2.56,
  45,
  28,
  12,
  35,
  85,
  62,
  48,
  42,
  25200.00,
  2.96
FROM clients c 
WHERE c.name ILIKE '%belmonte%'
ON CONFLICT (client_id, campaign_id, date_range_start, date_range_end) DO NOTHING;

INSERT INTO google_ads_campaigns (
  client_id, campaign_id, campaign_name, status, date_range_start, date_range_end,
  spend, impressions, clicks, cpc, ctr,
  form_submissions, phone_calls, email_clicks, phone_clicks,
  booking_step_1, booking_step_2, booking_step_3,
  reservations, reservation_value, roas
) 
SELECT 
  c.id,
  'google_camp_002',
  'Belmonte Hotel - Display Network',
  'ENABLED',
  '2025-08-01',
  '2025-08-31',
  4200.00,
  89000,
  1800,
  2.33,
  2.02,
  22,
  15,
  8,
  18,
  45,
  32,
  25,
  22,
  13200.00,
  3.14
FROM clients c 
WHERE c.name ILIKE '%belmonte%'
ON CONFLICT (client_id, campaign_id, date_range_start, date_range_end) DO NOTHING;

INSERT INTO google_ads_campaigns (
  client_id, campaign_id, campaign_name, status, date_range_start, date_range_end,
  spend, impressions, clicks, cpc, ctr,
  form_submissions, phone_calls, email_clicks, phone_clicks,
  booking_step_1, booking_step_2, booking_step_3,
  reservations, reservation_value, roas
) 
SELECT 
  c.id,
  'google_camp_003',
  'Belmonte Hotel - YouTube Ads',
  'ENABLED',
  '2025-08-01',
  '2025-08-31',
  3100.00,
  156000,
  2400,
  1.29,
  1.54,
  18,
  12,
  5,
  15,
  38,
  28,
  20,
  18,
  10800.00,
  3.48
FROM clients c 
WHERE c.name ILIKE '%belmonte%'
ON CONFLICT (client_id, campaign_id, date_range_start, date_range_end) DO NOTHING;

-- Step 10: Create a summary record for August 2025 (safe - only inserts if doesn't exist)
INSERT INTO google_ads_campaign_summaries (
  client_id, period_start, period_end, period_type,
  total_spend, total_impressions, total_clicks, total_conversions,
  average_ctr, average_cpc, average_cpm,
  total_form_submissions, total_phone_calls, total_email_clicks, total_phone_clicks,
  total_booking_step_1, total_booking_step_2, total_booking_step_3,
  total_reservations, total_reservation_value, average_roas,
  campaign_count, data_source
)
SELECT 
  c.id,
  '2025-08-01',
  '2025-08-31',
  'monthly',
  15800.00, -- Total spend
  370000,   -- Total impressions
  7400,     -- Total clicks
  82,       -- Total conversions (reservations)
  2.00,     -- Average CTR
  2.14,     -- Average CPC
  42.70,    -- Average CPM
  85,       -- Total form submissions
  55,       -- Total phone calls
  25,       -- Total email clicks
  68,       -- Total phone clicks
  168,      -- Total booking step 1
  122,      -- Total booking step 2
  93,       -- Total booking step 3
  82,       -- Total reservations
  49200.00, -- Total reservation value
  3.11,     -- Average ROAS
  3,        -- Campaign count
  'google_ads_api'
FROM clients c 
WHERE c.name ILIKE '%belmonte%'
ON CONFLICT (client_id, period_start, period_end, period_type) DO NOTHING;

-- Verification: Check if data was inserted correctly (read-only, safe)
SELECT 
  'Google Ads Campaigns' as table_name,
  COUNT(*) as record_count,
  SUM(spend) as total_spend,
  SUM(reservations) as total_reservations
FROM google_ads_campaigns gac
JOIN clients c ON c.id = gac.client_id
WHERE c.name ILIKE '%belmonte%'

UNION ALL

SELECT 
  'Google Ads Summaries' as table_name,
  COUNT(*) as record_count,
  SUM(total_spend) as total_spend,
  SUM(total_reservations) as total_reservations
FROM google_ads_campaign_summaries gacs
JOIN clients c ON c.id = gacs.client_id
WHERE c.name ILIKE '%belmonte%';

-- Final message
SELECT 'Google Ads setup complete! You can now test unified PDF generation.' as status;
