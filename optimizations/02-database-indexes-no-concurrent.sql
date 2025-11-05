-- ALTERNATIVE VERSION: Without CONCURRENTLY
-- ⚠️ WARNING: This will lock tables briefly during index creation
-- Use this ONLY if:
-- 1. You're running on a development database
-- 2. You can tolerate 30-60 seconds of downtime
-- 3. You have low traffic during creation

-- ============================================
-- SMART CACHE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_current_month_cache_client_period
  ON current_month_cache(client_id, period_id)
  INCLUDE (last_updated);

CREATE INDEX IF NOT EXISTS idx_current_month_cache_recent
  ON current_month_cache(client_id, period_id, last_updated)
  WHERE last_updated > NOW() - INTERVAL '7 days';

CREATE INDEX IF NOT EXISTS idx_current_week_cache_client_period
  ON current_week_cache(client_id, period_id)
  INCLUDE (last_updated);

CREATE INDEX IF NOT EXISTS idx_google_ads_cache_client_period
  ON google_ads_current_month_cache(client_id, period_id)
  INCLUDE (last_updated);

-- ============================================
-- CAMPAIGN SUMMARIES INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_campaign_summaries_lookup
  ON campaign_summaries(client_id, platform, summary_type, summary_date DESC)
  INCLUDE (total_spend, total_impressions, total_clicks);

CREATE INDEX IF NOT EXISTS idx_campaign_summaries_weekly
  ON campaign_summaries(client_id, platform, summary_date DESC)
  WHERE summary_type = 'weekly';

CREATE INDEX IF NOT EXISTS idx_campaign_summaries_monthly
  ON campaign_summaries(client_id, platform, summary_date DESC)
  WHERE summary_type = 'monthly';

-- ============================================
-- DAILY KPI DATA INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_daily_kpi_data_lookup
  ON daily_kpi_data(client_id, data_source, date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_kpi_data_aggregation
  ON daily_kpi_data(client_id, data_source, date)
  INCLUDE (total_spend, total_impressions, total_clicks, total_conversions, 
           reservations, reservation_value);

CREATE INDEX IF NOT EXISTS idx_daily_kpi_data_recent
  ON daily_kpi_data(client_id, data_source, date DESC)
  WHERE date >= CURRENT_DATE - INTERVAL '90 days';

-- ============================================
-- CAMPAIGNS TABLE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_campaigns_client_date_range
  ON campaigns(client_id, date_range_start, date_range_end);

CREATE INDEX IF NOT EXISTS idx_campaigns_platform_lookup
  ON campaigns(client_id, platform, date_range_start DESC)
  WHERE platform IN ('meta', 'google');

-- ============================================
-- REPORTS TABLE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_reports_duplicate_check
  ON reports(client_id, date_range_start, date_range_end);

CREATE INDEX IF NOT EXISTS idx_reports_recent
  ON reports(client_id, generated_at DESC)
  WHERE generated_at >= CURRENT_DATE - INTERVAL '90 days';

-- ============================================
-- GENERATED REPORTS INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_generated_reports_client_period
  ON generated_reports(client_id, period_start, period_end, report_type);

-- ============================================
-- ANALYZE TABLES
-- ============================================

ANALYZE current_month_cache;
ANALYZE current_week_cache;
ANALYZE google_ads_current_month_cache;
ANALYZE campaign_summaries;
ANALYZE daily_kpi_data;
ANALYZE campaigns;
ANALYZE reports;
ANALYZE generated_reports;

