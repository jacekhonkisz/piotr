-- Get ad account ID for a client that's showing as FAILED
SELECT 
  name,
  ad_account_id,
  REPLACE(ad_account_id, 'act_', '') as clean_id
FROM clients
WHERE name IN ('Hotel Lambert Ustronie Morskie', 'Apartamenty Lambert', 'jacek')
ORDER BY name
LIMIT 3;


