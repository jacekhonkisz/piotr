-- Fix API status for Google Ads clients
-- The caching system requires api_status = 'valid' in addition to google_ads_customer_id

-- Update all clients that should have Google Ads enabled
-- Set api_status = 'valid' so they are picked up by the caching system

UPDATE clients 
SET api_status = 'valid'
WHERE id IN (
  'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa', -- Belmonte Hotel
  '93d46876-addc-4b99-b1e1-437428dd54f1', -- Havet
  '2f5d42e1-b7e5-4a85-ade0-56fe4f7ffe67', -- Hotel Artis Loft
  '0f0dc09c-fd95-4d72-8d09-50a6136485c1', -- Blue & Green Mazury
  '22c6e356-1308-4391-855d-5c2a57f55b69', -- Cesarskie Ogrody
  '905636af-6ea3-4d3a-9743-4120b9d4547d', -- Hotel Diva SPA Kołobrzeg
  '8657100a-6e87-422c-97f4-b733754a9ff8', -- Hotel Lambert Ustronie Morskie
  'df958c17-a745-4587-9fe2-738e1005d8d4', -- Hotel Tobaco Łódź
  '221dff08-b389-4ee4-a67b-334d25c93d2f', -- Arche Dwór Uphagena Gdańsk
  '59402b01-eb58-46e2-b23c-5b1db0522df1', -- Blue & Green Baltic Kołobrzeg
  '1cd8689f-437f-40f6-8060-148a00b095e4', -- Hotel Zalewski Mrzeżyno
  '3c6d5ab3-2628-42fe-add8-44ce50c7b892', -- Młyn Klekotki
  '6997607e-dd1f-49bc-87c0-c7a8a296dd94', -- Sandra SPA Karpacz
  'df96c536-8020-432b-88b8-209d3a830857'  -- Nickel Resort Grzybowo
);

-- Verify the fix - check clients that should now be picked up by caching system
SELECT 
  id,
  name,
  google_ads_customer_id,
  google_ads_enabled,
  api_status,
  CASE 
    WHEN google_ads_customer_id IS NOT NULL AND api_status = 'valid' THEN '✅ Ready for caching'
    WHEN google_ads_customer_id IS NOT NULL AND api_status != 'valid' THEN '⚠️ Has Customer ID but api_status not valid'
    WHEN google_ads_customer_id IS NULL THEN '❌ Missing Customer ID'
    ELSE '❓ Unknown status'
  END as cache_ready_status
FROM clients 
WHERE id IN (
  'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa', -- Belmonte Hotel
  '93d46876-addc-4b99-b1e1-437428dd54f1', -- Havet
  '2f5d42e1-b7e5-4a85-ade0-56fe4f7ffe67', -- Hotel Artis Loft
  '0f0dc09c-fd95-4d72-8d09-50a6136485c1', -- Blue & Green Mazury
  '22c6e356-1308-4391-855d-5c2a57f55b69', -- Cesarskie Ogrody
  '905636af-6ea3-4d3a-9743-4120b9d4547d', -- Hotel Diva SPA Kołobrzeg
  '8657100a-6e87-422c-97f4-b733754a9ff8', -- Hotel Lambert Ustronie Morskie
  'df958c17-a745-4587-9fe2-738e1005d8d4', -- Hotel Tobaco Łódź
  '221dff08-b389-4ee4-a67b-334d25c93d2f', -- Arche Dwór Uphagena Gdańsk
  '59402b01-eb58-46e2-b23c-5b1db0522df1', -- Blue & Green Baltic Kołobrzeg
  '1cd8689f-437f-40f6-8060-148a00b095e4', -- Hotel Zalewski Mrzeżyno
  '3c6d5ab3-2628-42fe-add8-44ce50c7b892', -- Młyn Klekotki
  '6997607e-dd1f-49bc-87c0-c7a8a296dd94', -- Sandra SPA Karpacz
  'df96c536-8020-432b-88b8-209d3a830857'  -- Nickel Resort Grzybowo
)
ORDER BY name;

-- Show summary of Google Ads ready clients
SELECT 
  COUNT(*) as total_google_ads_clients,
  COUNT(CASE WHEN google_ads_customer_id IS NOT NULL AND api_status = 'valid' THEN 1 END) as cache_ready_clients,
  COUNT(CASE WHEN google_ads_customer_id IS NOT NULL AND api_status != 'valid' THEN 1 END) as needs_api_status_fix,
  COUNT(CASE WHEN google_ads_customer_id IS NULL THEN 1 END) as missing_customer_id
FROM clients 
WHERE google_ads_enabled = true OR google_ads_customer_id IS NOT NULL;
