-- Add missing active_campaign_count column to campaign_summaries
-- This column is required for storing Google Ads monthly data

-- Add the column
ALTER TABLE campaign_summaries
ADD COLUMN IF NOT EXISTS active_campaign_count INTEGER DEFAULT 0;

-- Update description
COMMENT ON COLUMN campaign_summaries.active_campaign_count IS 'Number of active campaigns (status = ENABLED for Google, ACTIVE for Meta)';

-- Verification
SELECT 
  '✅ COLUMN ADDED' as status,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'campaign_summaries'
  AND column_name = 'active_campaign_count';

-- Check if column exists now
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ Column exists and ready'
    ELSE '❌ Column not found'
  END as verification
FROM information_schema.columns
WHERE table_name = 'campaign_summaries'
  AND column_name = 'active_campaign_count';




