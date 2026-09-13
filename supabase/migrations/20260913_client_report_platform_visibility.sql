-- Per-client report visibility for Meta / Google.
-- Credentials stay on `clients`; these flags hide a connected platform from
-- the client portal, PDF, and email without disconnecting the account.

ALTER TABLE public.client_dashboard_config
  ADD COLUMN IF NOT EXISTS meta_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS google_enabled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.client_dashboard_config.meta_enabled IS
  'When false, Meta Ads stays configured but is hidden from client reports, dashboard, PDF, and email.';

COMMENT ON COLUMN public.client_dashboard_config.google_enabled IS
  'When false, Google Ads stays configured but is hidden from client reports, dashboard, PDF, and email.';
