-- Check the actual UNIQUE constraint on campaign_summaries
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'campaign_summaries'::regclass
  AND contype = 'u';





