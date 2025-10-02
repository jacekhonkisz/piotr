-- ============================================================================
-- Migration: Deprecate Legacy Campaign Tables
-- ============================================================================
-- Date: October 2, 2025
-- Purpose: Mark old campaign tables as deprecated in favor of unified campaign_summaries
-- 
-- Background:
-- - Old system used separate tables: campaigns (Meta) and google_ads_campaigns (Google)
-- - New unified system uses campaign_summaries with platform column
-- - This migration deprecates old tables without deleting them (for safety)
-- 
-- Future:
-- - These tables will be removed in v2.0 after full migration
-- ============================================================================

-- 1. Mark campaigns table as deprecated
COMMENT ON TABLE campaigns IS 
'⚠️ DEPRECATED: This table is deprecated as of October 2, 2025. 
Use campaign_summaries with platform=''meta'' instead. 

Reason: Unified data model with platform separation.
Migration path: Data should be migrated to campaign_summaries.
Scheduled for removal: v2.0 (estimated Q1 2026)

Do not write new data to this table.';

-- 2. Mark google_ads_campaigns table as deprecated
COMMENT ON TABLE google_ads_campaigns IS 
'⚠️ DEPRECATED: This table is deprecated as of October 2, 2025. 
Use campaign_summaries with platform=''google'' instead. 

Reason: Unified data model with platform separation.
Migration path: Data should be migrated to campaign_summaries.
Scheduled for removal: v2.0 (estimated Q1 2026)

Do not write new data to this table.';

-- 3. Create warning function for deprecated table usage
CREATE OR REPLACE FUNCTION warn_deprecated_table_usage()
RETURNS trigger AS $$
BEGIN
  RAISE NOTICE '⚠️ WARNING: Table "%" is DEPRECATED. Use campaign_summaries instead.', TG_TABLE_NAME;
  RAISE NOTICE '   → See table comment for migration path';
  RAISE NOTICE '   → This table will be removed in v2.0';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Add deprecation warning triggers
-- These will log a warning (but not block) when data is inserted

DROP TRIGGER IF EXISTS warn_campaigns_deprecated ON campaigns;
CREATE TRIGGER warn_campaigns_deprecated
  BEFORE INSERT ON campaigns
  FOR EACH ROW 
  EXECUTE FUNCTION warn_deprecated_table_usage();

COMMENT ON TRIGGER warn_campaigns_deprecated ON campaigns IS 
'Logs warning when deprecated campaigns table is used. Does not block operation.';

DROP TRIGGER IF EXISTS warn_google_ads_campaigns_deprecated ON google_ads_campaigns;
CREATE TRIGGER warn_google_ads_campaigns_deprecated
  BEFORE INSERT ON google_ads_campaigns
  FOR EACH ROW 
  EXECUTE FUNCTION warn_deprecated_table_usage();

COMMENT ON TRIGGER warn_google_ads_campaigns_deprecated ON google_ads_campaigns IS 
'Logs warning when deprecated google_ads_campaigns table is used. Does not block operation.';

-- 5. Create view for monitoring deprecated table usage
CREATE OR REPLACE VIEW v_deprecated_tables_usage AS
SELECT 
  'campaigns' as table_name,
  'meta' as intended_platform,
  COUNT(*) as row_count,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record,
  CASE 
    WHEN MAX(created_at) > NOW() - INTERVAL '30 days' THEN '⚠️ Recent usage'
    WHEN COUNT(*) > 0 THEN '📋 Legacy data only'
    ELSE '✅ No data'
  END as status
FROM campaigns
WHERE created_at IS NOT NULL

UNION ALL

SELECT 
  'google_ads_campaigns' as table_name,
  'google' as intended_platform,
  COUNT(*) as row_count,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record,
  CASE 
    WHEN MAX(created_at) > NOW() - INTERVAL '30 days' THEN '⚠️ Recent usage'
    WHEN COUNT(*) > 0 THEN '📋 Legacy data only'
    ELSE '✅ No data'
  END as status
FROM google_ads_campaigns
WHERE created_at IS NOT NULL;

COMMENT ON VIEW v_deprecated_tables_usage IS 
'Monitoring view for tracking usage of deprecated campaign tables.
Use this to verify migration progress and ensure no new data is being written.';

-- 6. Grant access to monitoring view
GRANT SELECT ON v_deprecated_tables_usage TO authenticated;
GRANT SELECT ON v_deprecated_tables_usage TO service_role;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 054 completed successfully';
  RAISE NOTICE '   → campaigns table marked as deprecated';
  RAISE NOTICE '   → google_ads_campaigns table marked as deprecated';
  RAISE NOTICE '   → Warning triggers added';
  RAISE NOTICE '   → Monitoring view created: v_deprecated_tables_usage';
  RAISE NOTICE '';
  RAISE NOTICE '📊 To monitor usage:';
  RAISE NOTICE '   SELECT * FROM v_deprecated_tables_usage;';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ Next steps:';
  RAISE NOTICE '   1. Audit code for references to deprecated tables';
  RAISE NOTICE '   2. Migrate any remaining data to campaign_summaries';
  RAISE NOTICE '   3. Update application code to use campaign_summaries';
  RAISE NOTICE '   4. Monitor v_deprecated_tables_usage for 30 days';
  RAISE NOTICE '   5. Remove deprecated tables in v2.0';
END $$;

