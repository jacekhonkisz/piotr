-- Align google_ads_tables_data with the application payload shape used by
-- /reports and PDF generation. Older environments only had network,
-- demographic, quality, device, and keyword columns. Search terms were fetched
-- from Google Ads but could not be persisted, so subsequent report loads fell
-- back to "Brak danych".

ALTER TABLE public.google_ads_tables_data
  ADD COLUMN IF NOT EXISTS network_performance jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS device_performance jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS keyword_performance jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS search_term_performance jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS demographic_performance jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS geographic_performance jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS quality_score_metrics jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_updated timestamptz DEFAULT now();

COMMENT ON COLUMN public.google_ads_tables_data.search_term_performance IS
  'Google Ads search_term_view rows used by the Search Terms section in reports/PDFs.';

