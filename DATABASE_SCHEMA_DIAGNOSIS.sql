-- ============================================================================
-- DATABASE SCHEMA DIAGNOSIS SCRIPT
-- ============================================================================
-- Purpose: Check what tables actually exist in your database
-- Safety: 100% safe - read-only queries only
-- Run this FIRST to understand your current database state
-- ============================================================================

-- ============================================================================
-- 1. CHECK ALL TABLES IN PUBLIC SCHEMA
-- ============================================================================
SELECT 
  'ALL TABLES' as "Section",
  table_name as "Table Name",
  CASE 
    WHEN table_name IN ('clients', 'profiles', 'campaign_summaries', 'current_month_cache', 'current_week_cache', 'daily_kpi_data') 
    THEN '🔴 CRITICAL'
    WHEN table_name IN ('reports', 'campaigns', 'email_logs', 'system_settings')
    THEN '🟡 IMPORTANT'
    ELSE '🟢 OTHER'
  END as "Priority",
  'Exists' as "Status"
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY 
  CASE 
    WHEN table_name IN ('clients', 'profiles', 'campaign_summaries', 'current_month_cache', 'current_week_cache', 'daily_kpi_data') THEN 1
    WHEN table_name IN ('reports', 'campaigns', 'email_logs', 'system_settings') THEN 2
    ELSE 3
  END,
  table_name;

-- ============================================================================
-- 2. CHECK FOR CRITICAL TABLES SPECIFICALLY
-- ============================================================================
DO $$
DECLARE
  missing_critical TEXT := '';
  missing_important TEXT := '';
  table_name TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '🔍 CRITICAL TABLES CHECK:';
  RAISE NOTICE '============================================';
  
  -- Check critical tables
  FOR table_name IN 
    SELECT t FROM unnest(ARRAY['clients', 'profiles', 'campaign_summaries', 'current_month_cache', 'current_week_cache', 'daily_kpi_data']) AS t
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = table_name) THEN
      RAISE NOTICE '✅ % exists', table_name;
    ELSE
      RAISE NOTICE '❌ % MISSING', table_name;
      missing_critical := missing_critical || table_name || ', ';
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '🔍 IMPORTANT TABLES CHECK:';
  RAISE NOTICE '============================================';
  
  -- Check important tables
  FOR table_name IN 
    SELECT t FROM unnest(ARRAY['reports', 'campaigns', 'email_logs', 'system_settings']) AS t
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = table_name) THEN
      RAISE NOTICE '✅ % exists', table_name;
    ELSE
      RAISE NOTICE '❌ % MISSING', table_name;
      missing_important := missing_important || table_name || ', ';
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '📋 SUMMARY:';
  RAISE NOTICE '============================================';
  
  IF missing_critical = '' THEN
    RAISE NOTICE '✅ All critical tables exist';
  ELSE
    RAISE NOTICE '🔴 MISSING CRITICAL TABLES: %', TRIM(TRAILING ', ' FROM missing_critical);
  END IF;
  
  IF missing_important = '' THEN
    RAISE NOTICE '✅ All important tables exist';
  ELSE
    RAISE NOTICE '🟡 MISSING IMPORTANT TABLES: %', TRIM(TRAILING ', ' FROM missing_important);
  END IF;
  
  RAISE NOTICE '';
  
  -- Provide recommendations
  IF missing_critical LIKE '%clients%' THEN
    RAISE NOTICE '🚨 CRITICAL ISSUE: clients table missing!';
    RAISE NOTICE '   → This means your entire application schema is missing';
    RAISE NOTICE '   → You need to run the INITIAL database migration first';
    RAISE NOTICE '   → File needed: 001_initial_schema.sql';
  END IF;
  
  IF missing_critical LIKE '%profiles%' THEN
    RAISE NOTICE '🚨 CRITICAL ISSUE: profiles table missing!';
    RAISE NOTICE '   → User authentication will not work';
    RAISE NOTICE '   → This is part of the initial schema';
  END IF;
  
  RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- 3. CHECK FOR MIGRATION HISTORY
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 CHECKING FOR MIGRATION HISTORY...';
  
  -- Check if there's a migrations table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'supabase_migrations') THEN
    RAISE NOTICE '✅ supabase_migrations table exists';
    
    -- Show migration history
    PERFORM 1; -- This will execute the query below
  ELSE
    RAISE NOTICE '❌ No supabase_migrations table found';
    RAISE NOTICE '   → This suggests migrations were never run';
    RAISE NOTICE '   → Or migrations table was deleted';
  END IF;
END $$;

-- Show migration history if table exists
SELECT 
  'MIGRATION HISTORY' as "Section",
  version as "Version",
  statements as "Statements",
  name as "Name"
FROM supabase_migrations
ORDER BY version DESC
LIMIT 10;

-- ============================================================================
-- 4. CHECK DATABASE EXTENSIONS
-- ============================================================================
SELECT 
  'EXTENSIONS' as "Section",
  extname as "Extension Name",
  extversion as "Version",
  'Installed' as "Status"
FROM pg_extension
WHERE extname IN ('uuid-ossp', 'pgcrypto', 'postgis')
ORDER BY extname;

-- ============================================================================
-- 5. CHECK FOR AUTH SCHEMA (Supabase Auth)
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 CHECKING SUPABASE AUTH...';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    RAISE NOTICE '✅ Supabase Auth is configured (auth.users exists)';
  ELSE
    RAISE NOTICE '❌ Supabase Auth not found (auth.users missing)';
    RAISE NOTICE '   → This is unusual for Supabase projects';
  END IF;
END $$;

-- ============================================================================
-- 6. RECOMMENDATIONS BASED ON FINDINGS
-- ============================================================================
DO $$
DECLARE
  has_clients BOOLEAN;
  has_profiles BOOLEAN;
  has_auth BOOLEAN;
  has_migrations BOOLEAN;
BEGIN
  -- Check conditions
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') INTO has_clients;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') INTO has_profiles;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') INTO has_auth;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'supabase_migrations') INTO has_migrations;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '📋 RECOMMENDATIONS:';
  RAISE NOTICE '============================================';
  
  IF NOT has_clients THEN
    RAISE NOTICE '🔴 CRITICAL: Complete database schema missing!';
    RAISE NOTICE '   → ACTION: Run initial schema migration';
    RAISE NOTICE '   → FILE: 001_initial_schema.sql';
    RAISE NOTICE '   → This will create clients, profiles, and core tables';
  END IF;
  
  IF NOT has_auth THEN
    RAISE NOTICE '⚠️  WARNING: Supabase Auth not found';
    RAISE NOTICE '   → This may indicate database connection issues';
    RAISE NOTICE '   → Check Supabase project settings';
  END IF;
  
  IF NOT has_migrations THEN
    RAISE NOTICE '⚠️  WARNING: No migration history found';
    RAISE NOTICE '   → Migrations may not have been run';
    RAISE NOTICE '   → Consider running all migrations from scratch';
  END IF;
  
  IF has_clients AND has_profiles THEN
    RAISE NOTICE '✅ Core schema exists, proceed with reports tables';
    RAISE NOTICE '   → Run: SAFE_01_CREATE_TABLES_ONLY.sql';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'For detailed instructions, see: DATABASE_SCHEMA_RECOVERY_GUIDE.md';
  RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- DIAGNOSIS COMPLETE
-- ============================================================================
-- Review the output above to understand your database state
-- Follow recommendations in DATABASE_SCHEMA_RECOVERY_GUIDE.md
-- ============================================================================









