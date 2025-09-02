-- Add daily KPI tracking for carousel charts (Fixed version)
-- This table will store day-by-day metrics for the past week + current month

CREATE TABLE IF NOT EXISTS daily_kpi_data (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  
  -- KPI metrics for the day
  total_clicks BIGINT DEFAULT 0 NOT NULL,
  total_impressions BIGINT DEFAULT 0 NOT NULL,
  total_spend DECIMAL(12,2) DEFAULT 0 NOT NULL,
  total_conversions BIGINT DEFAULT 0 NOT NULL,
  
  -- Conversion metrics
  click_to_call BIGINT DEFAULT 0 NOT NULL,
  email_contacts BIGINT DEFAULT 0 NOT NULL,
  booking_step_1 BIGINT DEFAULT 0 NOT NULL,
  reservations BIGINT DEFAULT 0 NOT NULL,
  reservation_value DECIMAL(12,2) DEFAULT 0 NOT NULL,
  booking_step_2 BIGINT DEFAULT 0 NOT NULL,
  
  -- Calculated metrics
  average_ctr DECIMAL(5,2) DEFAULT 0 NOT NULL,
  average_cpc DECIMAL(8,2) DEFAULT 0 NOT NULL,
  roas DECIMAL(8,2) DEFAULT 0 NOT NULL,
  cost_per_reservation DECIMAL(8,2) DEFAULT 0 NOT NULL,
  
  -- Metadata
  data_source TEXT DEFAULT 'api' NOT NULL, -- 'api', 'cache', 'calculated'
  campaigns_count INTEGER DEFAULT 0 NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Ensure one record per client per day
  UNIQUE(client_id, date)
);

-- Create indexes for performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_daily_kpi_client_id ON daily_kpi_data(client_id);
CREATE INDEX IF NOT EXISTS idx_daily_kpi_date ON daily_kpi_data(date);
CREATE INDEX IF NOT EXISTS idx_daily_kpi_client_date ON daily_kpi_data(client_id, date);

-- Add updated_at trigger (only if the function exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_daily_kpi_data_updated_at ON daily_kpi_data;
    CREATE TRIGGER update_daily_kpi_data_updated_at 
      BEFORE UPDATE ON daily_kpi_data
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- RLS Policies for daily_kpi_data (only if table was created)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_kpi_data') THEN
    ALTER TABLE daily_kpi_data ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Admins can view client daily KPI data" ON daily_kpi_data;
    DROP POLICY IF EXISTS "Admins can insert client daily KPI data" ON daily_kpi_data;
    DROP POLICY IF EXISTS "Admins can update client daily KPI data" ON daily_kpi_data;
    DROP POLICY IF EXISTS "Admins can delete client daily KPI data" ON daily_kpi_data;
    
    -- Create policies
    CREATE POLICY "Admins can view client daily KPI data" ON daily_kpi_data
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM clients 
          WHERE clients.id = daily_kpi_data.client_id 
          AND clients.admin_id = auth.uid()
        )
      );

    CREATE POLICY "Admins can insert client daily KPI data" ON daily_kpi_data
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM clients 
          WHERE clients.id = daily_kpi_data.client_id 
          AND clients.admin_id = auth.uid()
        )
      );

    CREATE POLICY "Admins can update client daily KPI data" ON daily_kpi_data
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM clients 
          WHERE clients.id = daily_kpi_data.client_id 
          AND clients.admin_id = auth.uid()
        )
      );

    CREATE POLICY "Admins can delete client daily KPI data" ON daily_kpi_data
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM clients 
          WHERE clients.id = daily_kpi_data.client_id 
          AND clients.admin_id = auth.uid()
        )
      );
  END IF;
END $$; 