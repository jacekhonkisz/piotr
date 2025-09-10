-- Disable RLS policies for cache tables to make them simple and work in production
-- No authentication required for cache operations

-- 1. Disable RLS on current_month_cache
ALTER TABLE current_month_cache DISABLE ROW LEVEL SECURITY;

-- 2. Disable RLS on current_week_cache  
ALTER TABLE current_week_cache DISABLE ROW LEVEL SECURITY;

-- 3. Disable RLS on Google Ads cache tables (if they exist)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'google_ads_current_month_cache') THEN
        ALTER TABLE google_ads_current_month_cache DISABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'google_ads_current_week_cache') THEN
        ALTER TABLE google_ads_current_week_cache DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 4. Grant full access to service role (redundant but explicit)
GRANT ALL ON current_month_cache TO service_role;
GRANT ALL ON current_week_cache TO service_role;

-- Grant access to Google Ads tables if they exist
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'google_ads_current_month_cache') THEN
        GRANT ALL ON google_ads_current_month_cache TO service_role;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'google_ads_current_week_cache') THEN
        GRANT ALL ON google_ads_current_week_cache TO service_role;
    END IF;
END $$;

-- 5. Add comments for documentation
COMMENT ON TABLE current_month_cache IS 'Cache table with RLS disabled for simple production access';
COMMENT ON TABLE current_week_cache IS 'Weekly cache table with RLS disabled for simple production access';
