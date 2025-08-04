-- Fix client admin_id mismatch for jac.honkisz@gmail.com
-- The client record has the wrong admin_id pointing to the admin user instead of the actual user

-- Update the client record to use the correct admin_id
UPDATE clients 
SET admin_id = '410483f9-cd02-432f-8e0b-7e8a8cd33a54'  -- jac.honkisz@gmail.com user ID
WHERE email = 'jac.honkisz@gmail.com' 
AND admin_id = '585b6abc-05ef-47aa-b289-e47a52ccdc6b';  -- admin user ID

-- Verify the fix
DO $$
BEGIN
  -- Check if the update was successful
  IF EXISTS (
    SELECT 1 FROM clients 
    WHERE email = 'jac.honkisz@gmail.com' 
    AND admin_id = '410483f9-cd02-432f-8e0b-7e8a8cd33a54'
  ) THEN
    RAISE NOTICE 'Client admin_id fixed successfully for jac.honkisz@gmail.com';
  ELSE
    RAISE NOTICE 'No client record found or update failed for jac.honkisz@gmail.com';
  END IF;
END $$; 