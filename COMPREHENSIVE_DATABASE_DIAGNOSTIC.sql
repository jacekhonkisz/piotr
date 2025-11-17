-- ============================================================================
-- COMPREHENSIVE DATABASE DIAGNOSTIC SCRIPT
-- ============================================================================
-- Purpose: Complete analysis of your database state
-- Safety: 100% safe - read-only queries only
-- Run this to understand exactly what's happening
-- ============================================================================

-- ============================================================================
-- 1. BASIC DATABASE INFO
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '============================================';
  RAISE NOTICE '🔍 COMPREHENSIVE DATABASE DIAGNOSTIC';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Database: %', current_database();
  RAISE NOTICE 'User: %', current_user;
  RAISE NOTICE 'Timestamp: %', NOW();
  RAISE NOTICE 'PostgreSQL Version: %', version();
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- 2. CHECK ALL SCHEMAS
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '📊 SCHEMA ANALYSIS:';
  RAISE NOTICE '============================================';
END $$;

SELECT 
  schema_name as "Schema Name",
  CASE 
    WHEN schema_name = 'public' THEN '🔴 Application Tables'
    WHEN schema_name = 'auth' THEN '🔐 Supabase Auth'
    WHEN schema_name = 'storage' THEN '📁 Supabase Storage'
    WHEN schema_name = 'realtime' THEN '⚡ Supabase Realtime'
    WHEN schema_name = 'supabase_functions' THEN '🔧 Supabase Functions'
    ELSE '🟢 Other'
  END as "Purpose",
  'Active' as "Status"
FROM information_schema.schemata
WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
ORDER BY 
  CASE schema_name
    WHEN 'public' THEN 1
    WHEN 'auth' THEN 2
    WHEN 'storage' THEN 3
    WHEN 'realtime' THEN 4
    WHEN 'supabase_functions' THEN 5
    ELSE 6
  END;

-- ============================================================================
-- 3. CHECK ALL TABLES IN PUBLIC SCHEMA
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 ALL TABLES IN PUBLIC SCHEMA:';
  RAISE NOTICE '============================================';
END $$;

SELECT 
  table_name as "Table Name",
  CASE 
    WHEN table_name IN ('clients', 'profiles') THEN '🔴 CRITICAL CORE'
    WHEN table_name IN ('campaign_summaries', 'current_month_cache', 'current_week_cache', 'daily_kpi_data') THEN '🟡 REPORTS SYSTEM'
    WHEN table_name IN ('reports', 'campaigns', 'email_logs', 'system_settings') THEN '🟠 IMPORTANT'
    WHEN table_name LIKE '%cache%' THEN '💾 CACHE'
    WHEN table_name LIKE '%migration%' THEN '📦 MIGRATIONS'
    ELSE '🟢 OTHER'
  END as "Category",
  'Exists' as "Status"
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY 
  CASE 
    WHEN table_name IN ('clients', 'profiles') THEN 1
    WHEN table_name IN ('campaign_summaries', 'current_month_cache', 'current_week_cache', 'daily_kpi_data') THEN 2
    WHEN table_name IN ('reports', 'campaigns', 'email_logs', 'system_settings') THEN 3
    ELSE 4
  END,
  table_name;

-- ============================================================================
-- 4. CHECK SUPABASE AUTH SYSTEM
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔐 SUPABASE AUTH SYSTEM:';
  RAISE NOTICE '============================================';
END $$;

SELECT 
  table_name as "Auth Table",
  'Supabase Auth' as "System",
  'Active' as "Status"
FROM information_schema.tables
WHERE table_schema = 'auth'
ORDER BY table_name;

-- ============================================================================
-- 5. DETAILED ANALYSIS OF CRITICAL TABLES
-- ============================================================================
DO $$
DECLARE
  table_name TEXT;
  table_exists BOOLEAN;
  row_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 DETAILED TABLE ANALYSIS:';
  RAISE NOTICE '============================================';
  
  -- Check each critical table
  FOR table_name IN 
    SELECT t FROM unnest(ARRAY[
      'clients', 'profiles', 'campaign_summaries', 
      'current_month_cache', 'current_week_cache', 'daily_kpi_data',
      'reports', 'campaigns', 'email_logs', 'system_settings'
    ]) AS t
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND information_schema.tables.table_name = table_name
    ) INTO table_exists;
    
    IF table_exists THEN
      -- Get row count
      EXECUTE format('SELECT COUNT(*) FROM %I', table_name) INTO row_count;
      
      RAISE NOTICE '✅ % exists (% rows)', table_name, row_count;
      
      -- Check if table has data
      IF row_count = 0 THEN
        RAISE NOTICE '   ⚠️  Table is empty';
      ELSIF row_count < 10 THEN
        RAISE NOTICE '   📊 Low data count';
      ELSE
        RAISE NOTICE '   📈 Has substantial data';
      END IF;
      
      -- Check last updated (if updated_at column exists)
      BEGIN
        EXECUTE format('SELECT MAX(updated_at) FROM %I WHERE updated_at IS NOT NULL', table_name) INTO row_count;
        RAISE NOTICE '   🕒 Last updated: %', row_count;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '   🕒 No updated_at column';
      END;
      
    ELSE
      RAISE NOTICE '❌ % MISSING', table_name;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 6. CHECK FOR MIGRATION HISTORY
-- ============================================================================
DO $$
DECLARE
  migration_table_exists BOOLEAN;
  migration_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📦 MIGRATION ANALYSIS:';
  RAISE NOTICE '============================================';
  
  -- Check for supabase_migrations table
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'supabase_migrations'
  ) INTO migration_table_exists;
  
  IF migration_table_exists THEN
    SELECT COUNT(*) FROM supabase_migrations INTO migration_count;
    RAISE NOTICE '✅ supabase_migrations table exists (% migrations)', migration_count;
    
    -- Show recent migrations
    RAISE NOTICE '';
    RAISE NOTICE 'Recent migrations:';
  ELSE
    RAISE NOTICE '❌ supabase_migrations table missing';
    RAISE NOTICE '   → This suggests migrations were never run';
  END IF;
END $$;

-- Show migration history if table exists
SELECT 
  version as "Version",
  name as "Migration Name",
  executed_at as "Executed At"
FROM supabase_migrations
ORDER BY executed_at DESC
LIMIT 10;

-- ============================================================================
-- 7. CHECK DATABASE EXTENSIONS
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔧 DATABASE EXTENSIONS:';
  RAISE NOTICE '============================================';
END $$;

SELECT 
  extname as "Extension",
  extversion as "Version",
  CASE 
    WHEN extname = 'uuid-ossp' THEN '🔑 UUID Generation'
    WHEN extname = 'pgcrypto' THEN '🔐 Encryption'
    WHEN extname = 'postgis' THEN '🗺️ Geographic Data'
    ELSE '🟢 Other'
  END as "Purpose"
FROM pg_extension
ORDER BY extname;

-- ============================================================================
-- 8. CHECK FOR FOREIGN KEY RELATIONSHIPS
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔗 FOREIGN KEY RELATIONSHIPS:';
  RAISE NOTICE '============================================';
END $$;

SELECT 
  tc.table_name as "Table",
  kcu.column_name as "Column",
  ccu.table_name as "References Table",
  ccu.column_name as "References Column",
  tc.constraint_name as "Constraint"
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- 9. CHECK FOR ROW LEVEL SECURITY
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔒 ROW LEVEL SECURITY STATUS:';
  RAISE NOTICE '============================================';
END $$;

SELECT 
  schemaname || '.' || tablename as "Table",
  CASE 
    WHEN rowsecurity THEN '🔒 RLS Enabled'
    ELSE '🔓 RLS Disabled'
  END as "RLS Status",
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_policies WHERE tablename = t.tablename) THEN '📋 Has Policies'
    ELSE '⚠️ No Policies'
  END as "Policies"
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================================
-- 10. CHECK FOR SPECIFIC ERROR CONDITIONS
-- ============================================================================
DO $$
DECLARE
  has_clients BOOLEAN;
  has_profiles BOOLEAN;
  has_auth BOOLEAN;
  has_migrations BOOLEAN;
  clients_count INTEGER;
  profiles_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🚨 ERROR CONDITION ANALYSIS:';
  RAISE NOTICE '============================================';
  
  -- Check critical conditions
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') INTO has_clients;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') INTO has_profiles;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') INTO has_auth;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'supabase_migrations') INTO has_migrations;
  
  -- Get counts if tables exist
  IF has_clients THEN
    SELECT COUNT(*) FROM clients INTO clients_count;
  ELSE
    clients_count := 0;
  END IF;
  
  IF has_profiles THEN
    SELECT COUNT(*) FROM profiles INTO profiles_count;
  ELSE
    profiles_count := 0;
  END IF;
  
  -- Analyze conditions
  IF NOT has_clients THEN
    RAISE NOTICE '🔴 CRITICAL: clients table missing';
    RAISE NOTICE '   → This will cause "relation clients does not exist" error';
    RAISE NOTICE '   → Application cannot function without this table';
  ELSIF clients_count = 0 THEN
    RAISE NOTICE '🟡 WARNING: clients table exists but is empty';
    RAISE NOTICE '   → No client data available';
  ELSE
    RAISE NOTICE '✅ clients table exists with % records', clients_count;
  END IF;
  
  IF NOT has_profiles THEN
    RAISE NOTICE '🔴 CRITICAL: profiles table missing';
    RAISE NOTICE '   → User authentication will fail';
  ELSIF profiles_count = 0 THEN
    RAISE NOTICE '🟡 WARNING: profiles table exists but is empty';
    RAISE NOTICE '   → No user profiles available';
  ELSE
    RAISE NOTICE '✅ profiles table exists with % records', profiles_count;
  END IF;
  
  IF NOT has_auth THEN
    RAISE NOTICE '🔴 CRITICAL: Supabase Auth not found';
    RAISE NOTICE '   → This is very unusual for Supabase projects';
    RAISE NOTICE '   → Check project configuration';
  ELSE
    RAISE NOTICE '✅ Supabase Auth system is present';
  END IF;
  
  IF NOT has_migrations THEN
    RAISE NOTICE '⚠️ WARNING: No migration history found';
    RAISE NOTICE '   → Migrations may not have been run';
    RAISE NOTICE '   → Or migration table was deleted';
  ELSE
    RAISE NOTICE '✅ Migration history is available';
  END IF;
END $$;

-- ============================================================================
-- 11. CHECK FOR COMMON ISSUES
-- ============================================================================
DO $$
DECLARE
  issue_count INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 COMMON ISSUE DETECTION:';
  RAISE NOTICE '============================================';
  
  -- Check for orphaned foreign keys
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND kcu.column_name = 'client_id'
      AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients')
  ) THEN
    RAISE NOTICE '🔴 ISSUE: Foreign keys reference missing clients table';
    issue_count := issue_count + 1;
  END IF;
  
  -- Check for tables without RLS
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
      AND NOT rowsecurity
      AND tablename IN ('clients', 'profiles', 'campaigns')
  ) THEN
    RAISE NOTICE '⚠️ ISSUE: Some tables have RLS disabled';
    issue_count := issue_count + 1;
  END IF;
  
  -- Check for empty critical tables
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'clients' AND table_schema = 'public'
  ) AND NOT EXISTS (SELECT 1 FROM clients LIMIT 1) THEN
    RAISE NOTICE '⚠️ ISSUE: clients table is empty';
    issue_count := issue_count + 1;
  END IF;
  
  IF issue_count = 0 THEN
    RAISE NOTICE '✅ No common issues detected';
  ELSE
    RAISE NOTICE '⚠️ % issue(s) detected', issue_count;
  END IF;
END $$;

-- ============================================================================
-- 12. FINAL RECOMMENDATIONS
-- ============================================================================
DO $$
DECLARE
  has_clients BOOLEAN;
  has_profiles BOOLEAN;
  has_reports_tables BOOLEAN;
  has_auth BOOLEAN;
  has_migrations BOOLEAN;
  clients_count INTEGER;
BEGIN
  -- Check conditions
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients') INTO has_clients;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') INTO has_profiles;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'auth' AND table_name = 'users') INTO has_auth;
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'supabase_migrations') INTO has_migrations;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name IN ('campaign_summaries', 'current_month_cache', 'current_week_cache', 'daily_kpi_data')
  ) INTO has_reports_tables;
  
  IF has_clients THEN
    SELECT COUNT(*) FROM clients INTO clients_count;
  ELSE
    clients_count := 0;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '📋 FINAL RECOMMENDATIONS:';
  RAISE NOTICE '============================================';
  
  -- Core schema analysis
  IF NOT has_clients THEN
    RAISE NOTICE '🔴 CRITICAL ACTION REQUIRED:';
    RAISE NOTICE '   → Complete database schema is missing';
    RAISE NOTICE '   → Run initial schema migration: 001_initial_schema.sql';
    RAISE NOTICE '   → Or restore from database backup';
  ELSIF NOT has_profiles THEN
    RAISE NOTICE '🔴 CRITICAL ACTION REQUIRED:';
    RAISE NOTICE '   → User authentication tables missing';
    RAISE NOTICE '   → Run migration: 001_initial_schema.sql';
  ELSIF clients_count = 0 THEN
    RAISE NOTICE '🟡 ACTION REQUIRED:';
    RAISE NOTICE '   → Core tables exist but are empty';
    RAISE NOTICE '   → Restore client data or recreate clients';
  ELSE
    RAISE NOTICE '✅ Core schema is healthy';
  END IF;
  
  -- Reports system analysis
  IF NOT has_reports_tables THEN
    RAISE NOTICE '🟡 ACTION REQUIRED:';
    RAISE NOTICE '   → Reports system tables missing';
    RAISE NOTICE '   → Run: SAFE_01_CREATE_TABLES_ONLY.sql';
  ELSE
    RAISE NOTICE '✅ Reports system tables exist';
  END IF;
  
  -- Migration analysis
  IF NOT has_migrations THEN
    RAISE NOTICE '⚠️ RECOMMENDATION:';
    RAISE NOTICE '   → No migration history found';
    RAISE NOTICE '   → Consider running all migrations from scratch';
  END IF;
  
  -- Auth system analysis
  IF NOT has_auth THEN
    RAISE NOTICE '🔴 CRITICAL: Supabase Auth missing';
    RAISE NOTICE '   → Check Supabase project configuration';
    RAISE NOTICE '   → This is very unusual';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '📞 NEXT STEPS:';
  RAISE NOTICE '   1. Share this output with your team';
  RAISE NOTICE '   2. Choose appropriate recovery method';
  RAISE NOTICE '   3. Execute recovery plan';
  RAISE NOTICE '   4. Test core functionality';
  RAISE NOTICE '   5. Set up monitoring';
  RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- DIAGNOSTIC COMPLETE
-- ============================================================================
-- This script has analyzed your entire database
-- Review the output above for specific recommendations
-- Share the output if you need help interpreting results
-- ============================================================================










