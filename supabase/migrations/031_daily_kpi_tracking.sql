-- Add daily KPI tracking for carousel charts
-- This table will store day-by-day metrics for the past week + current month

CREATE TABLE daily_kpi_data (
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

-- Create indexes for performance
CREATE INDEX idx_daily_kpi_client_id ON daily_kpi_data(client_id);
CREATE INDEX idx_daily_kpi_date ON daily_kpi_data(date);
CREATE INDEX idx_daily_kpi_client_date ON daily_kpi_data(client_id, date);

-- Add updated_at trigger
CREATE TRIGGER update_daily_kpi_data_updated_at 
  BEFORE UPDATE ON daily_kpi_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies for daily_kpi_data
ALTER TABLE daily_kpi_data ENABLE ROW LEVEL SECURITY;

-- Admins can view daily KPI data for their clients
CREATE POLICY "Admins can view client daily KPI data" ON daily_kpi_data
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients 
      JOIN profiles ON profiles.id = clients.admin_id
      WHERE clients.id = daily_kpi_data.client_id 
      AND profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Clients can view their own daily KPI data
CREATE POLICY "Clients can view their own daily KPI data" ON daily_kpi_data
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clients 
      JOIN profiles ON profiles.email = clients.email
      WHERE clients.id = daily_kpi_data.client_id 
      AND profiles.id = auth.uid()
      AND profiles.role = 'client'
    )
  );

-- Admins can manage daily KPI data for their clients
CREATE POLICY "Admins can manage client daily KPI data" ON daily_kpi_data
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM clients 
      JOIN profiles ON profiles.id = clients.admin_id
      WHERE clients.id = daily_kpi_data.client_id 
      AND profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to clean up old daily KPI data (keep only current month + previous 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_daily_kpi_data()
RETURNS void AS $$
DECLARE
  cutoff_date DATE;
  current_month_start DATE;
BEGIN
  -- Calculate the start of current month
  current_month_start := DATE_TRUNC('month', CURRENT_DATE);
  
  -- Calculate cutoff date (7 days before current month start)
  cutoff_date := current_month_start - INTERVAL '7 days';
  
  -- Delete old records
  DELETE FROM daily_kpi_data 
  WHERE date < cutoff_date;
  
  -- Log cleanup
  RAISE NOTICE 'Cleaned up daily KPI data older than %', cutoff_date;
END;
$$ LANGUAGE plpgsql;

-- Function to upsert daily KPI data
CREATE OR REPLACE FUNCTION upsert_daily_kpi_data(
  p_client_id UUID,
  p_date DATE,
  p_clicks BIGINT,
  p_impressions BIGINT,
  p_spend DECIMAL,
  p_conversions BIGINT,
  p_click_to_call BIGINT DEFAULT 0,
  p_email_contacts BIGINT DEFAULT 0,
  p_booking_step_1 BIGINT DEFAULT 0,
  p_reservations BIGINT DEFAULT 0,
  p_reservation_value DECIMAL DEFAULT 0,
  p_booking_step_2 BIGINT DEFAULT 0,
  p_campaigns_count INTEGER DEFAULT 0,
  p_data_source TEXT DEFAULT 'api'
)
RETURNS UUID AS $$
DECLARE
  calculated_ctr DECIMAL(5,2);
  calculated_cpc DECIMAL(8,2);
  calculated_roas DECIMAL(8,2);
  calculated_cost_per_reservation DECIMAL(8,2);
  result_id UUID;
BEGIN
  -- Calculate derived metrics
  calculated_ctr := CASE 
    WHEN p_impressions > 0 THEN (p_clicks::DECIMAL / p_impressions::DECIMAL) * 100 
    ELSE 0 
  END;
  
  calculated_cpc := CASE 
    WHEN p_clicks > 0 THEN p_spend / p_clicks 
    ELSE 0 
  END;
  
  calculated_roas := CASE 
    WHEN p_spend > 0 THEN p_reservation_value / p_spend 
    ELSE 0 
  END;
  
  calculated_cost_per_reservation := CASE 
    WHEN p_reservations > 0 THEN p_spend / p_reservations 
    ELSE 0 
  END;
  
  -- Upsert the record
  INSERT INTO daily_kpi_data (
    client_id, date, total_clicks, total_impressions, total_spend, total_conversions,
    click_to_call, email_contacts, booking_step_1, reservations, reservation_value, booking_step_2,
    average_ctr, average_cpc, roas, cost_per_reservation, campaigns_count, data_source
  ) VALUES (
    p_client_id, p_date, p_clicks, p_impressions, p_spend, p_conversions,
    p_click_to_call, p_email_contacts, p_booking_step_1, p_reservations, p_reservation_value, p_booking_step_2,
    calculated_ctr, calculated_cpc, calculated_roas, calculated_cost_per_reservation, p_campaigns_count, p_data_source
  )
  ON CONFLICT (client_id, date) 
  DO UPDATE SET
    total_clicks = EXCLUDED.total_clicks,
    total_impressions = EXCLUDED.total_impressions,
    total_spend = EXCLUDED.total_spend,
    total_conversions = EXCLUDED.total_conversions,
    click_to_call = EXCLUDED.click_to_call,
    email_contacts = EXCLUDED.email_contacts,
    booking_step_1 = EXCLUDED.booking_step_1,
    reservations = EXCLUDED.reservations,
    reservation_value = EXCLUDED.reservation_value,
    booking_step_2 = EXCLUDED.booking_step_2,
    average_ctr = EXCLUDED.average_ctr,
    average_cpc = EXCLUDED.average_cpc,
    roas = EXCLUDED.roas,
    cost_per_reservation = EXCLUDED.cost_per_reservation,
    campaigns_count = EXCLUDED.campaigns_count,
    data_source = EXCLUDED.data_source,
    last_updated = NOW(),
    updated_at = NOW()
  RETURNING id INTO result_id;
  
  RETURN result_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get daily KPI data for carousel (current month + previous 7 days)
CREATE OR REPLACE FUNCTION get_daily_kpi_for_carousel(p_client_id UUID)
RETURNS TABLE (
  date DATE,
  total_clicks BIGINT,
  total_impressions BIGINT,
  total_spend DECIMAL,
  total_conversions BIGINT,
  click_to_call BIGINT,
  email_contacts BIGINT,
  reservations BIGINT,
  reservation_value DECIMAL,
  average_ctr DECIMAL,
  average_cpc DECIMAL,
  data_source TEXT,
  days_in_month INTEGER
) AS $$
DECLARE
  current_month_start DATE;
  previous_week_start DATE;
BEGIN
  -- Calculate date ranges
  current_month_start := DATE_TRUNC('month', CURRENT_DATE);
  previous_week_start := current_month_start - INTERVAL '7 days';
  
  RETURN QUERY
  SELECT 
    d.date,
    d.total_clicks,
    d.total_impressions,
    d.total_spend,
    d.total_conversions,
    d.click_to_call,
    d.email_contacts,
    d.reservations,
    d.reservation_value,
    d.average_ctr,
    d.average_cpc,
    d.data_source,
    EXTRACT(DAY FROM CURRENT_DATE)::INTEGER as days_in_month
  FROM daily_kpi_data d
  WHERE d.client_id = p_client_id
    AND d.date >= previous_week_start
    AND d.date <= CURRENT_DATE
  ORDER BY d.date ASC;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON daily_kpi_data TO anon, authenticated; 