ALTER TABLE public.client_dashboard_config
  ADD COLUMN IF NOT EXISTS conversion_mappings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.client_dashboard_config.conversion_mappings IS
  'Per-client Meta action_type and Google conversion_action_name mappings to canonical report metrics.';
