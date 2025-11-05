-- 🔧 SUPABASE DATABASE OPTIMIZATIONS
-- Date: November 5, 2025
-- Purpose: Ensure data integrity and performance

-- ============================================
-- OPTIMIZATION 1: Add Platform Validation Constraint
-- ============================================
-- Ensures platform field only contains valid values

ALTER TABLE campaign_summaries
DROP CONSTRAINT IF EXISTS valid_platform;

ALTER TABLE campaign_summaries
ADD CONSTRAINT valid_platform 
CHECK (platform IN ('meta', 'google'));

-- This prevents accidentally storing 'google_ads' or other variants
-- Now only 'meta' or 'google' are allowed


-- ============================================
-- OPTIMIZATION 2: Add Composite Indexes for Performance
-- ============================================
-- Speed up the most common queries

-- Index for year-over-year queries (MOST IMPORTANT)
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_yoy 
ON campaign_summaries (client_id, platform, summary_type, summary_date DESC);

-- Index for current month/week smart cache lookups
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_latest 
ON campaign_summaries (client_id, platform, summary_date DESC);

-- Index for date range queries (without partial index - safer)
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_date_range 
ON campaign_summaries (client_id, platform, summary_date);

-- Index for daily_kpi_data queries
CREATE INDEX IF NOT EXISTS idx_daily_kpi_date_range 
ON daily_kpi_data (client_id, data_source, date DESC);


-- ============================================
-- OPTIMIZATION 3: Add Unique Constraint
-- ============================================
-- Prevent duplicate summaries for same period/platform

-- First, remove any existing duplicates (if any)
DELETE FROM campaign_summaries a
USING campaign_summaries b
WHERE a.id > b.id
  AND a.client_id = b.client_id
  AND a.platform = b.platform
  AND a.summary_type = b.summary_type
  AND a.summary_date = b.summary_date;

-- Now add the unique constraint
ALTER TABLE campaign_summaries
DROP CONSTRAINT IF EXISTS unique_summary_period_platform;

ALTER TABLE campaign_summaries
ADD CONSTRAINT unique_summary_period_platform 
UNIQUE (client_id, platform, summary_type, summary_date);

-- This prevents storing multiple summaries for same period/platform


-- ============================================
-- OPTIMIZATION 4: Add Materialized View for Fast YoY Lookups
-- ============================================
-- Pre-calculate year-over-year comparisons for common periods

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_yoy_comparisons AS
WITH current_periods AS (
  SELECT 
    client_id,
    platform,
    summary_type,
    summary_date,
    total_spend,
    booking_step_1,
    booking_step_2,
    booking_step_3,
    reservations,
    reservation_value
  FROM campaign_summaries
  WHERE summary_date >= CURRENT_DATE - INTERVAL '13 months'
),
previous_periods AS (
  SELECT 
    client_id,
    platform,
    summary_type,
    DATE(summary_date + INTERVAL '1 year') as comparison_date,
    total_spend as prev_spend,
    booking_step_1 as prev_step1,
    booking_step_2 as prev_step2,
    booking_step_3 as prev_step3,
    reservations as prev_reservations,
    reservation_value as prev_value
  FROM campaign_summaries
  WHERE summary_date >= CURRENT_DATE - INTERVAL '25 months'
)
SELECT 
  c.client_id,
  c.platform,
  c.summary_type,
  c.summary_date,
  c.total_spend as current_spend,
  p.prev_spend,
  c.booking_step_1 as current_step1,
  p.prev_step1,
  c.reservations as current_reservations,
  p.prev_reservations,
  -- Pre-calculate changes
  CASE 
    WHEN p.prev_spend > 0 THEN 
      ROUND(((c.total_spend - p.prev_spend) / p.prev_spend * 100)::numeric, 2)
    ELSE -999
  END as spend_change_pct,
  CASE 
    WHEN p.prev_step1 > 0 THEN 
      ROUND(((c.booking_step_1 - p.prev_step1) / p.prev_step1 * 100)::numeric, 2)
    ELSE -999
  END as step1_change_pct
FROM current_periods c
LEFT JOIN previous_periods p
  ON c.client_id = p.client_id
  AND c.platform = p.platform
  AND c.summary_type = p.summary_type
  AND c.summary_date = p.comparison_date;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_mv_yoy_lookup 
ON mv_yoy_comparisons (client_id, platform, summary_date);

-- Refresh materialized view (run this daily via cron)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_yoy_comparisons;


-- ============================================
-- OPTIMIZATION 5: Add Data Quality Check Function
-- ============================================
-- Validates funnel logic before inserting

CREATE OR REPLACE FUNCTION validate_funnel_logic()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for impossible funnels
  IF NEW.booking_step_2 > NEW.booking_step_1 AND NEW.booking_step_1 > 0 THEN
    RAISE WARNING 'Invalid funnel: Step 2 (%) > Step 1 (%) for client % platform %', 
      NEW.booking_step_2, NEW.booking_step_1, NEW.client_id, NEW.platform;
  END IF;
  
  IF NEW.booking_step_3 > NEW.booking_step_2 AND NEW.booking_step_2 > 0 THEN
    RAISE WARNING 'Invalid funnel: Step 3 (%) > Step 2 (%) for client % platform %', 
      NEW.booking_step_3, NEW.booking_step_2, NEW.client_id, NEW.platform;
  END IF;
  
  IF NEW.reservations > NEW.booking_step_1 * 100 AND NEW.booking_step_1 > 0 THEN
    RAISE WARNING 'Suspicious: Reservations (%) >> Step 1 (%) for client % platform %', 
      NEW.reservations, NEW.booking_step_1, NEW.client_id, NEW.platform;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger
DROP TRIGGER IF EXISTS validate_funnel ON campaign_summaries;
CREATE TRIGGER validate_funnel
  BEFORE INSERT OR UPDATE ON campaign_summaries
  FOR EACH ROW
  EXECUTE FUNCTION validate_funnel_logic();


-- ============================================
-- OPTIMIZATION 6: Add Helper Function for YoY Queries
-- ============================================
-- Simplifies fetching year-over-year data with guaranteed platform consistency

CREATE OR REPLACE FUNCTION get_yoy_comparison(
  p_client_id UUID,
  p_platform TEXT,
  p_summary_type TEXT,
  p_current_date DATE
)
RETURNS TABLE (
  current_spend NUMERIC,
  previous_spend NUMERIC,
  current_step1 INTEGER,
  previous_step1 INTEGER,
  current_reservations INTEGER,
  previous_reservations INTEGER,
  spend_change_pct NUMERIC,
  step1_change_pct NUMERIC,
  data_available BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH current_data AS (
    SELECT 
      total_spend,
      booking_step_1,
      reservations
    FROM campaign_summaries
    WHERE client_id = p_client_id
      AND platform = p_platform
      AND summary_type = p_summary_type
      AND summary_date = p_current_date
    LIMIT 1
  ),
  previous_data AS (
    SELECT 
      total_spend,
      booking_step_1,
      reservations
    FROM campaign_summaries
    WHERE client_id = p_client_id
      AND platform = p_platform  -- SAME PLATFORM ✅
      AND summary_type = p_summary_type
      AND summary_date = p_current_date - INTERVAL '1 year'
    LIMIT 1
  )
  SELECT 
    c.total_spend,
    p.total_spend,
    c.booking_step_1,
    p.booking_step_1,
    c.reservations,
    p.reservations,
    CASE 
      WHEN p.total_spend > 0 THEN 
        ((c.total_spend - p.total_spend) / p.total_spend * 100)
      ELSE -999
    END,
    CASE 
      WHEN p.booking_step_1 > 0 THEN 
        ((c.booking_step_1 - p.booking_step_1)::numeric / p.booking_step_1 * 100)
      ELSE -999
    END,
    (c.total_spend IS NOT NULL AND p.total_spend IS NOT NULL)
  FROM current_data c
  FULL OUTER JOIN previous_data p ON true;
END;
$$ LANGUAGE plpgsql;

-- Usage example:
-- SELECT * FROM get_yoy_comparison(
--   'ab0b4c7e-2bf0-46bc-b455-b18ef6942baa'::uuid,
--   'meta',
--   'monthly',
--   '2025-11-01'::date
-- );


-- ============================================
-- OPTIMIZATION 7: Add Monitoring View
-- ============================================
-- Tracks data quality issues

CREATE OR REPLACE VIEW v_data_quality_issues AS
SELECT 
  client_id,
  platform,
  summary_date,
  summary_type,
  CASE 
    WHEN booking_step_2 > booking_step_1 THEN 'Inverted funnel: Step 2 > Step 1'
    WHEN booking_step_3 > booking_step_2 THEN 'Inverted funnel: Step 3 > Step 2'
    WHEN reservations > booking_step_1 * 100 THEN 'Suspicious: Too many reservations'
    WHEN total_spend > 0 AND booking_step_1 = 0 AND reservations = 0 THEN 'Spend but no conversions'
    ELSE 'Other issue'
  END as issue_type,
  total_spend,
  booking_step_1,
  booking_step_2,
  booking_step_3,
  reservations,
  created_at
FROM campaign_summaries
WHERE (
  booking_step_2 > booking_step_1 OR
  booking_step_3 > booking_step_2 OR
  reservations > booking_step_1 * 100 OR
  (total_spend > 0 AND booking_step_1 = 0 AND reservations = 0)
)
ORDER BY summary_date DESC;

-- Query to see all data quality issues:
-- SELECT * FROM v_data_quality_issues;


-- ============================================
-- SUMMARY OF OPTIMIZATIONS
-- ============================================

/*

1. ✅ Platform validation constraint (only 'meta' or 'google')
2. ✅ Composite indexes for fast queries
3. ✅ Unique constraint to prevent duplicates
4. ✅ Materialized view for pre-calculated YoY (optional, for performance)
5. ✅ Funnel validation trigger (warns about illogical data)
6. ✅ Helper function for YoY with guaranteed platform consistency
7. ✅ Data quality monitoring view

APPLY THESE IN ORDER:
1. Run constraints first (may fail if bad data exists)
2. Clean up bad data if constraints fail
3. Add indexes
4. Add functions/triggers
5. Create materialized view (optional)

*/

