-- Get one ad account ID for testing
SELECT 
  name,
  ad_account_id,
  REPLACE(ad_account_id, 'act_', '') as clean_id
FROM clients
WHERE name ILIKE '%belmonte%'
LIMIT 1;







