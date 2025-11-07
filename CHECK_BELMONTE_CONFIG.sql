-- Check Belmonte's Google Ads configuration

SELECT 
  id,
  name,
  email,
  google_ads_enabled,
  google_ads_customer_id,
  CASE 
    WHEN meta_access_token IS NOT NULL THEN '✅ Has Meta token'
    ELSE '❌ No Meta token'
  END as meta_status,
  CASE 
    WHEN google_ads_customer_id IS NOT NULL THEN '✅ Has Customer ID'
    ELSE '❌ Missing Customer ID'
  END as google_ads_status
FROM clients
WHERE id = 'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa';

-- This is critical: If google_ads_customer_id is NULL,
-- the background collector will skip Google Ads collection!

