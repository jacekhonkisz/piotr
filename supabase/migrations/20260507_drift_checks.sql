-- Stores nightly contract-drift check results.
-- Used by /api/cron/drift-check to trend metric consistency over time.

CREATE TABLE IF NOT EXISTS drift_checks (
  id BIGSERIAL PRIMARY KEY,
  period_tag TEXT NOT NULL,
  meta_avg_score NUMERIC,
  google_avg_score NUMERIC,
  meta_clients INTEGER NOT NULL DEFAULT 0,
  google_clients INTEGER NOT NULL DEFAULT 0,
  failing_count INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drift_checks_period ON drift_checks(period_tag);
CREATE INDEX IF NOT EXISTS idx_drift_checks_created_at ON drift_checks(created_at DESC);

ALTER TABLE drift_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY drift_checks_admin_read
  ON drift_checks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
