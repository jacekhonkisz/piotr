-- Add platform column to campaign_summaries table
-- This allows us to distinguish between Meta and Google Ads data

ALTER TABLE campaign_summaries 
ADD COLUMN IF NOT EXISTS platform VARCHAR(20) DEFAULT 'meta';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_platform 
ON campaign_summaries(client_id, platform, summary_date);

-- Update existing records to have platform='meta' (for backward compatibility)
UPDATE campaign_summaries 
SET platform = 'meta' 
WHERE platform IS NULL;
