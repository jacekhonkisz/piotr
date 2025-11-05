-- ============================================
-- VERIFIED DATABASE INDEXES
-- ============================================
-- This version is verified against actual table schemas
-- Only creates indexes on columns that actually exist
-- ============================================

-- ============================================
-- SMART CACHE INDEXES
-- ============================================

-- Current month cache: most frequent lookups
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

-- Last updated indexes for freshness checks
CREATE INDEX IF NOT EXISTS idx_current_month_cache_last_updated
  ON current_month_cache(last_updated DESC);

CREATE INDEX IF NOT EXISTS idx_current_week_cache_last_updated
  ON current_week_cache(last_updated DESC);

CREATE INDEX IF NOT EXISTS idx_google_ads_cache_last_updated
  ON google_ads_current_month_cache(last_updated DESC);

-- ============================================
-- CAMPAIGN SUMMARIES INDEXES
-- ============================================

-- Main lookup: client + platform + type + date
-- NOTE: platform column exists in campaign_summaries
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_lookup
  ON campaign_summaries(client_id, platform, summary_type, summary_date DESC);

-- Weekly summaries
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_weekly
  ON campaign_summaries(client_id, platform, summary_date DESC)
  WHERE summary_type = 'weekly';

-- Monthly summaries
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_monthly
  ON campaign_summaries(client_id, platform, summary_date DESC)
  WHERE summary_type = 'monthly';

-- Date index for range queries
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_date
  ON campaign_summaries(summary_date DESC);

-- ============================================
-- DAILY KPI DATA INDEXES
-- ============================================

-- Primary lookup: client + date
-- NOTE: Uses data_source column, not platform (though platform was added later)
CREATE INDEX IF NOT EXISTS idx_daily_kpi_data_client_date
  ON daily_kpi_data(client_id, date DESC);

-- With data_source for platform filtering
CREATE INDEX IF NOT EXISTS idx_daily_kpi_data_source
  ON daily_kpi_data(client_id, data_source, date DESC);

-- Date index for range queries
CREATE INDEX IF NOT EXISTS idx_daily_kpi_data_date
  ON daily_kpi_data(date DESC);

-- ============================================
-- CAMPAIGNS TABLE INDEXES (Meta Ads only)
-- ============================================
-- NOTE: campaigns table does NOT have a platform column
-- It's Meta-specific, Google Ads uses google_ads_campaigns

-- Campaign lookup by client and date range
CREATE INDEX IF NOT EXISTS idx_campaigns_client_date
  ON campaigns(client_id, date_range_start DESC, date_range_end DESC);

-- Campaign ID lookup
CREATE INDEX IF NOT EXISTS idx_campaigns_client_campaign_id
  ON campaigns(client_id, campaign_id, date_range_start DESC);

-- ============================================
-- GOOGLE ADS CAMPAIGNS TABLE INDEXES
-- ============================================

-- Google Ads campaign lookup
CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_client_date
  ON google_ads_campaigns(client_id, date_range_start DESC, date_range_end DESC);

-- Google Ads campaign ID lookup
CREATE INDEX IF NOT EXISTS idx_google_ads_campaigns_client_campaign_id
  ON google_ads_campaigns(client_id, campaign_id);

-- ============================================
-- REPORTS TABLE INDEXES
-- ============================================

-- Duplicate checking
CREATE INDEX IF NOT EXISTS idx_reports_duplicate_check
  ON reports(client_id, date_range_start, date_range_end);

-- Recent reports
CREATE INDEX IF NOT EXISTS idx_reports_client_generated
  ON reports(client_id, generated_at DESC);

-- Date range lookup
CREATE INDEX IF NOT EXISTS idx_reports_date_range
  ON reports(date_range_start DESC, date_range_end DESC);

-- ============================================
-- GENERATED REPORTS INDEXES
-- ============================================

-- Main lookup pattern
CREATE INDEX IF NOT EXISTS idx_generated_reports_client_period
  ON generated_reports(client_id, period_start, period_end, report_type);

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_generated_reports_status
  ON generated_reports(client_id, status, generated_at DESC);

-- Type filtering
CREATE INDEX IF NOT EXISTS idx_generated_reports_type
  ON generated_reports(client_id, report_type, generated_at DESC);

-- ============================================
-- CLIENTS TABLE INDEXES
-- ============================================

-- Email lookup (for authentication)
CREATE INDEX IF NOT EXISTS idx_clients_email
  ON clients(email)
  WHERE email IS NOT NULL;

-- Name lookup (for search)
CREATE INDEX IF NOT EXISTS idx_clients_name
  ON clients(name);

-- ============================================
-- PROFILES TABLE INDEXES
-- ============================================

-- Profile lookup by ID (very frequent)
CREATE INDEX IF NOT EXISTS idx_profiles_user_role
  ON profiles(id)
  INCLUDE (role, email);

-- Email lookup
CREATE INDEX IF NOT EXISTS idx_profiles_email
  ON profiles(email)
  WHERE email IS NOT NULL;

-- ============================================
-- ANALYZE TABLES (Update statistics)
-- ============================================

ANALYZE current_month_cache;
ANALYZE current_week_cache;
ANALYZE google_ads_current_month_cache;
ANALYZE campaign_summaries;
ANALYZE daily_kpi_data;
ANALYZE campaigns;
ANALYZE google_ads_campaigns;
ANALYZE reports;
ANALYZE generated_reports;
ANALYZE clients;
ANALYZE profiles;

-- ============================================
-- VERIFICATION
-- ============================================

-- Show all new indexes with sizes
SELECT 
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Show total index size
SELECT 
  pg_size_pretty(SUM(pg_relation_size(indexrelid))) AS total_index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%';

