-- Adds geographic_performance to google_ads_tables_data so the smart cache
-- and /api/fetch-google-ads-tables can persist city/region/country splits
-- from the Google Ads geographic_view alongside the existing demographic /
-- device / keyword tables.
--
-- Shape (per row, see GoogleAdsGeographicPerformance in src/lib/google-ads-api.ts):
--   {
--     geoTargetCityId, geoTargetRegionId, geoTargetCountryId,
--     cityName, regionName, countryName, countryCode, regionCode,
--     spend, impressions, clicks, ctr, cpc,
--     conversions, conversion_value, reservations, reservation_value, roas
--   }
--
-- Nullable so existing rows remain valid; the application code treats null
-- and empty array equivalently.

ALTER TABLE public.google_ads_tables_data
  ADD COLUMN IF NOT EXISTS geographic_performance jsonb;

COMMENT ON COLUMN public.google_ads_tables_data.geographic_performance IS
  'Google Ads geographic_view rows (city/region/country aggregated). One row per (city,region,country) tuple. See GoogleAdsGeographicPerformance interface in src/lib/google-ads-api.ts for the per-row shape.';
