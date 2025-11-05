-- FIXED VERSION: Removed problematic date predicates
-- PostgreSQL requires functions in WHERE clauses to be IMMUTABLE
-- NOW() and CURRENT_DATE are STABLE, not IMMUTABLE

-- ============================================
-- SMART CACHE INDEXES
-- ============================================

-- Core lookup index for current month cache
CREATE INDEX IF NOT EXISTS idx_current_month_cache_client_period
  ON current_month_cache(client_id, period_id)
  INCLUDE (last_updated);

-- Current week cache
CREATE INDEX IF NOT EXISTS idx_current_week_cache_client_period
  ON current_week_cache(client_id, period_id)
  INCLUDE (last_updated);

-- Google Ads cache
CREATE INDEX IF NOT EXISTS idx_google_ads_cache_client_period
  ON google_ads_current_month_cache(client_id, period_id)
  INCLUDE (last_updated);

-- Additional index on last_updated for freshness checks
CREATE INDEX IF NOT EXISTS idx_current_month_cache_last_updated
  ON current_month_cache(last_updated DESC);

CREATE INDEX IF NOT EXISTS idx_current_week_cache_last_updated
  ON current_week_cache(last_updated DESC);

CREATE INDEX IF NOT EXISTS idx_google_ads_cache_last_updated
  ON google_ads_current_month_cache(last_updated DESC);

-- ============================================
-- CAMPAIGN SUMMARIES INDEXES
-- ============================================

-- Main lookup pattern: client + platform + type + date
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_lookup
  ON campaign_summaries(client_id, platform, summary_type, summary_date DESC)
  INCLUDE (total_spend, total_impressions, total_clicks);

-- Separate indexes for weekly and monthly (better performance)
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_weekly
  ON campaign_summaries(client_id, platform, summary_date DESC)
  WHERE summary_type = 'weekly';

CREATE INDEX IF NOT EXISTS idx_campaign_summaries_monthly
  ON campaign_summaries(client_id, platform, summary_date DESC)
  WHERE summary_type = 'monthly';

-- Index on summary_date for date range queries
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_date
  ON campaign_summaries(summary_date DESC);

-- ============================================
-- DAILY KPI DATA INDEXES
-- ============================================

-- Primary lookup: client + source + date
CREATE INDEX IF NOT EXISTS idx_daily_kpi_data_lookup
  ON daily_kpi_data(client_id, data_source, date DESC);

-- Covering index for aggregations (includes commonly queried columns)
CREATE INDEX IF NOT EXISTS idx_daily_kpi_data_aggregation
  ON daily_kpi_data(client_id, data_source, date DESC)
  INCLUDE (total_spend, total_impressions, total_clicks, total_conversions, 
           reservations, reservation_value);

-- Index on date for range queries
CREATE INDEX IF NOT EXISTS idx_daily_kpi_data_date
  ON daily_kpi_data(date DESC);

-- Index on data_source for platform filtering
CREATE INDEX IF NOT EXISTS idx_daily_kpi_data_source
  ON daily_kpi_data(client_id, data_source);

-- ============================================
-- CAMPAIGNS TABLE INDEXES
-- ============================================

-- Campaign lookup by client and date range
CREATE INDEX IF NOT EXISTS idx_campaigns_client_date_range
  ON campaigns(client_id, date_range_start DESC, date_range_end DESC);

-- Platform-specific lookup
CREATE INDEX IF NOT EXISTS idx_campaigns_platform
  ON campaigns(client_id, platform, date_range_start DESC);

-- Index on campaign_id for quick lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_campaign_id
  ON campaigns(client_id, campaign_id);

-- ============================================
-- REPORTS TABLE INDEXES
-- ============================================

-- Duplicate checking
CREATE INDEX IF NOT EXISTS idx_reports_duplicate_check
  ON reports(client_id, date_range_start, date_range_end);

-- Recent reports listing
CREATE INDEX IF NOT EXISTS idx_reports_client_generated
  ON reports(client_id, generated_at DESC);

-- ============================================
-- GENERATED REPORTS INDEXES
-- ============================================

-- Main lookup pattern
CREATE INDEX IF NOT EXISTS idx_generated_reports_client_period
  ON generated_reports(client_id, period_start, period_end, report_type);

-- Recent reports with status filter
CREATE INDEX IF NOT EXISTS idx_generated_reports_status
  ON generated_reports(client_id, status, generated_at DESC);

-- By report type
CREATE INDEX IF NOT EXISTS idx_generated_reports_type
  ON generated_reports(client_id, report_type, generated_at DESC);

-- ============================================
-- CLIENTS TABLE INDEXES
-- ============================================

-- Email lookup (for authentication)
CREATE INDEX IF NOT EXISTS idx_clients_email
  ON clients(email)
  WHERE email IS NOT NULL;

-- ============================================
-- PROFILES TABLE INDEXES
-- ============================================

-- Profile lookup by ID
CREATE INDEX IF NOT EXISTS idx_profiles_id_role
  ON profiles(id)
  INCLUDE (role, email);

-- ============================================
-- ANALYZE TABLES (Update statistics)
-- ============================================

ANALYZE current_month_cache;
ANALYZE current_week_cache;
ANALYZE google_ads_current_month_cache;
ANALYZE campaign_summaries;
ANALYZE daily_kpi_data;
ANALYZE campaigns;
ANALYZE reports;
ANALYZE generated_reports;
ANALYZE clients;
ANALYZE profiles;

-- ============================================
-- VERIFICATION
-- ============================================

-- Show created indexes with sizes
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Show index usage statistics (run this after a few hours)
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   idx_scan AS times_used,
--   pg_size_pretty(pg_relation_size(indexrelid)) AS size
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
--   AND indexname LIKE 'idx_%'
-- ORDER BY idx_scan DESC;

