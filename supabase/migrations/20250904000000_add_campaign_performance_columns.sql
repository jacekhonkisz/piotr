-- Migration: Add campaign performance columns to campaign_summaries table
-- These columns are needed for the "Wydajność kampanii" section in the dashboard

-- Add missing performance columns
ALTER TABLE campaign_summaries 
ADD COLUMN IF NOT EXISTS reach BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS offline_reservations BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS offline_value DECIMAL(12,2) DEFAULT 0;

-- Add comments to document the new columns
COMMENT ON COLUMN campaign_summaries.reach IS 'Total reach for the period';
COMMENT ON COLUMN campaign_summaries.offline_reservations IS 'Total offline reservations for the period (web_in_store_purchase)';
COMMENT ON COLUMN campaign_summaries.offline_value IS 'Total offline reservation value for the period';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_reach ON campaign_summaries(reach) WHERE reach > 0;
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_offline_reservations ON campaign_summaries(offline_reservations) WHERE offline_reservations > 0;
