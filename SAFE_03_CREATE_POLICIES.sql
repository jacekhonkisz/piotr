-- ============================================================================
-- SAFE DATABASE FIX - PART 3: CREATE RLS POLICIES
-- ============================================================================
-- Purpose: Enable Row Level Security and create access policies
-- Safety: SAFE - Only creates NEW policies, never drops existing ones
-- Duration: ~2-5 seconds
-- Can be run: Anytime, even during business hours
-- Idempotent: Yes, safe to run multiple times
-- Dependencies: SAFE_01 and SAFE_02 must be run first
-- ============================================================================

-- Note: This script uses "CREATE POLICY IF NOT EXISTS" pattern
-- It will skip any policies that already exist
-- It will NEVER drop or modify existing policies

-- ============================================================================
-- PRE-FLIGHT CHECK
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '🔍 Database: %', current_database();
  RAISE NOTICE '⏰ Timestamp: %', NOW();
  RAISE NOTICE '📝 Script: SAFE_03_CREATE_POLICIES.sql';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  This script will:';
  RAISE NOTICE '   ✅ Enable RLS on tables (if not already enabled)';
  RAISE NOTICE '   ✅ Create missing policies only';
  RAISE NOTICE '   ❌ NEVER drop existing policies';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- 1. ENABLE RLS ON ALL TABLES
-- ============================================================================
-- Safe operation: Enabling RLS multiple times has no effect if already enabled

DO $$
BEGIN
  RAISE NOTICE '🔒 Enabling Row Level Security...';
  
  -- Enable RLS (idempotent - safe if already enabled)
  ALTER TABLE campaign_summaries ENABLE ROW LEVEL SECURITY;
  ALTER TABLE current_month_cache ENABLE ROW LEVEL SECURITY;
  ALTER TABLE current_week_cache ENABLE ROW LEVEL SECURITY;
  ALTER TABLE daily_kpi_data ENABLE ROW LEVEL SECURITY;
  
  RAISE NOTICE '✅ RLS enabled on all tables';
END $$;

-- ============================================================================
-- 2. CREATE POLICIES FOR campaign_summaries
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 Creating policies for campaign_summaries...';
  
  -- Admin SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'campaign_summaries' 
    AND policyname = 'Admins can view all campaign summaries'
  ) THEN
    CREATE POLICY "Admins can view all campaign summaries" ON campaign_summaries
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.id = auth.uid() 
          AND profiles.role = 'admin'
        )
      );
    RAISE NOTICE '✅ Created: Admins can view all campaign summaries';
  ELSE
    RAISE NOTICE '⏭️  Exists: Admins can view all campaign summaries';
  END IF;
  
  -- Admin INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'campaign_summaries' 
    AND policyname = 'Admins can insert campaign summaries'
  ) THEN
    CREATE POLICY "Admins can insert campaign summaries" ON campaign_summaries
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.id = auth.uid() 
          AND profiles.role = 'admin'
        )
      );
    RAISE NOTICE '✅ Created: Admins can insert campaign summaries';
  ELSE
    RAISE NOTICE '⏭️  Exists: Admins can insert campaign summaries';
  END IF;
  
  -- Admin UPDATE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'campaign_summaries' 
    AND policyname = 'Admins can update campaign summaries'
  ) THEN
    CREATE POLICY "Admins can update campaign summaries" ON campaign_summaries
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.id = auth.uid() 
          AND profiles.role = 'admin'
        )
      );
    RAISE NOTICE '✅ Created: Admins can update campaign summaries';
  ELSE
    RAISE NOTICE '⏭️  Exists: Admins can update campaign summaries';
  END IF;
  
  -- Admin DELETE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'campaign_summaries' 
    AND policyname = 'Admins can delete campaign summaries'
  ) THEN
    CREATE POLICY "Admins can delete campaign summaries" ON campaign_summaries
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.id = auth.uid() 
          AND profiles.role = 'admin'
        )
      );
    RAISE NOTICE '✅ Created: Admins can delete campaign summaries';
  ELSE
    RAISE NOTICE '⏭️  Exists: Admins can delete campaign summaries';
  END IF;
  
  -- Client SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'campaign_summaries' 
    AND policyname = 'Clients can view their own campaign summaries'
  ) THEN
    CREATE POLICY "Clients can view their own campaign summaries" ON campaign_summaries
      FOR SELECT USING (
        client_id IN (
          SELECT id FROM clients 
          WHERE email = (
            SELECT email FROM auth.users 
            WHERE id = auth.uid()
          )
        )
      );
    RAISE NOTICE '✅ Created: Clients can view their own campaign summaries';
  ELSE
    RAISE NOTICE '⏭️  Exists: Clients can view their own campaign summaries';
  END IF;
END $$;

-- ============================================================================
-- 3. CREATE POLICIES FOR current_month_cache
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 Creating policies for current_month_cache...';
  
  -- Service role policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'current_month_cache' 
    AND policyname = 'Service role can access all month cache'
  ) THEN
    CREATE POLICY "Service role can access all month cache" ON current_month_cache
      FOR ALL
      USING (auth.jwt()->>'role' = 'service_role');
    RAISE NOTICE '✅ Created: Service role can access all month cache';
  ELSE
    RAISE NOTICE '⏭️  Exists: Service role can access all month cache';
  END IF;
  
  -- User policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'current_month_cache' 
    AND policyname = 'Users can access cache for their clients'
  ) THEN
    CREATE POLICY "Users can access cache for their clients" ON current_month_cache
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM clients c
          WHERE c.id = current_month_cache.client_id
          AND (
            EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
            OR c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
          )
        )
      );
    RAISE NOTICE '✅ Created: Users can access cache for their clients';
  ELSE
    RAISE NOTICE '⏭️  Exists: Users can access cache for their clients';
  END IF;
END $$;

-- ============================================================================
-- 4. CREATE POLICIES FOR current_week_cache
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 Creating policies for current_week_cache...';
  
  -- Service role policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'current_week_cache' 
    AND policyname = 'Service role can access all week cache'
  ) THEN
    CREATE POLICY "Service role can access all week cache" ON current_week_cache
      FOR ALL
      USING (auth.jwt()->>'role' = 'service_role');
    RAISE NOTICE '✅ Created: Service role can access all week cache';
  ELSE
    RAISE NOTICE '⏭️  Exists: Service role can access all week cache';
  END IF;
  
  -- User policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'current_week_cache' 
    AND policyname = 'Users can access weekly cache for their clients'
  ) THEN
    CREATE POLICY "Users can access weekly cache for their clients" ON current_week_cache
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM clients c
          WHERE c.id = current_week_cache.client_id
          AND (
            EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
            OR c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
          )
        )
      );
    RAISE NOTICE '✅ Created: Users can access weekly cache for their clients';
  ELSE
    RAISE NOTICE '⏭️  Exists: Users can access weekly cache for their clients';
  END IF;
END $$;

-- ============================================================================
-- 5. CREATE POLICIES FOR daily_kpi_data
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 Creating policies for daily_kpi_data...';
  
  -- Admin view policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'daily_kpi_data' 
    AND policyname = 'Admins can view all daily KPI data'
  ) THEN
    CREATE POLICY "Admins can view all daily KPI data" ON daily_kpi_data
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.id = auth.uid() 
          AND profiles.role = 'admin'
        )
      );
    RAISE NOTICE '✅ Created: Admins can view all daily KPI data';
  ELSE
    RAISE NOTICE '⏭️  Exists: Admins can view all daily KPI data';
  END IF;
  
  -- Admin insert policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'daily_kpi_data' 
    AND policyname = 'Admins can insert daily KPI data'
  ) THEN
    CREATE POLICY "Admins can insert daily KPI data" ON daily_kpi_data
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.id = auth.uid() 
          AND profiles.role = 'admin'
        )
      );
    RAISE NOTICE '✅ Created: Admins can insert daily KPI data';
  ELSE
    RAISE NOTICE '⏭️  Exists: Admins can insert daily KPI data';
  END IF;
  
  -- Admin update policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'daily_kpi_data' 
    AND policyname = 'Admins can update daily KPI data'
  ) THEN
    CREATE POLICY "Admins can update daily KPI data" ON daily_kpi_data
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM profiles 
          WHERE profiles.id = auth.uid() 
          AND profiles.role = 'admin'
        )
      );
    RAISE NOTICE '✅ Created: Admins can update daily KPI data';
  ELSE
    RAISE NOTICE '⏭️  Exists: Admins can update daily KPI data';
  END IF;
  
  -- Service role policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'daily_kpi_data' 
    AND policyname = 'Service role can access all daily KPI data'
  ) THEN
    CREATE POLICY "Service role can access all daily KPI data" ON daily_kpi_data
      FOR ALL
      USING (auth.jwt()->>'role' = 'service_role');
    RAISE NOTICE '✅ Created: Service role can access all daily KPI data';
  ELSE
    RAISE NOTICE '⏭️  Exists: Service role can access all daily KPI data';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION: List all policies
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '📋 VERIFICATION: RLS Policies';
  RAISE NOTICE '============================================';
END $$;

SELECT 
  schemaname || '.' || tablename as "Table",
  policyname as "Policy Name",
  cmd as "Command",
  'Active' as "Status"
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('campaign_summaries', 'current_month_cache', 'current_week_cache', 'daily_kpi_data')
ORDER BY tablename, policyname;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎉 All RLS policies created successfully!';
  RAISE NOTICE '🔒 Tables are now secured with Row Level Security.';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEP: Run VERIFY_DATABASE_STATUS.sql to confirm everything works';
  RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- NEXT STEPS
-- ============================================================================
-- 1. ✅ All policies created
-- 2. ✅ RLS enabled on all tables
-- 3. ✅ Access control is now properly configured
-- 4. ➡️  Run VERIFY_DATABASE_STATUS.sql to check system health
-- 5. ➡️  Proceed to recover September 2025 data
-- ============================================================================





