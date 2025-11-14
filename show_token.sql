-- 🔑 Show the Actual Token Value
-- Run this to see the token you need to test

SELECT system_user_token 
FROM clients 
WHERE system_user_token IS NOT NULL 
LIMIT 1;


