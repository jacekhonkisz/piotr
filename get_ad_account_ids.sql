-- Get all ad account IDs for testing
SELECT 
  name,
  REPLACE(ad_account_id, 'act_', '') as clean_ad_account_id,
  ad_account_id as full_ad_account_id
FROM clients
WHERE ad_account_id IS NOT NULL
ORDER BY name;

