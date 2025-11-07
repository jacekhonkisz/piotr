-- FIX: Add platform to the unique constraint

-- 1. Check current constraints
SELECT
  '1️⃣ CURRENT CONSTRAINTS' as check,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'campaign_summaries'::regclass
  AND contype = 'u'; -- unique constraints

-- 2. Drop old constraint (without platform)
ALTER TABLE campaign_summaries
DROP CONSTRAINT IF EXISTS campaign_summaries_client_id_summary_type_summary_date_key;

-- 3. Add new constraint (with platform)
ALTER TABLE campaign_summaries
ADD CONSTRAINT campaign_summaries_client_id_summary_type_summary_date_platform_key 
UNIQUE (client_id, summary_type, summary_date, platform);

-- 4. Verify new constraint
SELECT
  '2️⃣ NEW CONSTRAINT' as check,
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'campaign_summaries'::regclass
  AND contype = 'u'; -- unique constraints

-- 5. Test: Check if we have both Meta and Google data for the same month
SELECT 
  '3️⃣ MONTHS WITH BOTH PLATFORMS' as check,
  TO_CHAR(summary_date, 'YYYY-MM') as month,
  summary_type,
  ARRAY_AGG(DISTINCT platform) as platforms,
  COUNT(*) as total_records
FROM campaign_summaries
WHERE client_id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'
GROUP BY TO_CHAR(summary_date, 'YYYY-MM'), summary_type
HAVING COUNT(DISTINCT platform) > 1
ORDER BY month DESC;

