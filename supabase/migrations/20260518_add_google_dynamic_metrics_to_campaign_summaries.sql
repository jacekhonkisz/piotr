-- Store dyn_google_* metric payloads alongside Google Ads historical summaries.
-- This keeps reports/dashboard/PDF on DB reads after new Google conversion metrics
-- are enabled, matching the smart-cache behavior for current periods.

ALTER TABLE public.campaign_summaries
  ADD COLUMN IF NOT EXISTS google_dynamic_metric_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS google_dynamic_metric_rows jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.campaign_summaries.google_dynamic_metric_values IS
  'Cached dyn_google_* conversion counts keyed by metric key for Google Ads reports.';

COMMENT ON COLUMN public.campaign_summaries.google_dynamic_metric_rows IS
  'Cached Google Ads conversion-action rows used to audit and render dyn_google_* metrics.';
