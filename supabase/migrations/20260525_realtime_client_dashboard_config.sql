-- Enable realtime updates on client_dashboard_config so that renames /
-- visibility / order changes done in /admin/metrics-config propagate
-- instantly to every connected dashboard, report, and PDF preview session.
--
-- Safe to run multiple times — adding a table that is already in the
-- publication is a no-op via `DO $$ ... $$`.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'client_dashboard_config'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.client_dashboard_config';
    END IF;
  END IF;
END;
$$;

-- REPLICA IDENTITY FULL ensures realtime payloads include the previous row
-- value too — useful for the diff-aware listener in useMetricsConfig.
ALTER TABLE IF EXISTS public.client_dashboard_config REPLICA IDENTITY FULL;
