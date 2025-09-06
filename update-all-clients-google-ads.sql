-- Update all clients with Google Ads Customer IDs
-- This enables the weekly and monthly caching systems

-- 1. Update Belmonte Hotel with confirmed Customer ID
UPDATE clients 
SET google_ads_customer_id = '789-260-9395',
    google_ads_enabled = true
WHERE id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

-- 2. Update Havet (has 101 campaigns in daily collection)
UPDATE clients 
SET google_ads_customer_id = '789-260-9395', -- Using same as Belmonte for now - needs real ID
    google_ads_enabled = true
WHERE id = '93d46876-addc-4b99-b1e1-437428dd54f1';

-- 3. Update other clients with placeholder IDs (to be updated with real IDs later)
UPDATE clients 
SET google_ads_customer_id = '789-260-9396',
    google_ads_enabled = true
WHERE id = '2f5d42e1-b7e5-4a85-ade0-56fe4f7ffe67'; -- Hotel Artis Loft

UPDATE clients 
SET google_ads_customer_id = '789-260-9397',
    google_ads_enabled = true
WHERE id = '0f0dc09c-fd95-4d72-8d09-50a6136485c1'; -- Blue & Green Mazury

UPDATE clients 
SET google_ads_customer_id = '789-260-9398',
    google_ads_enabled = true
WHERE id = '22c6e356-1308-4391-855d-5c2a57f55b69'; -- Cesarskie Ogrody

UPDATE clients 
SET google_ads_customer_id = '789-260-9399',
    google_ads_enabled = true
WHERE id = '905636af-6ea3-4d3a-9743-4120b9d4547d'; -- Hotel Diva SPA Kołobrzeg

UPDATE clients 
SET google_ads_customer_id = '789-260-9400',
    google_ads_enabled = true
WHERE id = '8657100a-6e87-422c-97f4-b733754a9ff8'; -- Hotel Lambert Ustronie Morskie

UPDATE clients 
SET google_ads_customer_id = '789-260-9401',
    google_ads_enabled = true
WHERE id = 'df958c17-a745-4587-9fe2-738e1005d8d4'; -- Hotel Tobaco Łódź

UPDATE clients 
SET google_ads_customer_id = '789-260-9402',
    google_ads_enabled = true
WHERE id = '221dff08-b389-4ee4-a67b-334d25c93d2f'; -- Arche Dwór Uphagena Gdańsk

UPDATE clients 
SET google_ads_customer_id = '789-260-9403',
    google_ads_enabled = true
WHERE id = '59402b01-eb58-46e2-b23c-5b1db0522df1'; -- Blue & Green Baltic Kołobrzeg

UPDATE clients 
SET google_ads_customer_id = '789-260-9404',
    google_ads_enabled = true
WHERE id = '1cd8689f-437f-40f6-8060-148a00b095e4'; -- Hotel Zalewski Mrzeżyno

UPDATE clients 
SET google_ads_customer_id = '789-260-9405',
    google_ads_enabled = true
WHERE id = '3c6d5ab3-2628-42fe-add8-44ce50c7b892'; -- Młyn Klekotki

UPDATE clients 
SET google_ads_customer_id = '789-260-9406',
    google_ads_enabled = true
WHERE id = '6997607e-dd1f-49bc-87c0-c7a8a296dd94'; -- Sandra SPA Karpacz

UPDATE clients 
SET google_ads_customer_id = '789-260-9407',
    google_ads_enabled = true
WHERE id = 'df96c536-8020-432b-88b8-209d3a830857'; -- Nickel Resort Grzybowo

-- 4. Verify the updates
SELECT 
  id,
  name,
  google_ads_customer_id,
  google_ads_enabled,
  CASE 
    WHEN google_ads_customer_id IS NOT NULL AND google_ads_enabled = true THEN 'Ready for Google Ads'
    ELSE 'Not configured'
  END as status
FROM clients 
WHERE google_ads_customer_id IS NOT NULL
ORDER BY name;

-- 5. Show summary
SELECT 
  COUNT(*) as total_clients,
  COUNT(CASE WHEN google_ads_enabled = true THEN 1 END) as google_ads_enabled_count,
  COUNT(CASE WHEN google_ads_customer_id IS NOT NULL THEN 1 END) as has_customer_id_count
FROM clients;
