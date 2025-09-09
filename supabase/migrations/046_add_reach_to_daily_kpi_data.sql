-- Add reach column to daily_kpi_data table
-- This field is needed for conversion funnel display and is referenced in StandardizedDataFetcher

-- Add reach column to daily_kpi_data table
ALTER TABLE daily_kpi_data 
ADD COLUMN IF NOT EXISTS reach BIGINT DEFAULT 0;

-- Add comment to document the reach column
COMMENT ON COLUMN daily_kpi_data.reach IS 'Total reach for the day (unique users who saw ads)';

-- Create index for performance (optional, only if reach queries are frequent)
CREATE INDEX IF NOT EXISTS idx_daily_kpi_data_reach ON daily_kpi_data(reach) WHERE reach > 0;

-- Update existing records to have reach = 0 (they will be updated by future data collection)
UPDATE daily_kpi_data SET reach = 0 WHERE reach IS NULL;
