-- Performance Optimization Indexes
-- Fixes authentication bottleneck and query performance issues

-- ================================
-- CRITICAL: Profile Performance Indexes
-- ================================

-- Index for profile lookups by ID (most common query)
CREATE INDEX IF NOT EXISTS idx_profiles_id_optimized 
ON profiles(id) 
WHERE role IS NOT NULL;

-- Index for profile lookups by email and role
CREATE INDEX IF NOT EXISTS idx_profiles_email_role_optimized 
ON profiles(email, role) 
WHERE role IN ('admin', 'client');

-- Index for admin profile lookups
CREATE INDEX IF NOT EXISTS idx_profiles_admin_lookup 
ON profiles(id, role, email) 
WHERE role = 'admin';

-- Index for client profile lookups  
CREATE INDEX IF NOT EXISTS idx_profiles_client_lookup 
ON profiles(id, role, email) 
WHERE role = 'client';

-- ================================
-- Client Performance Indexes
-- ================================

-- Index for client lookups by admin_id (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_clients_admin_id_status 
ON clients(admin_id, api_status) 
WHERE api_status = 'valid';

-- Index for client lookups by email (client login)
CREATE INDEX IF NOT EXISTS idx_clients_email_active 
ON clients(email, api_status) 
WHERE api_status = 'valid';

-- Index for client token health monitoring
CREATE INDEX IF NOT EXISTS idx_clients_token_health 
ON clients(token_health_status, token_expires_at) 
WHERE token_expires_at IS NOT NULL;

-- ================================
-- Cache Performance Indexes
-- ================================

-- Index for current month cache lookups
CREATE INDEX IF NOT EXISTS idx_current_month_cache_lookup 
ON current_month_cache(client_id, period_id, last_updated);

-- Index for current week cache lookups
CREATE INDEX IF NOT EXISTS idx_current_week_cache_lookup 
ON current_week_cache(client_id, period_id, last_updated);

-- Index for campaign summaries
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_lookup 
ON campaign_summaries(client_id, summary_type, summary_date, last_updated);

-- ================================
-- Reports Performance Indexes
-- ================================

-- Index for report lookups by client and date range
CREATE INDEX IF NOT EXISTS idx_reports_client_date_range 
ON reports(client_id, date_range_start, date_range_end, generated_at);

-- Index for recent reports (dashboard)
CREATE INDEX IF NOT EXISTS idx_reports_recent 
ON reports(client_id, generated_at DESC) 
WHERE generated_at > NOW() - INTERVAL '30 days';

-- ================================
-- Campaigns Performance Indexes
-- ================================

-- Index for campaign lookups by client and date range
CREATE INDEX IF NOT EXISTS idx_campaigns_client_date_range 
ON campaigns(client_id, date_range_start, date_range_end);

-- Index for active campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_active 
ON campaigns(client_id, status, updated_at) 
WHERE status = 'ACTIVE';

-- ================================
-- Daily KPI Performance Indexes
-- ================================

-- Index for daily KPI data lookups
CREATE INDEX IF NOT EXISTS idx_daily_kpi_client_date 
ON daily_kpi_data(client_id, date, data_source);

-- Index for recent KPI data (carousel component)
CREATE INDEX IF NOT EXISTS idx_daily_kpi_recent 
ON daily_kpi_data(client_id, date DESC) 
WHERE date > CURRENT_DATE - INTERVAL '30 days';

-- ================================
-- Email Logs Performance Indexes
-- ================================

-- Index for email log lookups
CREATE INDEX IF NOT EXISTS idx_email_logs_report_status 
ON email_logs(report_id, status, sent_at);

-- Index for recent email logs
CREATE INDEX IF NOT EXISTS idx_email_logs_recent 
ON email_logs(sent_at DESC, status) 
WHERE sent_at > NOW() - INTERVAL '7 days';

-- ================================
-- System Performance Indexes
-- ================================

-- Index for system logs (monitoring)
CREATE INDEX IF NOT EXISTS idx_system_logs_recent 
ON system_logs(created_at DESC, level) 
WHERE created_at > NOW() - INTERVAL '24 hours';

-- ================================
-- Analyze Tables for Query Planner
-- ================================

-- Update table statistics for better query planning
ANALYZE profiles;
ANALYZE clients;
ANALYZE current_month_cache;
ANALYZE current_week_cache;
ANALYZE reports;
ANALYZE campaigns;
ANALYZE daily_kpi_data;

-- ================================
-- Performance Monitoring Function
-- ================================

CREATE OR REPLACE FUNCTION get_index_usage_stats()
RETURNS TABLE (
  table_name text,
  index_name text,
  index_scans bigint,
  tuples_read bigint,
  tuples_fetched bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    schemaname||'.'||tablename as table_name,
    indexrelname as index_name,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
  FROM pg_stat_user_indexes 
  WHERE schemaname = 'public'
  ORDER BY idx_scan DESC;
END;
$$ LANGUAGE plpgsql;

-- ================================
-- Performance Monitoring View
-- ================================

CREATE OR REPLACE VIEW performance_monitor AS
SELECT 
  'profiles' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE role = 'admin') as admin_count,
  COUNT(*) FILTER (WHERE role = 'client') as client_count,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_update_time
FROM profiles
UNION ALL
SELECT 
  'clients' as table_name,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE api_status = 'valid') as valid_count,
  COUNT(*) FILTER (WHERE api_status = 'invalid') as invalid_count,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_update_time
FROM clients;

-- Grant permissions
GRANT SELECT ON performance_monitor TO authenticated;
GRANT EXECUTE ON FUNCTION get_index_usage_stats() TO authenticated;
