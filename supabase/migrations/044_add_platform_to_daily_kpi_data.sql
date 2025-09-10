-- Add platform column to daily_kpi_data table
-- This allows us to distinguish between Meta and Google Ads data

ALTER TABLE daily_kpi_data 
ADD COLUMN IF NOT EXISTS platform VARCHAR(20) DEFAULT 'meta';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_daily_kpi_data_platform 
ON daily_kpi_data(client_id, platform, date);

-- Update existing records to have correct platform based on data_source
UPDATE daily_kpi_data
SET platform = 'meta'
WHERE data_source LIKE '%meta%' OR data_source = 'meta_api';

UPDATE daily_kpi_data
SET platform = 'google'
WHERE data_source = 'google_ads_api';

-- Add comment for clarity
COMMENT ON COLUMN daily_kpi_data.platform IS 'Platform source: meta or google';
