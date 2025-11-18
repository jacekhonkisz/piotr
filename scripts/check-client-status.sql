-- Check Belmonte Hotel's status
SELECT 
  id,
  name,
  status,
  created_at
FROM clients
WHERE name LIKE '%Belmonte%'
   OR id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

-- Check all clients and their statuses
SELECT 
  name,
  status,
  COUNT(*) as count
FROM clients
GROUP BY name, status
ORDER BY name;
