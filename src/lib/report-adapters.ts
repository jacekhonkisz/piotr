/**
 * REPORT SOURCE ADAPTERS
 *
 * Each adapter converts raw data from one source into a contract-conforming
 * ReportPayload. Adapters NEVER fetch data; they only transform.
 *
 * Sources:
 *  - Live API (via /api/fetch-live-data, /api/fetch-google-ads-live-data)
 *  - Stored campaign_summaries row
 *  - Daily KPI aggregate (sum of daily_kpi_data rows)
 */

import {
  Platform,
  ReportPayload,
  ReportPayloadSource,
  emptyPayload
} from './report-metric-contract';
import {
  enhanceCampaignsWithConversions,
  aggregateConversionMetrics
} from './meta-actions-parser';

function num(value: any): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickMetaClicks(campaign: any): number {
  return num(campaign.inline_link_clicks ?? campaign.clicks);
}

function pickMetaCtr(campaign: any): number {
  return num(campaign.inline_link_click_ctr ?? campaign.ctr);
}

function pickMetaCpc(campaign: any): number {
  return num(campaign.cost_per_inline_link_click ?? campaign.cpc);
}

function weightedAverageOrApi(
  campaigns: any[],
  apiAccountValue: number | undefined,
  computeFromTotals: () => number,
  pickValue: (c: any) => number,
  pickWeight: (c: any) => number
): number {
  if (apiAccountValue !== undefined && apiAccountValue !== null && apiAccountValue > 0) {
    return num(apiAccountValue);
  }
  let weightedSum = 0;
  let weightTotal = 0;
  for (const c of campaigns) {
    const value = pickValue(c);
    const weight = pickWeight(c);
    if (value > 0 && weight > 0) {
      weightedSum += value * weight;
      weightTotal += weight;
    }
  }
  if (weightTotal > 0) return weightedSum / weightTotal;
  return computeFromTotals();
}

/**
 * Convert Meta live API response into ReportPayload (contract v1).
 *
 * Required input shape:
 *  - campaigns: array of campaign rows from Meta API (with actions/action_values).
 *  - accountInsights (optional): account-level insights for canonical CTR/CPC.
 */
export function adaptMetaLiveApi(args: {
  clientId: string;
  clientName: string;
  dateRange: { start: string; end: string };
  campaigns: any[];
  accountInsights?: any;
}): ReportPayload {
  const payload = emptyPayload(
    args.clientId,
    args.clientName,
    'meta',
    args.dateRange,
    'live_api' as ReportPayloadSource
  );

  const campaigns = args.campaigns ?? [];

  payload.core.total_spend = campaigns.reduce((sum, c) => sum + num(c.spend), 0);
  payload.core.total_impressions = campaigns.reduce((sum, c) => sum + num(c.impressions), 0);
  payload.core.total_clicks = campaigns.reduce((sum, c) => sum + pickMetaClicks(c), 0);
  payload.core.total_conversions = campaigns.reduce((sum, c) => sum + num(c.conversions), 0);

  payload.core.average_ctr = weightedAverageOrApi(
    campaigns,
    num(args.accountInsights?.inline_link_click_ctr ?? args.accountInsights?.ctr),
    () => (payload.core.total_impressions > 0
      ? (payload.core.total_clicks / payload.core.total_impressions) * 100
      : 0),
    pickMetaCtr,
    pickMetaClicks
  );

  payload.core.average_cpc = weightedAverageOrApi(
    campaigns,
    num(args.accountInsights?.cost_per_inline_link_click ?? args.accountInsights?.cpc),
    () => (payload.core.total_clicks > 0
      ? payload.core.total_spend / payload.core.total_clicks
      : 0),
    pickMetaCpc,
    pickMetaClicks
  );

  const convAgg = aggregateConversionMetrics(
    enhanceCampaignsWithConversions(campaigns)
  );

  payload.conversion.click_to_call = num(convAgg.click_to_call);
  payload.conversion.email_contacts = num(convAgg.email_contacts);
  payload.conversion.booking_step_1 = num(convAgg.booking_step_1);
  payload.conversion.booking_step_2 = num(convAgg.booking_step_2);
  payload.conversion.booking_step_3 = num(convAgg.booking_step_3);
  payload.conversion.reservations = num(convAgg.reservations);
  payload.conversion.reservation_value = num(convAgg.reservation_value);
  payload.conversion.roas = payload.core.total_spend > 0 && payload.conversion.reservation_value > 0
    ? payload.conversion.reservation_value / payload.core.total_spend
    : 0;
  payload.conversion.cost_per_reservation = payload.conversion.reservations > 0
    ? payload.core.total_spend / payload.conversion.reservations
    : 0;

  return payload;
}

/**
 * Convert Google Ads live API response into ReportPayload (contract v1).
 */
export function adaptGoogleLiveApi(args: {
  clientId: string;
  clientName: string;
  dateRange: { start: string; end: string };
  stats: any;
  conversionMetrics: any;
}): ReportPayload {
  const payload = emptyPayload(
    args.clientId,
    args.clientName,
    'google',
    args.dateRange,
    'live_api' as ReportPayloadSource
  );

  payload.core.total_spend = num(args.stats?.totalSpend);
  payload.core.total_impressions = num(args.stats?.totalImpressions);
  payload.core.total_clicks = num(args.stats?.totalClicks);
  payload.core.total_conversions = num(args.stats?.totalConversions);
  payload.core.average_ctr = num(args.stats?.averageCtr);
  payload.core.average_cpc = num(args.stats?.averageCpc);

  payload.conversion.click_to_call = num(args.conversionMetrics?.click_to_call);
  payload.conversion.email_contacts = num(args.conversionMetrics?.email_contacts);
  payload.conversion.booking_step_1 = num(args.conversionMetrics?.booking_step_1);
  payload.conversion.booking_step_2 = num(args.conversionMetrics?.booking_step_2);
  payload.conversion.booking_step_3 = num(args.conversionMetrics?.booking_step_3);
  payload.conversion.reservations = num(args.conversionMetrics?.reservations);
  payload.conversion.reservation_value = num(args.conversionMetrics?.reservation_value);
  payload.conversion.roas = num(args.conversionMetrics?.roas);
  payload.conversion.cost_per_reservation = num(args.conversionMetrics?.cost_per_reservation);

  return payload;
}

/**
 * Convert a stored campaign_summaries row into ReportPayload (contract v1).
 *
 * Note: Click semantics in stored summaries depend on the producing pipeline
 * (smart_cache_archive prefers inline_link_clicks; meta_api uses all clicks).
 * This adapter does not modify those values; the validator will flag any
 * cross-source mismatches.
 */
export function adaptCampaignSummary(args: {
  clientId: string;
  clientName: string;
  platform: Platform;
  dateRange: { start: string; end: string };
  summary: any;
}): ReportPayload {
  const payload = emptyPayload(
    args.clientId,
    args.clientName,
    args.platform,
    args.dateRange,
    'campaign_summary' as ReportPayloadSource
  );

  payload.core.total_spend = num(args.summary?.total_spend);
  payload.core.total_impressions = num(args.summary?.total_impressions);
  payload.core.total_clicks = num(args.summary?.total_clicks);
  payload.core.total_conversions = num(args.summary?.total_conversions);
  payload.core.average_ctr = num(args.summary?.average_ctr);
  payload.core.average_cpc = num(args.summary?.average_cpc);

  payload.conversion.click_to_call = num(args.summary?.click_to_call);
  payload.conversion.email_contacts = num(args.summary?.email_contacts);
  payload.conversion.booking_step_1 = num(args.summary?.booking_step_1);
  payload.conversion.booking_step_2 = num(args.summary?.booking_step_2);
  payload.conversion.booking_step_3 = num(args.summary?.booking_step_3);
  payload.conversion.reservations = num(args.summary?.reservations);
  payload.conversion.reservation_value = num(args.summary?.reservation_value);
  payload.conversion.roas = num(args.summary?.roas);
  payload.conversion.cost_per_reservation = num(args.summary?.cost_per_reservation);

  return payload;
}

/**
 * Aggregate daily_kpi_data rows into ReportPayload (contract v1).
 *
 * Click semantics in daily_kpi_data follow the writer (background collector or
 * batch endpoints) which today uses parseInt(campaign.clicks). Validator will
 * flag mismatches against canonical Meta link-click rule.
 */
export function adaptDailyKpiAggregate(args: {
  clientId: string;
  clientName: string;
  platform: Platform;
  dateRange: { start: string; end: string };
  rows: any[];
}): ReportPayload {
  const payload = emptyPayload(
    args.clientId,
    args.clientName,
    args.platform,
    args.dateRange,
    'daily_kpi_aggregate' as ReportPayloadSource
  );

  for (const row of args.rows ?? []) {
    payload.core.total_spend += num(row.total_spend);
    payload.core.total_impressions += num(row.total_impressions);
    payload.core.total_clicks += num(row.total_clicks);
    payload.core.total_conversions += num(row.total_conversions);
    payload.conversion.click_to_call += num(row.click_to_call);
    payload.conversion.email_contacts += num(row.email_contacts);
    payload.conversion.booking_step_1 += num(row.booking_step_1);
    payload.conversion.booking_step_2 += num(row.booking_step_2);
    payload.conversion.booking_step_3 += num(row.booking_step_3);
    payload.conversion.reservations += num(row.reservations);
    payload.conversion.reservation_value += num(row.reservation_value);
  }

  payload.core.average_ctr = payload.core.total_impressions > 0
    ? (payload.core.total_clicks / payload.core.total_impressions) * 100
    : 0;
  payload.core.average_cpc = payload.core.total_clicks > 0
    ? payload.core.total_spend / payload.core.total_clicks
    : 0;
  payload.conversion.roas = payload.core.total_spend > 0 && payload.conversion.reservation_value > 0
    ? payload.conversion.reservation_value / payload.core.total_spend
    : 0;
  payload.conversion.cost_per_reservation = payload.conversion.reservations > 0
    ? payload.core.total_spend / payload.conversion.reservations
    : 0;

  return payload;
}
