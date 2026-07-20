/**
 * REPORT METRIC CONTRACT v1
 *
 * Canonical definitions for every metric used in reports (PDF, email, dashboard).
 * Every adapter must produce data matching this shape.
 * Every validator must enforce these definitions.
 *
 * IMPORTANT: This is the single source of truth. Do not introduce alternative
 * definitions in send routes, builders, or report views.
 */

export type Platform = 'meta' | 'google';

export interface ReportCoreMetrics {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  average_ctr: number;
  average_cpc: number;
}

export interface ReportConversionMetrics {
  click_to_call: number;
  email_contacts: number;
  booking_step_1: number;
  booking_step_2: number;
  booking_step_3: number;
  reservations: number;
  reservation_value: number;
  roas: number;
  cost_per_reservation: number;
}

export interface ReportPayload {
  contract_version: 'v1';
  client_id: string;
  client_name: string;
  platform: Platform;
  date_range: { start: string; end: string };
  source: ReportPayloadSource;
  core: ReportCoreMetrics;
  conversion: ReportConversionMetrics;
}

export type ReportPayloadSource =
  | 'live_api'
  | 'campaign_summary'
  | 'daily_kpi_aggregate';

/**
 * Canonical metric rules (Meta).
 *
 * total_clicks: inline_link_clicks (with fallback to clicks if inline_link_clicks
 *               is missing). This matches Meta Business Suite "Link clicks"
 *               which is the metric clients see.
 * average_ctr: API value (inline_link_click_ctr || ctr) when available; fallback
 *              to (total_clicks / total_impressions) * 100.
 * average_cpc: API value (cost_per_inline_link_click || cpc) when available;
 *              fallback to total_spend / total_clicks.
 *
 * Conversion metrics: parsed via meta-actions-parser only.
 *   - click_to_call: per-client mapping when configured; otherwise PBM custom
 *     event priority, then one canonical standard subtype (never a subtype sum).
 *   - email_contacts: per-client mapping when configured; otherwise the legacy
 *     PBM website-email event. Lead/instant-form events are excluded.
 *   - booking_step_1: omni_search > fb_pixel_search > search.
 *   - booking_step_2: omni_view_content > fb_pixel_view_content.
 *   - booking_step_3: omni_initiated_checkout > fb_pixel_initiate_checkout.
 *   - reservations: omni_purchase > fb_pixel_purchase.
 *   - reservation_value: omni_purchase value > fb_pixel_purchase value.
 */
export const META_RULES = {
  total_clicks_field: 'inline_link_clicks_or_clicks',
  ctr_field: 'inline_link_click_ctr_or_ctr',
  cpc_field: 'cost_per_inline_link_click_or_cpc'
} as const;

/**
 * Canonical metric rules (Google).
 *
 * Google Ads has a single "clicks" definition; CTR/CPC come directly from API.
 */
export const GOOGLE_RULES = {
  total_clicks_field: 'clicks',
  ctr_field: 'ctr',
  cpc_field: 'average_cpc'
} as const;

export const ZERO_CORE: ReportCoreMetrics = {
  total_spend: 0,
  total_impressions: 0,
  total_clicks: 0,
  total_conversions: 0,
  average_ctr: 0,
  average_cpc: 0
};

export const ZERO_CONVERSION: ReportConversionMetrics = {
  click_to_call: 0,
  email_contacts: 0,
  booking_step_1: 0,
  booking_step_2: 0,
  booking_step_3: 0,
  reservations: 0,
  reservation_value: 0,
  roas: 0,
  cost_per_reservation: 0
};

export function emptyPayload(
  clientId: string,
  clientName: string,
  platform: Platform,
  dateRange: { start: string; end: string },
  source: ReportPayloadSource
): ReportPayload {
  return {
    contract_version: 'v1',
    client_id: clientId,
    client_name: clientName,
    platform,
    date_range: dateRange,
    source,
    core: { ...ZERO_CORE },
    conversion: { ...ZERO_CONVERSION }
  };
}
