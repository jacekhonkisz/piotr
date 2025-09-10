-- Fix RLS policies for cache tables to allow service role access
-- This fixes the issue where smart cache system cannot update cache due to RLS blocking service role

-- 1. Add service role policy for current_month_cache
CREATE POLICY "Service role can access all current month cache" ON current_month_cache
FOR ALL USING (auth.role() = 'service_role');

-- 2. Add service role policy for current_week_cache  
CREATE POLICY "Service role can access all current week cache" ON current_week_cache
FOR ALL USING (auth.role() = 'service_role');

-- 3. Grant explicit permissions to service role
GRANT ALL ON current_month_cache TO service_role;
GRANT ALL ON current_week_cache TO service_role;

-- 4. Add comments for documentation
COMMENT ON POLICY "Service role can access all current month cache" ON current_month_cache 
IS 'Allows service role to read/write cache data for smart caching system';

COMMENT ON POLICY "Service role can access all current week cache" ON current_week_cache 
IS 'Allows service role to read/write weekly cache data for smart caching system';
