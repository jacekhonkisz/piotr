-- ============================================================================
-- CHECK RLS POLICIES ON campaign_summaries
-- ============================================================================
-- This checks if Row Level Security is blocking data access
-- ============================================================================

-- 1. Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'campaign_summaries';

-- 2. List all RLS policies on campaign_summaries
SELECT 
  schemaname,
  tablename,
  policyname as policy_name,
  permissive,
  roles,
  cmd as command_type,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'campaign_summaries'
ORDER BY policyname;

-- 3. Test: Can anon role read Belmonte data?
-- This simulates what the app does with anon key
SET ROLE anon;

SELECT 
  'As ANON role' as test,
  COUNT(*) as visible_records
FROM campaign_summaries
WHERE client_id = (SELECT id FROM clients WHERE email = 'belmonte@hotel.com' LIMIT 1);

RESET ROLE;

-- 4. Test: Can authenticated role read Belmonte data?
-- (Note: This requires actually being authenticated, so it might fail)
-- SET ROLE authenticated;
-- SELECT COUNT(*) FROM campaign_summaries
-- WHERE client_id = (SELECT id FROM clients WHERE email = 'belmonte@hotel.com' LIMIT 1);
-- RESET ROLE;

-- 5. Check what policies exist for SELECT operations
SELECT 
  policyname,
  'SELECT' as operation,
  roles,
  CASE 
    WHEN qual LIKE '%admin%' THEN '👨‍💼 Admin only'
    WHEN qual LIKE '%client_id%' THEN '🔒 Client-specific'
    WHEN qual LIKE '%auth.uid%' THEN '🔐 Authenticated users'
    ELSE '❓ Other condition'
  END as policy_type,
  qual as policy_condition
FROM pg_policies
WHERE tablename = 'campaign_summaries'
  AND cmd = 'SELECT'
ORDER BY policyname;








