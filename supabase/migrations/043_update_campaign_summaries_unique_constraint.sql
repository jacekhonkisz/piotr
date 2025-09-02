-- Update campaign_summaries unique constraint to include platform
-- This allows separate records for Meta and Google Ads data

-- Drop the existing unique constraint
ALTER TABLE campaign_summaries 
DROP CONSTRAINT IF EXISTS campaign_summaries_client_id_summary_type_summary_date_key;

-- Add new unique constraint that includes platform
ALTER TABLE campaign_summaries 
ADD CONSTRAINT campaign_summaries_unique_per_platform 
UNIQUE (client_id, summary_type, summary_date, platform);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_platform_lookup 
ON campaign_summaries(client_id, platform, summary_type, summary_date);
