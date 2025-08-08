-- Optimize profile performance with indexes and query optimizations
-- This migration adds indexes to improve profile loading performance

-- Add indexes for profiles table
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Add composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_profiles_id_role ON profiles(id, role);

-- Add index for updated_at for cache invalidation
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);

-- Optimize RLS policies for better performance
-- Drop existing policies and recreate with optimized versions
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Recreate policies with better performance
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Add policy for inserting profiles (for new user registration)
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Add comment for documentation
COMMENT ON TABLE profiles IS 'User profiles with optimized indexes for fast authentication queries';

-- Add function to analyze table performance
CREATE OR REPLACE FUNCTION analyze_profiles_performance()
RETURNS TABLE (
  index_name text,
  index_size text,
  index_usage_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.indexname::text,
    pg_size_pretty(pg_relation_size(i.indexname::regclass))::text,
    COALESCE(ix.idx_tup_read, 0)::bigint
  FROM pg_indexes i
  LEFT JOIN pg_stat_user_indexes ix ON i.indexname = ix.indexrelname
  WHERE i.tablename = 'profiles'
  ORDER BY pg_relation_size(i.indexname::regclass) DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION analyze_profiles_performance() TO authenticated;

-- Add function to get profile loading statistics
CREATE OR REPLACE FUNCTION get_profile_stats()
RETURNS TABLE (
  total_profiles bigint,
  active_profiles bigint,
  admin_count bigint,
  client_count bigint,
  avg_profile_size text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint as total_profiles,
    COUNT(CASE WHEN updated_at > NOW() - INTERVAL '30 days' THEN 1 END)::bigint as active_profiles,
    COUNT(CASE WHEN role = 'admin' THEN 1 END)::bigint as admin_count,
    COUNT(CASE WHEN role = 'client' THEN 1 END)::bigint as client_count,
    pg_size_pretty(AVG(pg_column_size(profiles.*)))::text as avg_profile_size
  FROM profiles;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_profile_stats() TO authenticated;

-- Add comment for the migration
COMMENT ON FUNCTION analyze_profiles_performance() IS 'Analyze performance of profiles table indexes';
COMMENT ON FUNCTION get_profile_stats() IS 'Get statistics about profiles table usage'; 